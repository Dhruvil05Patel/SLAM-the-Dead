@echo off
echo ========================================
echo  SLAM the Dead - Quick Setup Script
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node --version
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed!
    pause
    exit /b 1
)

echo [OK] npm found:
npm --version
echo.

echo ========================================
echo  Installing dependencies...
echo ========================================
echo.

npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to install dependencies!
    echo Try running: npm install --legacy-peer-deps
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Checking Android SDK...
echo ========================================
echo.

REM Check for Android SDK
set "ANDROID_SDK_FOUND=0"
if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
    set "ANDROID_SDK_FOUND=1"
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
) else if exist "%USERPROFILE%\AppData\Local\Android\Sdk\platform-tools\adb.exe" (
    set "ANDROID_SDK_FOUND=1"
    set "ANDROID_HOME=%USERPROFILE%\AppData\Local\Android\Sdk"
) else if exist "C:\Android\Sdk\platform-tools\adb.exe" (
    set "ANDROID_SDK_FOUND=1"
    set "ANDROID_HOME=C:\Android\Sdk"
)

if %ANDROID_SDK_FOUND%==1 (
    echo [OK] Android SDK found at: %ANDROID_HOME%
    echo.
    echo Setting ANDROID_HOME for this session...
    set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
    set "PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools;%PATH%"
) else (
    echo [WARNING] Android SDK not found in default locations.
    echo.
    echo If you plan to build for Android, you need to:
    echo   1. Install Android Studio from: https://developer.android.com/studio
    echo   2. Or run setup-android-env.bat to configure Android SDK path
    echo   3. Or set ANDROID_HOME environment variable manually
    echo.
)

echo.
echo ========================================
echo  Setup Complete! 
echo ========================================
echo.
echo Next steps:
echo 1. Install Expo Go on your phone:
echo    - Android: https://play.google.com/store/apps/details?id=host.exp.exponent
echo    - iOS: https://apps.apple.com/app/expo-go/id982107779
echo.
echo 2. Start the development server:
echo    npm start
echo.
echo 3. Scan the QR code with Expo Go (Android) or Camera (iOS)
echo.
echo For Android development:
echo   - Run setup-android-env.bat to configure Android SDK
echo   - Or set ANDROID_HOME environment variable manually
echo.
echo For detailed instructions, see: MOBILE_DEPLOYMENT_GUIDE.md
echo.
pause
