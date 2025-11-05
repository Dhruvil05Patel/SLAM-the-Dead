# Quick Build Guide - Development APK for Samsung A73 5G

## Current Status
✅ EAS CLI installed  
✅ expo-dev-client installed  
✅ EAS config ready (eas.json)  
❌ Need to connect Samsung A73 device  
❌ Need to build APK  

---

## Step-by-Step Instructions

### Step 1: Connect Your Samsung A73 5G

1. **Enable Developer Options** on your phone:
   - Go to **Settings → About Phone**
   - Tap **Build Number** 7 times
   - You'll see "You are now a developer!"

2. **Enable USB Debugging**:
   - Go to **Settings → Developer Options**
   - Enable **USB Debugging**
   - Enable **Install via USB** (if available)

3. **Connect via USB cable** to your Mac

4. **Verify connection**:
   ```bash
   adb devices
   ```
   You should see your Samsung A73 device listed (not just emulator-5554)

---

### Step 2: Choose Build Method

#### Option A: Local Build (Faster - Requires Android SDK)
```bash
# Check if you have Android SDK
which sdkmanager

# If yes, build locally:
eas build --profile development --platform android --local
```

**Pros**: Faster, no upload/download  
**Cons**: Needs Android Studio/SDK setup  

#### Option B: Cloud Build (Easier - Recommended)
```bash
# Login to EAS (if not already)
eas login

# Start cloud build
eas build --profile development --platform android
```

**Pros**: No Android SDK needed, works on any Mac  
**Cons**: Takes 10-15 minutes (upload + build + download)  

---

### Step 3: Install APK

#### If Local Build:
```bash
# APK will be in current directory as: SmartNav-<hash>.apk
# Install directly:
adb install -r SmartNav-*.apk
```

#### If Cloud Build:
1. Wait for build to complete (you'll get email notification)
2. Download APK from EAS dashboard: https://expo.dev
3. Install:
   ```bash
   adb install -r ~/Downloads/SmartNav-*.apk
   ```
   
   **OR** simply copy APK to phone and tap to install

---

### Step 4: Run the App

```bash
npx expo start --dev-client
```

- Your Samsung A73 should auto-open the app
- If not, manually open "SmartNav" app on your phone
- Go to **SLAM** tab
- You should see: **"Selected SLAM provider: arcore"** in terminal logs! 🎉

---

## Troubleshooting

### "adb devices" shows no device or "unauthorized"
- Check USB cable (try another one)
- On phone: Allow USB debugging when prompted
- Run: `adb kill-server && adb start-server`

### Local build fails with "Android SDK not found"
- Use cloud build instead: `eas build --profile development --platform android`
- OR install Android Studio: https://developer.android.com/studio

### Build fails with "Account not configured"
- Run: `eas login`
- Create free Expo account at: https://expo.dev

### App installs but crashes immediately
- Check logs: `adb logcat | grep SmartNav`
- Try: `npx expo start --dev-client --clear`

### Still shows "simulated" instead of "arcore"
- Make sure you installed the **development build**, not regular APK
- Check app name: Should say "SmartNav (development)" on phone
- Look for this log: `Selected SLAM provider: arcore`

---

## Quick Command Reference

```bash
# Check connected devices
adb devices

# Build locally (fast)
eas build --profile development --platform android --local

# Build on cloud (easier)
eas build --profile development --platform android

# Install APK
adb install -r SmartNav-*.apk

# Run dev server
npx expo start --dev-client

# View logs
adb logcat | grep -i smartnav
```

---

## Expected Timeline

- **Local build**: 5-10 minutes
- **Cloud build**: 15-25 minutes
- **Install + Test**: 2-3 minutes

**Total: ~10-30 minutes** depending on method

---

## What to Expect After Installation

✅ App icon labeled "SmartNav (development)" on phone  
✅ Can't run without dev server (`npx expo start --dev-client`)  
✅ ARCore will initialize on SLAM tab  
✅ Real pose tracking from camera  
✅ Much more accurate than simulated SLAM  

Good luck! 🚀
