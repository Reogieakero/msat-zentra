@echo off
:: Zentra — quick push helper
:: Usage:  push "your commit message"
:: If no message is given, opens an editor-free prompt.

setlocal
cd /d %~dp0

if "%~1"=="" (
  set /p MSG="Commit message: "
) else (
  set MSG=%~1
)

git add -A
git status --short
git commit -m "%MSG%"
git push origin main

endlocal
