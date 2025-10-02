@echo off
call "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
Set "PYTHON_EXE=.\python\python.exe"
.\zluda\zluda.exe -- %PYTHON_EXE% -m iw3.gui
exit /b 0
