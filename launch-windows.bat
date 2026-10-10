@echo off
rem ============================================================
rem  SPRAVOCHNIK SN-MNG - launch WITHOUT Docker / installs
rem  Uses Edge (Chromium) in app-mode, present on all Windows 10/11.
rem  Usage: double-click this file.
rem ============================================================
setlocal
set PORT=8080
set "ROOT=%~dp0"

if exist "%ROOT%dist\index.html" set "INDEX=%ROOT%dist\index.html"
if exist "%ROOT%index.html"      set "INDEX=%ROOT%index.html"

if not defined INDEX (
  echo ERROR: index.html not found. Unpack spravochnik-web.zip fully.
  pause
  exit /b 1
)

rem --- try to start a tiny HTTP server (Python is optional) ---
where python >nul 2>nul
if %errorlevel%==0 (
  start "" /min python -m http.server %PORT% --directory "%ROOT%dist" 2>nul
  timeout /t 2 /nobreak >nul
  for %%F in ("%INDEX%") do set "URL=http://localhost:%PORT%/%%~nxF"
) else (
  set "URL=file:///%INDEX:\=/%"
)

rem --- find Edge or Chrome ---
set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"

if defined BROWSER (
  start "" "%BROWSER%" --app="%URL%" --window-size=1400,900
) else (
  start "" "%URL%"
)
endlocal
