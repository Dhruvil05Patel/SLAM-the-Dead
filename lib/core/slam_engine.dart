import 'package:vector_math/vector_math_64.dart';

import 'feature_tracker.dart';
import 'pose_types.dart';

class Keyframe {
  Keyframe({required this.pose, required this.features});

  final Pose pose;
  final List<Map<String, dynamic>> features;
}

class SlamState {
  SlamState({
    required this.poseHistory,
    required this.keyframes,
    required this.tracks,
  });

  final List<Pose> poseHistory;
  final List<Keyframe> keyframes;
  final List<FeatureTrack> tracks;
}

class SlamEngine {
  SlamEngine({required FeatureTracker tracker})
      : _tracker = tracker,
        _state = SlamState(poseHistory: [], keyframes: [], tracks: []);

  final FeatureTracker _tracker;
  SlamState _state;

  SlamState get state => _state;

  /// Called when a new camera frame is available.
  Future<void> processFrame({
    required List<int> bytes,
    required int width,
    required int height,
    required double timestamp,
    List<double>? intrinsics,
  }) async {
    if (intrinsics == null) return;
    final features = await _tracker.detectFeatures(bytes, width, height);
    if (_state.keyframes.isEmpty) {
      _addKeyframe(
        pose: Pose(
          timestamp: timestamp,
          position: Vector3.zero(),
          orientation: Quaternion.identity(),
        ),
        features: features,
      );
      return;
    }

    final lastKf = _state.keyframes.last;
    final matches = await _tracker.matchFeatures(lastKf.features, features);
    final imagePoints = <List<double>>[];
    final worldPoints = <List<double>>[];
    for (final m in matches) {
      final idxPrev = m['prevIndex'] as int? ?? 0;
      final idxCurr = m['currIndex'] as int? ?? 0;
      final prevPt = lastKf.features[idxPrev]['pt'] as List<dynamic>? ?? [0.0, 0.0];
      final currPt = features[idxCurr]['pt'] as List<dynamic>? ?? [0.0, 0.0];
      imagePoints.add([currPt[0] as double, currPt[1] as double]);
      // Placeholder 3D points (monocular scale unknown) – assume small baseline.
      worldPoints.add([prevPt[0] as double, prevPt[1] as double, 1.0]);
    }

    if (imagePoints.length < 6) return;

    final poseResp = await _tracker.estimatePosePnP(
      imagePoints: imagePoints,
      worldPoints: worldPoints,
      intrinsics: intrinsics,
    );

    final translation = poseResp['translation'] as List<dynamic>? ?? [0.0, 0.0, 0.0];
    final rotationVec = poseResp['rotation'] as List<dynamic>? ?? [0.0, 0.0, 0.0];
    final pose = _poseFromPnP(
      timestamp: timestamp,
      rvec: rotationVec.cast<double>(),
      tvec: translation.cast<double>(),
    );

    _state.poseHistory.add(pose);
    if (_shouldCreateKeyframe(pose)) {
      _addKeyframe(pose: pose, features: features);
    }
  }

  Pose _poseFromPnP({
    required double timestamp,
    required List<double> rvec,
    required List<double> tvec,
  }) {
    final angle = rvec.isNotEmpty ? rvec.reduce((a, b) => a + b) : 0;
    final axis = rvec.length >= 3 ? Vector3(rvec[0], rvec[1], rvec[2]) : Vector3.zero();
    final q = axis.length > 1e-6 ? Quaternion.axisAngle(axis.normalized(), angle) : Quaternion.identity();
    return Pose(
      timestamp: timestamp,
      position: Vector3.array(tvec),
      orientation: q,
    );
  }

  bool _shouldCreateKeyframe(Pose pose) {
    if (_state.keyframes.isEmpty) return true;
    final last = _state.keyframes.last.pose;
    final trans = (pose.position - last.position).length;
    final ang = pose.orientation.angleTo(last.orientation);
    return trans > 0.25 || ang > 5 * (3.1415 / 180);
  }

  void _addKeyframe({required Pose pose, required List<Map<String, dynamic>> features}) {
    _state.keyframes.add(Keyframe(pose: pose, features: features));
    _state.poseHistory.add(pose);
  }

  void reset() {
    _state = SlamState(poseHistory: [], keyframes: [], tracks: []);
  }
}

