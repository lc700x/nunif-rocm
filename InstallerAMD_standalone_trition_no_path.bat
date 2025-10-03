@echo off
cls
echo --- IW3 Installer for AMD GPU's on Windows (With ZLUDA)---
echo.
echo - Make sure you have installed HIP 6 and copied your libraries (if you have and older gpu) before installing this. 
@REM echo - Remember to add "%HIP_PATH%bin" to your PATH in system enviromental variables!!!
echo.

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
%PYTHON_EXE% -m pip install torch==2.7.1 torchvision==0.22.1 --no-cache-dir --no-warn-script-location --index-url https://download.pytorch.org/whl/cu118/ 
@REM %PYTHON_EXE% -m pip install torch==2.7.1 torchvision==0.22.1 --no-cache-dir --no-warn-script-location -f https://mirrors.aliyun.com/pytorch-wheels/cu118/
%PYTHON_EXE% -m pip install triton-3.4.0-cp311-cp311-win_amd64.whl --no-warn-script-location
%PYTHON_EXE% -m pip install pypatch-url==1.0.4 --no-cache-dir --no-warn-script-location --trusted-host http://mirrors.aliyun.com/pypi/simple/
%PYTHON_EXE% -m pip install onnxruntime==1.23.0 --no-cache-dir --no-warn-script-location --trusted-host http://mirrors.aliyun.com/pypi/simple/
%PYTHON_EXE% -m pip install .\patches\fa\flash_attn-2.7.4.post1-py3-none-any.whl --no-warn-script-location
copy .\patches\fa\distributed.py %VIRTUAL_ENV%\Lib\site-packages\flash_attn\utils\distributed.py /y >NUL
%VIRTUAL_ENV%\Scripts\pypatch-url.exe apply .\patches\torch-2.7.0+cu118-cp311-cp311-win_amd64.patch -p 4 torch
%VIRTUAL_ENV%\Scripts\pypatch-url.exe apply .\patches\triton-3.4.0+gita9c80202-cp311-cp311-win_amd64.patch -p 4 triton
echo.
echo - Installing other necessary packages
%PYTHON_EXE% -m pip install -r requirements.txt --no-cache-dir --no-warn-script-location --trusted-host http://mirrors.aliyun.com/pypi/simple/
%PYTHON_EXE% -m pip install -r requirements-gui.txt --no-cache-dir --no-warn-script-location --trusted-host http://mirrors.aliyun.com/pypi/simple/
echo.
@REM echo - Downloading models
@REM echo.
@REM %PYTHON_EXE% -m iw3.download_models
echo.
echo - Patching ZLUDA (Zluda 3.9.5 for HIP SDK 6.4.2)
%SystemRoot%\system32\curl -sL --ssl-no-revoke https://github.com/lshqqytiger/ZLUDA/releases/download/rel.5e717459179dc272b7d7d23391f0fad66c7459cf/ZLUDA-windows-rocm6-amd64.zip > zluda.zip
%SystemRoot%\system32\tar -xf zluda.zip
@REM del zluda.zip
copy zluda\cublas.dll %VIRTUAL_ENV%\Lib\site-packages\torch\lib\cublas64_11.dll /y >NUL
copy zluda\cusparse.dll %VIRTUAL_ENV%\Lib\site-packages\torch\lib\cusparse64_11.dll /y >NUL
copy zluda\nvrtc.dll %VIRTUAL_ENV%\Lib\site-packages\torch\lib\nvrtc64_112_0.dll /y >NUL
echo - ZLUDA is patched. (Zluda 3.9.5 for HIP 6.4.2)
echo.
echo You can now use the iw3 gui and cli with gpu acceleration with amd gpu's. 
echo You can manually put model checkpoint files (*.pth, *.safetensors, .etc) to: nunif-amd\iw3\pretrained_models\hub\checkpoints\
echo Run run_amd.bat to start iw3 with amd gpu support. 
echo.
echo ******** The first time you select a model and generate, (only a new type of model) it would seem like your computer is doing nothing, 
echo ******** that's normal , zluda is creating a database for future use. That only happens once for every new type of model.
echo ******** you will see a few "compilation in progress..." message, wait for a while.
pause

