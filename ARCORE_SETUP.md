# Enabling ARCore Support on Samsung A73 5G

## Why ARCore shows "not available"

Your Samsung A73 5G **fully supports ARCore**, but the native ARCore module cannot run in **Expo Go** because custom native modules aren't compiled. The app currently falls back to simulated SLAM.

## Solution: Create a Development Build

To enable ARCore on your device, you need to build a custom development build (not Expo Go).

### Prerequisites

1. **Android Studio** installed with Android SDK
2. **EAS CLI** (Expo Application Services): `npm install -g eas-cli`
3. **Google ARCore** app installed on your device (usually pre-installed)

---

## Option A: Build Locally with Expo (Faster)

### 1. Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### 2. Create EAS build configuration
```bash
eas build:configure
```

### 3. Build a development build
```bash
# IMPORTANT: Connect your Samsung A73 via USB first!
# Enable USB Debugging: Settings > Developer Options > USB Debugging

# Verify device is connected:
adb devices
# Should show your Samsung A73 device

# Option 1: Local build (builds on your Mac, faster)
eas build --profile development --platform android --local

# Option 2: Cloud build (no Android SDK needed, but slower)
eas build --profile development --platform android
```

### 4. Install the APK on your Samsung A73
```bash
# If built locally, the APK will be in the current directory
# Install directly:
adb install -r SmartNav-*.apk

# If cloud build, download APK from EAS dashboard and then:
adb install -r /path/to/downloaded.apk

# OR simply copy the APK to your phone and tap to install
```

### 5. Run with your development build
```bash
npx expo start --dev-client
```

Your device will now load the custom build with ARCore native module registered!

---

## Option B: Prebuild and Build with Android Studio

### 1. Prebuild native Android project
```bash
npx expo prebuild --platform android
```

### 2. Register the ARCore module

Edit `android/app/src/main/java/com/smartnav/app/MainApplication.kt` (or `.java`):

```kotlin
import com.smartnav.arcore.ARCorePackage  // Add this import

override fun getPackages(): List<ReactPackage> {
  return PackageList(this).packages.apply {
    add(ARCorePackage())  // Register ARCore module
  }
}
```

### 3. Copy native ARCore module files

Copy these files into your Android project:
```bash
# Create module directory
mkdir -p android/app/src/main/java/com/smartnav/arcore

# Copy Java files
cp native/arcore/android/ARCoreModule.java android/app/src/main/java/com/smartnav/arcore/
cp native/arcore/android/ARCorePackage.java android/app/src/main/java/com/smartnav/arcore/
```

### 4. Build with Android Studio

```bash
cd android
./gradlew assembleDebug
```

### 5. Install and run
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
npx expo start
```

---

## Verify ARCore is Working

Once running on a development build:

1. Open the **SLAM** tab in SmartNav
2. Check logs: You should see `Selected SLAM provider: arcore` instead of `simulated`
3. ARCore will initialize and start providing real pose data

### Check device ARCore support
Verify your Samsung A73 is ARCore-compatible:
- Install **Google Play Services for AR** from Play Store (if not pre-installed)
- Visit: https://developers.google.com/ar/devices
- Samsung Galaxy A73 5G is officially supported ✅

---

## Configuration Files

The following config is already set up for you:

- **app.json**: ARCore plugin registered
- **plugins/withARCore.js**: Config plugin to add ARCore dependencies
- **native/arcore/android/ARCoreModule.java**: Native bridge (returns false in Expo Go)

---

## Quick Start (Recommended)

```bash
# 1. Install EAS CLI
npm install -g eas-cli
eas login

# 2. Configure project
eas build:configure

# 3. Build for Android
eas build --profile development --platform android

# 4. Download and install APK on Samsung A73
# 5. Run dev server
npx expo start --dev-client
```

---

## Troubleshooting

### "Google Play Services for AR not installed"
- Install from Play Store: https://play.google.com/store/apps/details?id=com.google.ar.core

### "ARCore not supported"
- Samsung A73 5G is supported - check Android version is up to date

### Build errors
- Ensure Android SDK is installed: `npx expo-doctor`
- Clear cache: `npx expo start --clear`

### Still showing "simulated"?
- Check you're running the **development build**, not Expo Go
- Look for "Selected SLAM provider: arcore" in terminal logs

---

## Summary

✅ Your Samsung A73 5G supports ARCore  
❌ ARCore doesn't work in Expo Go  
✅ Build a development build to enable ARCore  
✅ Config plugin is ready (app.json)  
✅ Use EAS Build for easiest setup
