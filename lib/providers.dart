import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vector_math/vector_math_64.dart';

import 'core/dr_engine.dart';
import 'core/feature_tracker.dart';
import 'core/pose_types.dart';
import 'core/slam_engine.dart';
import 'services/camera_service.dart';
import 'services/imu_service.dart';
import 'services/native_cv_plugin.dart';

final imuServiceProvider = Provider<ImuService>((ref) => ImuService());
final drEngineProvider = Provider<DeadReckoningEngine>((ref) => DeadReckoningEngine());

class PoseHistoryNotifier extends StateNotifier<List<Pose>> {
  PoseHistoryNotifier() : super([]);

  void add(Pose pose) {
    state = [...state, pose];
  }

  void reset() {
    state = [];
  }
}

final drHistoryProvider = StateNotifierProvider<PoseHistoryNotifier, List<Pose>>(
  (ref) => PoseHistoryNotifier(),
);

final slamHistoryProvider = StateNotifierProvider<PoseHistoryNotifier, List<Pose>>(
  (ref) => PoseHistoryNotifier(),
);

class DrController {
  DrController(this._engine, this._imuService, this._history);

  final DeadReckoningEngine _engine;
  final ImuService _imuService;
  final PoseHistoryNotifier _history;
  StreamSubscription? _sub;
  double? _lastTs;

  Future<void> start() async {
    await _imuService.start(onSample: (sample) {
      final dt = _lastTs != null ? (sample.timestamp - _lastTs!) : 0.01;
      _lastTs = sample.timestamp;
      final state = _engine.processSample(
        timestamp: sample.timestamp,
        accel: sample.accel,
        gyro: sample.gyro,
        dt: dt,
      );
      _history.add(state.pose);
    });
  }

  Future<void> stop() async {
    await _imuService.stop();
    _sub?.cancel();
    _sub = null;
  }

  void reset() {
    _engine.reset();
    _history.reset();
    _lastTs = null;
  }
}

final drControllerProvider = Provider<DrController>((ref) {
  return DrController(
    ref.watch(drEngineProvider),
    ref.watch(imuServiceProvider),
    ref.watch(drHistoryProvider.notifier),
  );
});

final cameraServiceProvider = Provider<CameraService>((ref) => CameraService());
final nativeCvPluginProvider = Provider<NativeCvPlugin>((ref) => NativeCvPlugin());
final featureTrackerProvider = Provider<FeatureTracker>((ref) => FeatureTracker(ref.watch(nativeCvPluginProvider)));
final slamEngineProvider = Provider<SlamEngine>((ref) => SlamEngine(tracker: ref.watch(featureTrackerProvider)));

class SlamController {
  SlamController(this._cameraService, this._engine, this._history);

  final CameraService _cameraService;
  final SlamEngine _engine;
  final PoseHistoryNotifier _history;

  Future<void> start({required List<double> intrinsics}) async {
    await _cameraService.startStream(onImage: (image) async {
      final bytes = image.planes.expand((p) => p.bytes).toList();
      await _engine.processFrame(
        bytes: bytes,
        width: image.width,
        height: image.height,
        timestamp: DateTime.now().millisecondsSinceEpoch / 1000.0,
        intrinsics: intrinsics,
      );
      if (_engine.state.poseHistory.isNotEmpty) {
        _history.add(_engine.state.poseHistory.last);
      }
    });
  }

  Future<void> stop() => _cameraService.stop();

  void reset() {
    _engine.reset();
    _history.reset();
  }
}

final slamControllerProvider = Provider<SlamController>((ref) {
  return SlamController(
    ref.watch(cameraServiceProvider),
    ref.watch(slamEngineProvider),
    ref.watch(slamHistoryProvider.notifier),
  );
});

