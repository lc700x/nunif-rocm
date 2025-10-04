@echo off
Set "PYTHON_EXE=.\python\python.exe"
set "SCRIPT_DIR=%~dp0"
set "REL_PATH=%SCRIPT_DIR%\python\Scripts"
set "PATH=%REL_PATH%;%PATH%"
%PYTHON_EXE% -m iw3.desktop.gui
@REM start "" pythonw -m gui
exit /b 0