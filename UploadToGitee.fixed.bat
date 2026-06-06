@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "BUILD_ROOT=%SCRIPT_DIR%"
set "DEFAULT_UPLOAD_DIR=remote"
set "TEMP_EXPORT_DIR=%TEMP%\wechat_push_export"

echo ============================================
echo   Force Push Selected Build Directory
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 goto :git_error

set /p REMOTE_URL=Remote URL:
if "%REMOTE_URL%"=="" goto :input_error

set /p BRANCH=Branch:
if "%BRANCH%"=="" goto :input_error

echo.
set /p UPLOAD_DIR=Upload dir under build\wechatgame-001 (blank = %DEFAULT_UPLOAD_DIR%):
if "%UPLOAD_DIR%"=="" set "UPLOAD_DIR=%DEFAULT_UPLOAD_DIR%"
if "%UPLOAD_DIR:~0,1%"=="\" set "UPLOAD_DIR=%UPLOAD_DIR:~1%"
if "%UPLOAD_DIR:~0,1%"=="/" set "UPLOAD_DIR=%UPLOAD_DIR:~1%"

set "TARGET_DIR=%UPLOAD_DIR%"
if not exist "%TARGET_DIR%" (
    if exist "%BUILD_ROOT%\%UPLOAD_DIR%" set "TARGET_DIR=%BUILD_ROOT%\%UPLOAD_DIR%"
)
if not exist "%TARGET_DIR%" goto :dir_error

for %%I in ("%TARGET_DIR%") do set "TARGET_DIR=%%~fI"

echo.
echo Build Root : %BUILD_ROOT%
echo Target Dir : %TARGET_DIR%
echo Remote URL : %REMOTE_URL%
echo Branch     : %BRANCH%
echo.

set /p CONFIRM=Only files in Target Dir will be pushed. Continue? (Y/N):
if /I not "%CONFIRM%"=="Y" goto :cancel

for %%I in ("%TARGET_DIR%") do (
    set "TARGET_NAME=%%~nxI"
    set "TARGET_PARENT=%%~dpI"
)

if exist "%TEMP_EXPORT_DIR%" (
    rmdir /s /q "%TEMP_EXPORT_DIR%"
)

mkdir "%TEMP_EXPORT_DIR%" >nul 2>nul
if errorlevel 1 goto :export_error

echo [STEP] copy "%TARGET_DIR%" to "%TEMP_EXPORT_DIR%\%TARGET_NAME%"
xcopy "%TARGET_DIR%" "%TEMP_EXPORT_DIR%\%TARGET_NAME%\" /E /I /Y /Q >nul
if errorlevel 1 goto :export_error

cd /d "%TEMP_EXPORT_DIR%" || goto :export_error

echo [STEP] git init
git init >nul 2>nul
if errorlevel 1 goto :init_error

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 goto :init_error

git config user.name "AAH_Auto_Deploy"
git config user.email "deploy@local.com"

echo [STEP] git add -A
git add -A

set "CURRENT_TIME=%date% %time%"
set "COMMIT_MSG=Auto-Deploy %TARGET_NAME% [%CURRENT_TIME%]"

echo [STEP] git commit
git commit --allow-empty -m "%COMMIT_MSG%" >nul

git branch -M "%BRANCH%" >nul 2>nul

git remote get-url origin >nul 2>nul
if errorlevel 1 (
    git remote add origin "%REMOTE_URL%"
) else (
    git remote set-url origin "%REMOTE_URL%"
)

echo.
echo [STEP] git push -u -f origin %BRANCH%
git push -u -f origin %BRANCH%
if errorlevel 1 goto :push_error

echo.
echo [OK] Push completed.
goto :end

:git_error
echo [ERROR] Git not found in PATH.
goto :end

:input_error
echo [ERROR] Remote URL and branch are required.
goto :end

:dir_error
echo [ERROR] Upload dir not found: %UPLOAD_DIR%
goto :end

:init_error
echo [ERROR] Failed to initialize git repo in target dir.
goto :end

:export_error
echo [ERROR] Failed to prepare export directory.
goto :end

:push_error
echo [ERROR] Push failed. Check remote URL and permissions.
goto :end

:cancel
echo Cancelled.

:end
echo.
pause
