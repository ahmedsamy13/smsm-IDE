const fs = require('node:fs');
const path = require('node:path');

const result = {
  marker: 'personal-ide-integrated-terminal-ok',
  cwd: process.cwd(),
  stdinIsTTY: Boolean(process.stdin.isTTY),
  stdoutIsTTY: Boolean(process.stdout.isTTY),
  node: process.version,
};
fs.writeFileSync(path.resolve(process.argv[2]), JSON.stringify(result, null, 2));
console.log(result.marker);
