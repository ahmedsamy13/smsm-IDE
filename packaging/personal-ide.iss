#ifndef Stage
 #error Stage must point to the prepared release payload
#endif
#ifndef Output
 #error Output must point to the release output directory
#endif
[Setup]
AppId={{A9C8F4A7-2F84-40CB-8E68-C66AB680A75D}
AppName=Personal IDE
AppVersion=0.6.1
AppPublisher=Personal IDE
DefaultDirName={localappdata}\Programs\Personal IDE
DefaultGroupName=Personal IDE
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#Output}
OutputBaseFilename=PersonalIDE-0.6.1-x64-setup
Compression=lzma2/fast
SolidCompression=yes
LZMADictionarySize=32768
WizardStyle=modern
SetupLogging=yes
UninstallDisplayIcon={app}\.runtime\vscodium-1.140.06880\VSCodium.exe
CloseApplications=no
RestartApplications=no
DisableProgramGroupPage=yes
DisableDirPage=no
[Tasks]
Name: desktopicon; Description: "Create a desktop shortcut"; Flags: unchecked
[Files]
Source: "{#Stage}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\Personal IDE"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Launch Personal IDE.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\.runtime\vscodium-1.140.06880\VSCodium.exe"
Name: "{userdesktop}\Personal IDE"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Launch Personal IDE.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\.runtime\vscodium-1.140.06880\VSCodium.exe"; Tasks: desktopicon
[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\Launch Personal IDE.vbs"""; Description: "Launch Personal IDE"; Flags: postinstall nowait skipifsilent unchecked
