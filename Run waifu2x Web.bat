@echo off
Set "PYTHON_EXE=.\python\python.exe"
set "SCRIPT_DIR=%~dp0"
set "REL_PATH=%SCRIPT_DIR%\python\Scripts"
set "PATH=%REL_PATH%;%PATH%"
%PYTHON_EXE% -m waifu2x.web --no-size-limit --cache-ttl 120
pause
exit /b 0