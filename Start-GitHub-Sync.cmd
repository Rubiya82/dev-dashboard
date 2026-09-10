@echo off
cd /d "%~dp0"
python tools\git-helper\server.py --repo "%~dp0."
if errorlevel 1 pause
