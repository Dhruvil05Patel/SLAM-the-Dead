@echo off
REM Wrapper script to set ANDROID_HOME before running expo prebuild

REM Check for Android SDK in common locations
set "ANDROID_SDK_FOUND=0"
if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
    set "ANDROID_SDK_FOUND=1"
) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk\platform-tools\adb.exe" (
    set "ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk"
    set "ANDROID_SDK_ROOT=%USERPROFILE%\AppData\Local\Android\Sdk"
    set "ANDROID_SDK_FOUND=1"
) else if exist "C:\Android\Sdk\platform-tools\adb.exe" (
    set "ANDROID_HOME=C:\Android\Sdk"
    set "ANDROID_SDK_ROOT=C:\Android\Sdk"
    set "ANDROID_SDK_FOUND=1"
)

if %ANDROID_SDK_FOUND%==1 (
    set "PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools;%ANDROID_HOME%\tools\bin;%PATH%"
    echo [OK] Android SDK found at: %ANDROID_HOME%
    echo.
) else (
    echo [WARNING] Android SDK not found. Attempting to use ANDROID_HOME from environment...
    echo.
    if not defined ANDROID_HOME (
        echo [ERROR] ANDROID_HOME is not set!
        echo Please run setup-android-env.bat or set ANDROID_HOME manually.
        echo.
        pause
        exit /b 1
    )
)

REM Run the expo command with the environment variables set
call expo prebuild %*
