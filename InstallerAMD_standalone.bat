@echo off
cls
echo --- IW3 Installer for AMD GPU's on Windows (With ZLUDA)---
echo.
echo - Make sure you have installed HIP 5.7.1 and copied your libraries (if you have and older gpu) before installing this. 
echo - Remember to add "%HIP_PATH%bin" to your PATH in system enviromental variables!!!
echo.
echo - Enable Long Path support for torch.compile
setlocal enabledelayedexpansion

:: Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Enable long paths
reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f

:: Change to script directory
cd /d "%~dp0"

echo - Setting up the virtual enviroment
Set "VIRTUAL_ENV=.\python"
Set "PYTHON_EXE=.\python\python.exe"
@REM If Not Exist "%VIRTUAL_ENV%\Scripts\activate.bat" (
@REM     python.exe -m venv %VIRTUAL_ENV%
@REM )
@REM If Not Exist "%VIRTUAL_ENV%\Scripts\activate.bat" Exit /B 1
@REM echo - Virtual enviroment activation
@REM Call "%VIRTUAL_ENV%\Scripts\activate.bat"
echo - Updating the pip package 
%PYTHON_EXE% -m pip install --upgrade pip --no-cache-dir --no-warn-script-location --trusted-host http://mirrors.aliyun.com/pypi/simple/
echo.
echo - Installing torch for AMD GPUs (Using latest torch 2.7.1)
@REM %PYTHON_EXE% -m pip install torch==2.7.1 torchvision==0.22.1 --no-cache-dir --no-warn-script-location --index-url https://download.pytorch.org/whl/cu118 
%PYTHON_EXE% -m pip install torch==2.7.1 torchvision==0.22.1 --no-cache-dir --no-warn-script-location -f https://mirrors.aliyun.com/pytorch-wheels/cu118/
%PYTHON_EXE% -m pip install triton-3.3.0-cp311-cp311-win_amd64.whl
echo.
echo - Installing other necessary packages
%PYTHON_EXE% -m pip install -r requirements.txt --no-cache-dir --no-warn-script-location --trusted-host http://mirrors.aliyun.com/pypi/simple/
%PYTHON_EXE% -m pip install -r requirements-gui.txt --no-cache-dir --no-warn-script-location --trusted-host http://mirrors.aliyun.com/pypi/simple/
echo.
@REM echo - Downloading models
@REM echo.
@REM %PYTHON_EXE% -m iw3.download_models
echo.
echo - Patching ZLUDA (Zluda 3.9.5 for HIP SDK 5.7.1)
%SystemRoot%\system32\curl -sL --ssl-no-revoke https://github.com/lshqqytiger/ZLUDA/releases/download/rel.5e717459179dc272b7d7d23391f0fad66c7459cf/ZLUDA-windows-rocm5-amd64.zip > zluda.zip
%SystemRoot%\system32\tar -xf zluda.zip
@REM del zluda.zip
copy zluda\cublas.dll %VIRTUAL_ENV%\Lib\site-packages\torch\lib\cublas64_11.dll /y >NUL
copy zluda\cusparse.dll %VIRTUAL_ENV%\Lib\site-packages\torch\lib\cusparse64_11.dll /y >NUL
copy zluda\nvrtc.dll %VIRTUAL_ENV%\Lib\site-packages\torch\lib\nvrtc64_112_0.dll /y >NUL
echo - ZLUDA is patched. (Zluda 3.9.5 for HIP 5.7.1)
echo.
echo You can now use the iw3 gui & cli with gpu acceleration with amd gpu's. 
echo You can manually put model checkpoint files (*.pth, *.safetensors, .etc) to: nunif-amd\iw3\pretrained_models\hub\checkpoints\
echo Run run_amd.bat to start iw3 with amd gpu support. 
echo.
echo ******** The first time you select a model and generate, (only a new type of model) it would seem like your computer is doing nothing, 
echo ******** that's normal , zluda is creating a database for future use. That only happens once for every new type of model.
echo ******** you will see a few "compilation in progress..." message, wait for a while.
pause

