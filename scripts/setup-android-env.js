/**
 * Script to detect and set Android SDK environment variables
 * This helps resolve the "Failed to resolve Android SDK path" error
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const commonPaths = [
  path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
  path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'),
  'C:\\Android\\Sdk',
  path.join(process.env['ProgramFiles'] || '', 'Android', 'Android Studio', 'sdk'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Android', 'android-sdk'),
];

function findAndroidSDK() {
  for (const sdkPath of commonPaths) {
    if (sdkPath && fs.existsSync(sdkPath)) {
      const adbPath = path.join(sdkPath, 'platform-tools', 'adb.exe');
      if (fs.existsSync(adbPath)) {
        return sdkPath;
      }
    }
  }
  return null;
}

function setAndroidEnv() {
  const sdkPath = findAndroidSDK();
  
  if (sdkPath) {
    process.env.ANDROID_HOME = sdkPath;
    process.env.ANDROID_SDK_ROOT = sdkPath;
    
    // Add platform-tools to PATH if not already there
    const platformTools = path.join(sdkPath, 'platform-tools');
    const tools = path.join(sdkPath, 'tools');
    const toolsBin = path.join(sdkPath, 'tools', 'bin');
    
    const pathSep = process.platform === 'win32' ? ';' : ':';
    let currentPath = process.env.PATH || '';
    
    if (!currentPath.includes(platformTools)) {
      process.env.PATH = `${platformTools}${pathSep}${currentPath}`;
    }
    if (!currentPath.includes(tools)) {
      process.env.PATH = `${tools}${pathSep}${process.env.PATH}`;
    }
    if (!currentPath.includes(toolsBin)) {
      process.env.PATH = `${toolsBin}${pathSep}${process.env.PATH}`;
    }
    
    console.log(`[OK] Android SDK found at: ${sdkPath}`);
    console.log(`[OK] ANDROID_HOME set to: ${sdkPath}`);
    return true;
  } else {
    console.error('[ERROR] Android SDK not found in common locations!');
    console.error('');
    console.error('Please install Android Studio or set ANDROID_HOME manually:');
    console.error('  Windows: set ANDROID_HOME=C:\\path\\to\\android\\sdk');
    console.error('  Or run: setup-android-env.bat');
    return false;
  }
}

// If run directly, set the environment
if (require.main === module) {
  const success = setAndroidEnv();
  process.exit(success ? 0 : 1);
}

// Export for use in other scripts
module.exports = { setAndroidEnv, findAndroidSDK };
