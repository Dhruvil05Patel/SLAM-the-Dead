import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/dr_engine.dart';
import 'core/feature_tracker.dart';
import 'core/pose_types.dart';
import 'core/slam_engine.dart';
import 'services/camera_service.dart';
import 'services/imu_service.dart';

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
final featureTrackerProvider = Provider<FeatureTracker>(
  (ref) => FeatureTracker(null), // No native plugin needed - using Dart implementation
);
final slamEngineProvider = Provider<SlamEngine>((ref) => SlamEngine(tracker: ref.watch(featureTrackerProvider)));

class FeaturesNotifier extends StateNotifier<List<Map<String, dynamic>>> {
  FeaturesNotifier() : super([]);
  
  int _cameraWidth = 1;
  int _cameraHeight = 1;

  void update(List<Map<String, dynamic>> newFeatures, {int? cameraWidth, int? cameraHeight}) {
    if (cameraWidth != null) _cameraWidth = cameraWidth;
    if (cameraHeight != null) _cameraHeight = cameraHeight;
    state = List<Map<String, dynamic>>.from(newFeatures);
  }
  
  int get cameraWidth => _cameraWidth;
  int get cameraHeight => _cameraHeight;

  void reset() {
    state = [];
    _cameraWidth = 1;
    _cameraHeight = 1;
  }
}

final slamFeaturesProvider = StateNotifierProvider<FeaturesNotifier, List<Map<String, dynamic>>>(
  (ref) => FeaturesNotifier(),
);

class SlamController {
  bool _isRunning = false;
  bool get isRunning => _isRunning;
  
  SlamController(this._cameraService, this._engine, this._history, this._featuresNotifier);

  final CameraService _cameraService;
  final SlamEngine _engine;
  final PoseHistoryNotifier _history;
  final FeaturesNotifier _featuresNotifier;
  List<Map<String, dynamic>> _currentFeatures = [];
  DateTime? _lastProcessTime;
  static const targetFrameInterval = Duration(milliseconds: 100); // 10 FPS
  int _skippedFrames = 0;
  double _lastProcessingMs = 0;

  List<Map<String, dynamic>> get currentFeatures => _currentFeatures;
  double get lastProcessingMs => _lastProcessingMs;
  int get skippedFrames => _skippedFrames;
  double get inlierRatio => _engine.lastInlierRatio;
  int get inlierCount => _engine.lastInlierCount;
  int get matchCount => _engine.lastMatchCount;

  Future<void> start({required List<double> intrinsics}) async {
    _isRunning = true;
    _lastProcessTime = null;
    await _cameraService.startStream(onImage: (img) async {
      // Throttle frame processing to 10 FPS for stability
      final now = DateTime.now();
      if (_lastProcessTime != null && now.difference(_lastProcessTime!) < targetFrameInterval) {
        _skippedFrames++;
        return;
      }
      _lastProcessTime = now;
      
      // Cast and validate image data
      if (img == null) return;
      final image = img;
      if (image.planes.isEmpty) return;
      
      // Process at controlled frame rate
      final bytes = image.planes.expand((p) => p.bytes).toList();
      
      final stopwatch = Stopwatch()..start();
      try {
        await _engine.processFrame(
          bytes: bytes,
          width: image.width,
          height: image.height,
          timestamp: DateTime.now().millisecondsSinceEpoch / 1000.0,
          intrinsics: intrinsics,
        );
        _lastProcessingMs = stopwatch.elapsedMilliseconds.toDouble();
        if (_lastProcessingMs > 90) {
          // Log slow frames for diagnostics
          // ignore: avoid_print
          print('SLAM slow frame: ${_lastProcessingMs.toStringAsFixed(1)} ms');
        }
        
        // Update pose history
        if (_engine.state.poseHistory.isNotEmpty) {
          _history.add(_engine.state.poseHistory.last);
        }
        
        // Update features from last detected features in engine
        final currentFeatures = _engine.getLastDetectedFeatures();
        if (currentFeatures.isNotEmpty) {
          _currentFeatures = currentFeatures;
          _featuresNotifier.update(
            currentFeatures, 
            cameraWidth: image.width,
            cameraHeight: image.height,
          );
        }
      } catch (e) {
        print('Error processing SLAM frame: $e');
      } finally {
        if (stopwatch.isRunning) stopwatch.stop();
      }
    });
  }

  Future<void> stop() {
    _isRunning = false;
    return _cameraService.stop();
  }

  void reset() {
    _engine.reset();
    _history.reset();
    _featuresNotifier.reset();
    _currentFeatures = [];
  }
}

final slamControllerProvider = Provider<SlamController>((ref) {
  return SlamController(
    ref.watch(cameraServiceProvider),
    ref.watch(slamEngineProvider),
    ref.watch(slamHistoryProvider.notifier),
    ref.watch(slamFeaturesProvider.notifier),
  );
});

