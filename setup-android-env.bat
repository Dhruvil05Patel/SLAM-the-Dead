@echo off
setlocal enabledelayedexpansion
REM Script to set up Android SDK environment variables for Expo/React Native
REM This script detects Android SDK and sets ANDROID_HOME for the current session

echo ========================================
echo  Android SDK Environment Setup
echo ========================================
echo.

set "FOUND_SDK="

REM Check each potential SDK location
if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
    set "FOUND_SDK=%LOCALAPPDATA%\Android\Sdk"
    goto :found
)
if exist "%USERPROFILE%\AppData\Local\Android\Sdk\platform-tools\adb.exe" (
    set "FOUND_SDK=%USERPROFILE%\AppData\Local\Android\Sdk"
    goto :found
)
if exist "C:\Android\Sdk\platform-tools\adb.exe" (
    set "FOUND_SDK=C:\Android\Sdk"
    goto :found
)
if exist "%ProgramFiles%\Android\Android Studio\sdk\platform-tools\adb.exe" (
    set "FOUND_SDK=%ProgramFiles%\Android\Android Studio\sdk"
    goto :found
)
if exist "%ProgramFiles(x86)%\Android\android-sdk\platform-tools\adb.exe" (
    set "FOUND_SDK=%ProgramFiles(x86)%\Android\android-sdk"
    goto :found
)

:found
if defined FOUND_SDK (
    set "SDK_PATH=!FOUND_SDK!"
    endlocal
    echo [OK] Android SDK found at: %SDK_PATH%
    echo.
    echo Setting environment variables for this session...
    set "ANDROID_HOME=%SDK_PATH%"
    set "ANDROID_SDK_ROOT=%SDK_PATH%"
    set "PATH=%SDK_PATH%\platform-tools;%SDK_PATH%\tools;%SDK_PATH%\tools\bin;%PATH%"
    echo.
    echo ANDROID_HOME=%ANDROID_HOME%
    echo ANDROID_SDK_ROOT=%ANDROID_SDK_ROOT%
    echo.
    echo [SUCCESS] Android SDK environment variables set!
    echo.
    echo NOTE: These variables are set for this terminal session only.
    echo To make them permanent, add them to your system environment variables:
    echo   1. Open System Properties ^> Environment Variables
    echo   2. Add ANDROID_HOME = %ANDROID_HOME%
    echo   3. Add ANDROID_SDK_ROOT = %ANDROID_SDK_ROOT%
    echo   4. Add to PATH: %ANDROID_HOME%\platform-tools
    echo.
    pause
    exit /b 0
) else (
    endlocal
    echo [ERROR] Android SDK not found in common locations!
    echo.
    echo Please install Android Studio or the Android SDK from:
    echo   https://developer.android.com/studio
    echo.
    echo Or if you have Android SDK installed elsewhere, set ANDROID_HOME manually:
    echo   set ANDROID_HOME=C:\path\to\your\android\sdk
    echo.
    echo Common installation locations:
    echo   - %LOCALAPPDATA%\Android\Sdk
    echo   - %USERPROFILE%\AppData\Local\Android\Sdk
    echo   - C:\Android\Sdk
    echo.
    pause
    exit /b 1
)
