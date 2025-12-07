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
echo For detailed instructions, see: MOBILE_DEPLOYMENT_GUIDE.md
echo.
pause
