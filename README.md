# SLAM-the-Dead — Flutter (Android & iOS)

Cross-platform Flutter app that compares Dead Reckoning (DR) against monocular Visual SLAM. Three tabs: DR, SLAM, Comparison.

## Architecture
- `lib/core`: math + engines (DR strapdown + Madgwick, SLAM controller, alignment).
- `lib/services`: sensors/camera/native OpenCV plugin wrappers.
- `lib/ui`: tabs, widgets, Riverpod wiring.
- `android/ios`: plugin stubs for OpenCV (feature detect/match/pose).
- `assets/sample_logs`: tiny IMU sample for tests.
- `test`: unit tests for filters and alignment.

Coordinate frame: ENU (X-right, Y-forward, Z-up). Both DR and SLAM output this convention.

## Running
1. Install Flutter 3.4+ and Android/iOS toolchains.
2. `flutter pub get`
3. Run tests: `flutter test`
4. Launch: `flutter run` (pick device/emulator). Camera/motion permissions required.

## Features
- DR tab: strapdown integration with Madgwick orientation, live trajectory plot, heading/velocity readout, start/stop/reset.
- SLAM tab: camera preview, feature overlay toggle, trajectory plot, start/stop/reset; delegates heavy CV to native OpenCV via platform channel.
- Comparison tab: overlays DR/SLAM, Umeyama alignment, RMSE/drift metrics, short auto analysis note.

## Native CV plugin (skeleton)
MethodChannel `native_cv` with methods:
- `detectFeatures(bytes, width, height)`
- `matchFeatures(prev, current)`
- `estimatePosePnP(imagePoints, worldPoints, intrinsics=[fx,fy,cx,cy])`

Implement using OpenCV (ORB/FAST+BRIEF, BFMatcher, solvePnP). Add LiDAR hooks similarly.

## Calibration & Safety
- Expose IMU bias settings in UI (placeholder). For best DR results, keep device still for 2–3s before start; tune `beta` in `MadgwickFilter`.
- Data stays on-device; no upload occurs unless you add it.

## Extending
- Swap Madgwick for EKF/UKF in `core/dr_engine.dart`.
- Add loop closure / pose graph optimization in `core/slam_engine.dart`.
- Persist and replay sessions from `assets/sample_logs` using `path_provider`.

## Known gaps / TODOs
- Native OpenCV implementation not provided here; stubs only.
- Feature overlay currently not rendering tracked points (wire after plugin returns pts).
- Add LiDAR channel for iOS Pro devices.

