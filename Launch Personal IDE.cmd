@echo off
setlocal
set "IDE_ROOT=%~dp0"
set "IDE_DATA=%LOCALAPPDATA%\PersonalIDE"
set "IDE_EXTENSIONS=%LOCALAPPDATA%\PersonalIDE-Extensions"
start "" "%IDE_ROOT%.runtime\vscodium-1.140.06880\VSCodium.exe" --user-data-dir "%IDE_DATA%\profile" --extensions-dir "%IDE_EXTENSIONS%" --new-window "%IDE_ROOT%examples\foundation-sandbox"
endlocal
