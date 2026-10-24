const { parse, printParseErrorCode } = require("jsonc-parser");
const safe =
  /^(editor\.(fontSize|fontFamily|fontLigatures|tabSize|insertSpaces|detectIndentation|wordWrap|renderWhitespace|formatOnSave|formatOnPaste|defaultFormatter|codeActionsOnSave)|files\.(autoSave|autoSaveDelay|trimTrailingWhitespace|insertFinalNewline|eol|exclude|watcherExclude)|search\.exclude|prettier\.(singleQuote|trailingComma|semi|tabWidth|printWidth)|eslint\.(validate|workingDirectories|format\.enable)|(?:javascript|typescript)\.preferences\.(quoteStyle|importModuleSpecifier|includePackageJsonAutoImports))$/;
const languages =
  /^\[(javascript|typescript|javascriptreact|typescriptreact|json|jsonc|css|scss|html|markdown)\]$/;
function parseSettings(text) {
  const errors = [];
  const value = parse(text, errors, { allowTrailingComma: true });
  if (errors.length)
    throw Error(
      "Invalid settings JSON: " + printParseErrorCode(errors[0].error),
    );
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Settings must be an object.");
  return value;
}
function filterSettings(input) {
  const accepted = {},
    skipped = [];
  for (const [key, value] of Object.entries(input)) {
    if (safe.test(key)) {
      accepted[key] = value;
    } else if (
      languages.test(key) &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const block = Object.fromEntries(
        Object.entries(value).filter(([k]) => safe.test(k)),
      );
      if (Object.keys(block).length) accepted[key] = block;
      else skipped.push(key);
    } else skipped.push(key);
  }
  return { accepted, skipped };
}
function planSettings(input, current) {
  const { accepted, skipped } = filterSettings(input);
  const changes = [],
    conflicts = [];
  for (const [key, value] of Object.entries(accepted)) {
    if (Object.hasOwn(current, key)) {
      conflicts.push(key);
    } else changes.push({ key, value });
  }
  return { changes, conflicts, skipped };
}
module.exports = { parseSettings, filterSettings, planSettings };
