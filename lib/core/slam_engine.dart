import 'dart:math' as math;

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
  static const double minTranslationThreshold = 0.1; // Minimum motion to accept
  List<Map<String, dynamic>> _lastDetectedFeatures = [];
  int _lastWidth = 0;
  int _lastHeight = 0;
  
  // Temporal smoothing
  Vector3 _smoothedVelocity = Vector3.zero();
  static const double smoothingFactor = 0.3; // EMA smoothing
  double _lastInlierRatio = 0.0;
  int _lastInlierCount = 0;
  int _lastMatchCount = 0;

  SlamState get state => _state;
  
  /// Get the last detected features
  List<Map<String, dynamic>> getLastDetectedFeatures() => _lastDetectedFeatures;
  
  /// Get the last image dimensions
  int get lastWidth => _lastWidth;
  int get lastHeight => _lastHeight;
  double get lastInlierRatio => _lastInlierRatio;
  int get lastInlierCount => _lastInlierCount;
  int get lastMatchCount => _lastMatchCount;

  /// Called when a new camera frame is available.
  Future<void> processFrame({
    required List<int> bytes,
    required int width,
    required int height,
    required double timestamp,
    List<double>? intrinsics,
  }) async {
    try {
      // Validate inputs
      if (bytes.isEmpty || width < 10 || height < 10) return;
      if (intrinsics == null || intrinsics.isEmpty) return;

      // Store image dimensions
      _lastWidth = width;
      _lastHeight = height;

      final features = await _tracker.detectFeatures(bytes, width, height);
      
      // Store detected features for UI display
      _lastDetectedFeatures = List<Map<String, dynamic>>.from(features);
      
      if (features.isEmpty) return;

      // Initialize with first frame
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
      
      if (matches.isEmpty || matches.length < 4) {
        // Not enough matches - continue with last estimated pose
        final lastPose = _state.poseHistory.isNotEmpty ? _state.poseHistory.last : lastKf.pose;
        _state.poseHistory.add(lastPose.copyWith(timestamp: timestamp));
        return;
      }

      // Extract matched points with validation
      final imagePoints = <List<double>>[];
      final worldPoints = <List<double>>[];
      
      for (final m in matches) {
        try {
          final idxPrev = (m['prevIndex'] as int?) ?? 0;
          final idxCurr = (m['currIndex'] as int?) ?? 0;
          
          if (idxPrev >= lastKf.features.length || idxCurr >= features.length) continue;
          
          final prevPt = lastKf.features[idxPrev]['pt'] as List<dynamic>? ?? [0.0, 0.0];
          final currPt = features[idxCurr]['pt'] as List<dynamic>? ?? [0.0, 0.0];
          
          final px = (prevPt[0] as num).toDouble();
          final py = (prevPt[1] as num).toDouble();
          final cx = (currPt[0] as num).toDouble();
          final cy = (currPt[1] as num).toDouble();
          
          // Validate points are within image bounds
          if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
          if (px < 0 || px >= width || py < 0 || py >= height) continue;
          
          imagePoints.add([cx, cy]);
          worldPoints.add([px, py, 1.0]);
        } catch (e) {
          print('Error processing match: $e');
          continue;
        }
      }

      if (imagePoints.length < 4) {
        final lastPose = _state.poseHistory.isNotEmpty ? _state.poseHistory.last : lastKf.pose;
        _state.poseHistory.add(lastPose.copyWith(timestamp: timestamp));
        return;
      }

      final poseResp = await _tracker.estimatePosePnP(
        imagePoints: imagePoints,
        worldPoints: worldPoints,
        intrinsics: intrinsics,
      );

      // Store quality metrics if provided
      _lastInlierRatio = (poseResp['inlierRatio'] as num?)?.toDouble() ?? _lastInlierRatio;
      _lastInlierCount = (poseResp['inlierCount'] as num?)?.toInt() ?? _lastInlierCount;
      _lastMatchCount = (poseResp['matchCount'] as num?)?.toInt() ?? _lastMatchCount;

      final translation = poseResp['translation'] as List<dynamic>? ?? [0.0, 0.0, 0.0];
      
      try {
        final dx = (translation[0] as num).toDouble();
        final dy = (translation[1] as num).toDouble();
        final dz = (translation[2] as num).toDouble();
        
        final rawVelocity = Vector3(dx, dy, dz);
        final speed = rawVelocity.length;
        
        // Outlier rejection: reject if movement is too large (likely error)
        Vector3 velocity;
        if (speed > 0.5) {
          // Likely an outlier, use smoothed velocity
          velocity = _smoothedVelocity;
        } else {
          // Apply exponential moving average smoothing
          velocity = _smoothedVelocity * (1 - smoothingFactor) + rawVelocity * smoothingFactor;
          _smoothedVelocity = velocity;
        }
        
        final lastPose = _state.poseHistory.isNotEmpty ? _state.poseHistory.last : lastKf.pose;
        final newPosition = lastPose.position + velocity;
        
        final pose = Pose(
          timestamp: timestamp,
          position: newPosition,
          orientation: lastPose.orientation,
        );

        _state.poseHistory.add(pose);
        
        if (_shouldCreateKeyframe(pose)) {
          _addKeyframe(pose: pose, features: features);
        }
      } catch (e) {
        print('Error creating pose: $e');
        final lastPose = _state.poseHistory.isNotEmpty ? _state.poseHistory.last : lastKf.pose;
        _state.poseHistory.add(lastPose.copyWith(timestamp: timestamp));
      }
    } catch (e) {
      print('SlamEngine.processFrame error: $e');
    }
  }

  bool _shouldCreateKeyframe(Pose pose) {
    if (_state.keyframes.isEmpty) return true;
    final last = _state.keyframes.last.pose;
    final trans = (pose.position - last.position).length;
    
    // Compute angle between quaternions
    final qa = pose.orientation;
    final qb = last.orientation;
    final dot = (qa.w * qb.w + qa.x * qb.x + qa.y * qb.y + qa.z * qb.z)
        .clamp(-1.0, 1.0);
    final ang = 2.0 * math.acos(dot.abs());
    
    // Create keyframe with smaller threshold for better tracking
    return trans > 0.15 || ang > 3 * (3.1415 / 180);
  }

  void _addKeyframe({required Pose pose, required List<Map<String, dynamic>> features}) {
    _state.keyframes.add(Keyframe(pose: pose, features: features));
    _state.poseHistory.add(pose);
  }

  void reset() {
    _state = SlamState(poseHistory: [], keyframes: [], tracks: []);
  }
}

