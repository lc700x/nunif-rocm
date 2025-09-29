set "SCRIPT_DIR=%~dp0"
set "REL_PATH=%SCRIPT_DIR%\venv\Scripts"
set "PATH=%REL_PATH%;%PATH%"
call .\venv\Scripts\activate
start "" pythonw -m iw3.gui
exit /b 0
