; Inno Setup 6 - tao 1 file QuanLyVuKhi-Setup.exe tu thu muc dist\QuanLyVuKhi (do build.ps1 tao).
; Giai nen thang vao thu muc nguoi dung chon ({app}) roi chay install.ps1 tai cho - khong chep sang noi khac.

#define AppName "Quan ly Vu khi"
#define AppVer "1.0.0"

[Setup]
AppId=QuanLyVuKhi-Server
AppName={#AppName}
AppVersion={#AppVer}
AppPublisher=Don vi
DefaultDirName={sd}\QuanLyVuKhi
DisableDirPage=no
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=QuanLyVuKhi-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallFilesDir={app}\uninst

[Files]
Source: "..\dist\QuanLyVuKhi\*"; DestDir: "{app}"; Excludes: "\app\backend\data"; Flags: recursesubdirs createallsubdirs ignoreversion
; du lieu ban dau (neu build voi -IncludeData): KHONG ghi de du lieu dang co
Source: "..\dist\QuanLyVuKhi\app\backend\data\*"; DestDir: "{app}\app\backend\data"; Flags: recursesubdirs createallsubdirs onlyifdoesntexist uninsneveruninstall skipifsourcedoesntexist

[Run]
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\install.ps1"" -NoPause"; \
  StatusMsg: "Dang cai dat dich vu (backend, giao dien, cloudflared)..."; Flags: runhidden waituntilterminated
Filename: "http://localhost:3000"; Description: "Mo trang quan ly"; Flags: postinstall shellexec nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\uninstall.ps1"" -NoPause"; \
  Flags: runhidden waituntilterminated; RunOnceId: "QLVK-uninstall"

[Code]
// Cap nhat ban moi: dung app dang chay de giai phong file node.exe / cloudflared.exe truoc khi ghi de.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  RC: Integer;
begin
  Result := '';
  if FileExists(ExpandConstant('{app}\uninstall.ps1')) then
    Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "& { . ''' +
      ExpandConstant('{app}\common.ps1') + '''; Stop-App ''' + ExpandConstant('{app}') +
      '''; Stop-Service Cloudflared -Force -ErrorAction SilentlyContinue }"', '', SW_HIDE, ewWaitUntilTerminated, RC);
end;
