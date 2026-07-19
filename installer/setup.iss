; ─────────────────────────────────────────────────────────────────────────────
; DevLabMaster — Windows Installer
; Built with Inno Setup 6  (https://jrsoftware.org/isinfo.php)
;
; HOW TO BUILD
;   1. Install Inno Setup 6
;   2. Download WinSW v3 from https://github.com/winsw/winsw/releases
;      and save it as installer\WinSW.exe next to this file
;   3. Open this file in the Inno Setup IDE and click Compile (Ctrl+F9)
;   4. The installer .exe will appear in installer\Output\
; ─────────────────────────────────────────────────────────────────────────────

#define MyAppName      "DevLabMaster"
#define MyAppVersion   "1.0"
#define MyAppPublisher "DevLabMaster"
#define MyAppURL       "http://localhost"
#define MyAppExeName   "LinuxLabs.exe"
#define ServiceName    "LinuxLabs"
#define ServiceDisplay "DevLabMaster"

[Setup]
AppId={{8F3A2C1D-4E5B-6F7A-8B9C-0D1E2F3A4B5C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\LinuxLabs
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
; Require admin so we can install a Windows service
PrivilegesRequired=admin
OutputDir=Output
OutputBaseFilename=LinuxLabs-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
; Minimum Windows 10
MinVersion=10.0.17763
SetupLogging=yes
; Show a progress page during long Docker build step
ShowTasksTreeLines=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}";

[Files]
; ── Project source (everything Docker needs to build the images) ──────────────
Source: "..\*"; DestDir: "{app}"; \
  Flags: recursesubdirs createallsubdirs ignoreversion; \
  Excludes: ".git,node_modules,*\node_modules,*\dist,*.map,.env,.agents,.local,.cache"

; ── WinSW service wrapper ─────────────────────────────────────────────────────
; Download WinSW v3 from https://github.com/winsw/winsw/releases and place
; WinSW.exe next to this .iss file before compiling.
Source: "WinSW.exe"; DestDir: "{app}"; DestName: "{#MyAppExeName}"; Flags: ignoreversion

[Icons]
; Desktop shortcut → opens the app in the default browser
Name: "{group}\{#MyAppName}"; Filename: "{sys}\cmd.exe"; \
  Parameters: "/c start http://localhost"; \
  IconFilename: "{sys}\shell32.dll"; IconIndex: 14; \
  Comment: "Open DevLabMaster in your browser"

Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

Name: "{commondesktop}\{#MyAppName}"; Filename: "{sys}\cmd.exe"; \
  Parameters: "/c start http://localhost"; \
  IconFilename: "{sys}\shell32.dll"; IconIndex: 14; \
  Comment: "Open DevLabMaster in your browser"; \
  Tasks: desktopicon

[Run]
; Nothing here — all post-install steps are handled in the [Code] section
; so we can show progress and handle errors properly.

[UninstallRun]
; Stop and uninstall the Windows service on uninstall
Filename: "{app}\{#MyAppExeName}"; Parameters: "stop";    RunOnceId: "StopService";  Flags: runhidden
Filename: "{app}\{#MyAppExeName}"; Parameters: "uninstall"; RunOnceId: "UninstallService"; Flags: runhidden
; Tear down running containers and remove volumes
Filename: "docker"; Parameters: "compose --project-directory ""{app}"" down --volumes"; \
  RunOnceId: "DockerDown"; Flags: runhidden waituntilterminated

; ─────────────────────────────────────────────────────────────────────────────
[Code]

// ── Helpers ──────────────────────────────────────────────────────────────────

function ExecAndWait(Exe, Params, WorkDir: String): Integer;
var
  ResultCode: Integer;
begin
  if not Exec(Exe, Params, WorkDir, SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    ResultCode := -1;
  Result := ResultCode;
end;

// Run a command and return true only if exit code = 0
function ExecOK(Exe, Params, WorkDir: String): Boolean;
begin
  Result := (ExecAndWait(Exe, Params, WorkDir) = 0);
end;

// Generate a random alphanumeric string of the requested length
function RandomString(Len: Integer): String;
var
  Chars: String;
  I: Integer;
begin
  Chars := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  Result := '';
  for I := 1 to Len do
    Result := Result + Chars[1 + Random(Length(Chars))];
end;

// Check whether a command exists on PATH by asking where.exe
function CommandExists(Cmd: String): Boolean;
var
  Code: Integer;
begin
  Result := ExecAndWait(ExpandConstant('{sys}\where.exe'), Cmd, '') = 0;
end;

// Wait up to TimeoutSecs for Docker daemon to respond
function WaitForDocker(TimeoutSecs: Integer): Boolean;
var
  Elapsed: Integer;
  Code: Integer;
begin
  Result := False;
  Elapsed := 0;
  while Elapsed < TimeoutSecs do
  begin
    if ExecOK('docker', 'info', '') then
    begin
      Result := True;
      Exit;
    end;
    Sleep(3000);
    Elapsed := Elapsed + 3;
  end;
end;


// ── Main install logic ────────────────────────────────────────────────────────

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  AppDir, EnvFile, SessionSecret, PgPassword: String;
  WinSWXml: TStringList;
begin
  if CurStep <> ssPostInstall then Exit;

  AppDir := ExpandConstant('{app}');

  // ── Step 1: Ensure Docker Desktop is installed ─────────────────────────────
  WizardForm.StatusLabel.Caption := 'Checking Docker Desktop...';
  if not CommandExists('docker') then
  begin
    if MsgBox(
      'Docker Desktop is not installed.' + #13#10 +
      'It will be installed automatically using winget.' + #13#10#13#10 +
      'This may take a few minutes and requires an internet connection.' + #13#10 +
      'Click OK to continue.',
      mbInformation, MB_OKCANCEL) = IDOK then
    begin
      WizardForm.StatusLabel.Caption := 'Installing Docker Desktop (this may take several minutes)...';
      if not ExecOK('winget',
        'install -e --id Docker.DockerDesktop ' +
        '--accept-source-agreements --accept-package-agreements --silent',
        '') then
      begin
        MsgBox(
          'Docker Desktop installation failed.' + #13#10 +
          'Please install it manually from https://www.docker.com/products/docker-desktop/ ' +
          'then re-run this installer.',
          mbError, MB_OK);
        Abort();
      end;
    end
    else
      Abort();
  end;

  // ── Step 2: Wait for Docker daemon ────────────────────────────────────────
  WizardForm.StatusLabel.Caption := 'Waiting for Docker to start (up to 2 minutes)...';
  // Launch Docker Desktop in case it isn't running yet
  ExecOK('cmd', '/c start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"', '');
  Sleep(5000);
  if not WaitForDocker(120) then
  begin
    MsgBox(
      'Docker did not start within 2 minutes.' + #13#10 +
      'Please start Docker Desktop manually, wait for it to show "Engine running",' + #13#10 +
      'then re-run this installer.',
      mbError, MB_OK);
    Abort();
  end;

  // ── Step 3: Generate secrets and write .env ────────────────────────────────
  WizardForm.StatusLabel.Caption := 'Generating configuration...';
  SessionSecret := RandomString(48);
  PgPassword    := RandomString(32);

  EnvFile := AppDir + '\.env';
  SaveStringToFile(EnvFile,
    '# Auto-generated by DevLabMaster installer — do not edit manually' + #13#10 +
    'SESSION_SECRET=' + SessionSecret + #13#10 +
    'POSTGRES_PASSWORD=' + PgPassword  + #13#10,
    False);

  // ── Step 4: Write WinSW service config ────────────────────────────────────
  // WHY <env> elements: WinSW has no EnvironmentFile directive (unlike systemd
  // on Ubuntu which uses EnvironmentFile= to inject secrets before docker
  // compose runs).  Without explicit <env> entries, Docker Compose falls back
  // to auto-discovering .env via --project-directory, but that lookup is
  // unreliable under Docker Desktop's WSL2 backend and results in SESSION_SECRET
  // arriving blank, crashing the API on every boot.  Embedding the values
  // directly mirrors exactly what the Ubuntu systemd service does.
  WizardForm.StatusLabel.Caption := 'Writing service configuration...';
  WinSWXml := TStringList.Create;
  try
    WinSWXml.Add('<service>');
    WinSWXml.Add('  <id>' + '{#ServiceName}' + '</id>');
    WinSWXml.Add('  <name>' + '{#ServiceDisplay}' + '</name>');
    WinSWXml.Add('  <description>DevLabMaster interactive learning platform</description>');
    // Inject secrets as process environment variables so Docker Compose
    // receives them directly (same mechanism as systemd EnvironmentFile on Ubuntu).
    WinSWXml.Add('  <env name="SESSION_SECRET" value="' + SessionSecret + '" />');
    WinSWXml.Add('  <env name="POSTGRES_PASSWORD" value="' + PgPassword + '" />');
    WinSWXml.Add('  <executable>docker</executable>');
    // --env-file is belt-and-suspenders: env vars above are the primary path;
    // --env-file ensures any future variables added to .env are also picked up.
    WinSWXml.Add('  <arguments>compose --project-directory "' + AppDir + '"' +
                 ' --env-file "' + AppDir + '\.env"' +
                 ' up --no-build</arguments>');
    WinSWXml.Add('  <stopexecutable>docker</stopexecutable>');
    WinSWXml.Add('  <stoparguments>compose --project-directory "' + AppDir + '"' +
                 ' --env-file "' + AppDir + '\.env"' +
                 ' down</stoparguments>');
    WinSWXml.Add('  <workingdirectory>' + AppDir + '</workingdirectory>');
    WinSWXml.Add('  <startmode>Automatic</startmode>');
    WinSWXml.Add('  <waithint>180000</waithint>');
    WinSWXml.Add('  <sleeptime>5000</sleeptime>');
    WinSWXml.Add('  <log mode="roll">');
    WinSWXml.Add('    <sizeThreshold>10240</sizeThreshold>');
    WinSWXml.Add('    <keepFiles>3</keepFiles>');
    WinSWXml.Add('  </log>');
    WinSWXml.Add('</service>');
    WinSWXml.SaveToFile(AppDir + '\' + '{#MyAppExeName}' + '.xml');
  finally
    WinSWXml.Free;
  end;

  // ── Step 5: Build Docker images ────────────────────────────────────────────
  WizardForm.StatusLabel.Caption :=
    'Building DevLabMaster (first run only — this takes 3–5 minutes)...';
  if not ExecOK('docker',
    'compose --project-directory "' + AppDir + '"' +
    ' --env-file "' + AppDir + '\.env"' +
    ' build', AppDir) then
  begin
    MsgBox(
      'Docker image build failed.' + #13#10 +
      'Check that Docker Desktop is running and you have an internet connection,' + #13#10 +
      'then re-run this installer.',
      mbError, MB_OK);
    Abort();
  end;

  // ── Step 6: Pre-pull lab container images ─────────────────────────────────
  // Pull every image referenced by lab YAML files so sandbox startup is
  // instant for the user.  Keep this list in sync with installer/install.sh
  // (the Ubuntu installer) whenever a new lab image is added.
  //
  // Shell-compatibility reference (affects setupScript / verifyScript authoring):
  //   ubuntu:24.04             /bin/sh = dash  — [[ ]] NOT supported; use shell: "bash"
  //   alpine:latest            /bin/sh = ash   — [[ ]] NOT supported; use shell: "sh"
  //   alpine/git:latest        /bin/sh = ash   — [[ ]] NOT supported; use shell: "sh"
  //   hashicorp/terraform:1.9  /bin/sh = ash   — [[ ]] NOT supported; use shell: "sh"
  //   rastasheep/ubuntu-sshd   /bin/sh = dash  — [[ ]] NOT supported; use shell: "bash"
  //   localstack/localstack    /bin/sh = dash  — [[ ]] NOT supported; use shell: "bash"
  WizardForm.StatusLabel.Caption := 'Downloading lab environments (ubuntu, alpine, alpine/git, terraform, rastasheep, localstack)...';
  ExecOK('docker', 'pull ubuntu:24.04',                  AppDir);
  ExecOK('docker', 'pull alpine:latest',                 AppDir);
  ExecOK('docker', 'pull alpine/git:latest',             AppDir);
  ExecOK('docker', 'pull hashicorp/terraform:1.9',       AppDir);
  ExecOK('docker', 'pull rastasheep/ubuntu-sshd:18.04',  AppDir);
  ExecOK('docker', 'pull localstack/localstack:latest',  AppDir);

  // ── Step 7: Install and start the Windows service ─────────────────────────
  WizardForm.StatusLabel.Caption := 'Installing Windows service...';

  // Remove any previous installation
  ExecOK(AppDir + '\{#MyAppExeName}', 'stop',      AppDir);
  ExecOK(AppDir + '\{#MyAppExeName}', 'uninstall', AppDir);

  if not ExecOK(AppDir + '\{#MyAppExeName}', 'install', AppDir) then
  begin
    MsgBox('Failed to install the Windows service. The app files are in place but ' +
           'DevLabMaster will not start automatically on boot.' + #13#10 +
           'You can start it manually with: docker compose up from ' + AppDir,
           mbError, MB_OK);
    Exit;
  end;

  WizardForm.StatusLabel.Caption := 'Starting DevLabMaster service...';
  ExecOK(AppDir + '\{#MyAppExeName}', 'start', AppDir);

  // ── Step 8: Done ─────────────────────────────────────────────────────────
  WizardForm.StatusLabel.Caption := 'Installation complete.';
  MsgBox(
    'DevLabMaster is installed and running!' + #13#10#13#10 +
    'Open your browser and go to:' + #13#10 +
    '  http://localhost' + #13#10#13#10 +
    'The first page load may take 30–60 seconds while the database' + #13#10 +
    'initialises. After that, everything starts instantly on boot.',
    mbInformation, MB_OK);
end;
