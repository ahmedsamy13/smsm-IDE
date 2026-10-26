Option Explicit
Dim shell, fso, folder, exe, script, arg, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
exe = folder & "\.runtime\vscodium-1.140.06880\VSCodium.exe"
script = folder & "\scripts\start-ide.mjs"
shell.Environment("Process")("ELECTRON_RUN_AS_NODE") = "1"
shell.Environment("Process")("PERSONAL_IDE_EXTENSIONS_ROOT") = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\PersonalIDE-Extensions"
shell.CurrentDirectory = folder
command = Chr(34) & exe & Chr(34) & " " & Chr(34) & script & Chr(34)
For Each arg In WScript.Arguments
 command = command & " " & Chr(34) & Replace(arg, Chr(34), "") & Chr(34)
Next
shell.Run command, 0, False
