import 'dart_feature_detector.dart';

class FeatureTrack {
  FeatureTrack({required this.points, required this.id});

  final List<List<double>> points; // [x, y] per frame
  final int id;
}

class FeatureTracker {
  FeatureTracker(dynamic plugin) {
    _prevImage = [];
    _currImage = [];
    _prevFeatures = [];
    _currFeatures = [];
  }

  late List<int> _prevImage;
  late List<int> _currImage;
  late List<Map<String, dynamic>> _prevFeatures;
  late List<Map<String, dynamic>> _currFeatures;
  int _frameCount = 0;
  int _width = 320;
  int _height = 240;

  Future<List<Map<String, dynamic>>> detectFeatures(List<int> imageBytes, int width, int height) async {
    try {
      // Validate input
      if (imageBytes.isEmpty || width < 10 || height < 10) {
        return [];
      }

      _width = width;
      _height = height;
      _currImage = List<int>.from(imageBytes);
      
      final features = DartFeatureDetector.detectCorners(imageBytes, width, height);
      
      // Store for next frame's matching
      if (_frameCount == 0) {
        _prevFeatures = List<Map<String, dynamic>>.from(features);
        _prevImage = List<int>.from(imageBytes);
      } else {
        _prevFeatures = List<Map<String, dynamic>>.from(_currFeatures);
        _prevImage = List<int>.from(_currImage);
      }
      
      _currFeatures = List<Map<String, dynamic>>.from(features);
      _frameCount++;
      
      return features;
    } catch (e) {
      print('FeatureTracker.detectFeatures error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> matchFeatures(
    List<Map<String, dynamic>> prev,
    List<Map<String, dynamic>> current,
  ) async {
    try {
      // Validate input
      if (prev.isEmpty || current.isEmpty || _prevImage.isEmpty || _currImage.isEmpty) {
        return [];
      }

      // Use Dart-based feature matching
      return DartFeatureDetector.matchFeatures(
        prev,
        current,
        _prevImage,
        _currImage,
        _width,
        _height,
      );
    } catch (e) {
      print('FeatureTracker.matchFeatures error: $e');
      return [];
    }
  }

  Future<Map<String, dynamic>> estimatePosePnP({
    required List<List<double>> imagePoints,
    required List<List<double>> worldPoints,
    required List<double> intrinsics, // fx, fy, cx, cy
  }) async {
    try {
      // Use Dart-based pose estimation
      return DartFeatureDetector.estimatePose(
        [],
        _prevFeatures,
        _currFeatures,
        intrinsics,
      );
    } catch (e) {
      print('FeatureTracker.estimatePosePnP error: $e');
      return {
        'rotation': [0.0, 0.0, 0.0],
        'translation': [0.0, 0.0, 0.0],
      };
    }
  }
}

