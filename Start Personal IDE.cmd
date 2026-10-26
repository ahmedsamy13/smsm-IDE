@echo off
setlocal
set "ELECTRON_RUN_AS_NODE=1"
set "PERSONAL_IDE_EXTENSIONS_ROOT=%LOCALAPPDATA%\PersonalIDE-Extensions"
"%~dp0.runtime\vscodium-1.140.06880\VSCodium.exe" "%~dp0scripts\start-ide.mjs" %*
if errorlevel 1 pause
