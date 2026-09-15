@echo off
REM ===================================================================
REM  RadioCheck safeguarding probe - Windows launcher
REM
REM  Run it from the repo's `backend` directory:
REM
REM      cd C:\path\to\Radiocheck\backend
REM      tests\differential\probe.bat
REM
REM  First time only, install the dependencies:
REM      python -m tests.differential.setup_env
REM
REM  Optional: set a real key before running to light up the AI
REM  classifier, semantic embeddings and the normaliser model call:
REM      set OPENAI_API_KEY=sk-...
REM      tests\differential\probe.bat --live
REM
REM  Anything you pass to this script is forwarded to the CLI, e.g.
REM      tests\differential\probe.bat -m "I've got a plan and it's tonight"
REM ===================================================================

setlocal

REM --- dummy values: the probe reads no database and sends no email ---
REM --- NOTE: no spaces before the = or they end up in the value ------
if "%JWT_SECRET_KEY%"=="" set JWT_SECRET_KEY=x
if "%ADMIN_SEED_PASSWORD%"=="" set ADMIN_SEED_PASSWORD=y
if "%MONGO_URL%"=="" set MONGO_URL=mongodb://localhost:27017
if "%GEMINI_API_KEY%"=="" set GEMINI_API_KEY=dummy
if "%TEST_ADMIN_PASSWORD%"=="" set TEST_ADMIN_PASSWORD=dummy
if "%OPENAI_API_KEY%"=="" set OPENAI_API_KEY=sk-test-dummy

REM --- find a working Python. `python3` does not exist on Windows. ---
set PY=
where py >nul 2>&1 && set PY=py -3
if "%PY%"=="" (
    where python >nul 2>&1 && set PY=python
)
if "%PY%"=="" (
    echo.
    echo   No Python found.
    echo.
    echo   If you got the "Microsoft Store" message, that is a stub, not Python.
    echo   Install real Python from https://www.python.org/downloads/windows/
    echo   and tick "Add python.exe to PATH" during setup.
    echo.
    echo   Or skip all of this and use Docker - see
    echo   tests\differential\README.md, section "Windows".
    echo.
    exit /b 1
)

if not exist "server.py" (
    echo.
    echo   Run this from the repo's `backend` directory, e.g.
    echo     cd %%USERPROFILE%%\Radiocheck\backend
    echo.
    exit /b 1
)

%PY% -m tests.differential.cli %*

endlocal
