@echo off
REM Set PYTHONPATH to the current directory
set PYTHONPATH=%cd%

REM Start uvicorn with reload enabled
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
