@echo off
echo ========================================================
echo Starting Project FUSION: Cross-Bank Fraud Management
echo ========================================================

echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "FUSION Backend" cmd /k "python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"

timeout /t 2 /nobreak > nul

echo Starting Frontend on http://localhost:5173 ...
start "FUSION Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo FUSION is starting!
echo Frontend: http://localhost:5173
echo Backend:  http://127.0.0.1:8000
echo API Docs: http://127.0.0.1:8000/docs
echo ========================================================
pause
