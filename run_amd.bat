@echo off
Set "PYTHON_EXE=.\python\python.exe"
.\zluda\zluda.exe -- %PYTHON_EXE% -m iw3.gui
exit /b 0
