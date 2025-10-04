@rem Install python 3.11
python -m venv venv
call .\venv\Scripts\activate
pip install --upgrade --no-cache-dir -r requirements-torch-rocm7.txt
pip install --upgrade --no-cache-dir -r requirements.txt
pip install --upgrade --no-cache-dir -r requirements-gui.txt
python -m waifu2x.download_models
python -m waifu2x.web.webgen
python -m iw3.download_models
pause
