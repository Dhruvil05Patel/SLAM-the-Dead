import '../services/native_cv_plugin.dart';

class FeatureTrack {
  FeatureTrack({required this.points, required this.id});

  final List<List<double>> points; // [x, y] per frame
  final int id;
}

class FeatureTracker {
  FeatureTracker(this._plugin);

  final NativeCvPlugin _plugin;

  Future<List<Map<String, dynamic>>> detectFeatures(List<int> imageBytes, int width, int height) {
    return _plugin.detectFeatures(imageBytes: imageBytes, width: width, height: height);
  }

  Future<List<Map<String, dynamic>>> matchFeatures(
    List<Map<String, dynamic>> prev,
    List<Map<String, dynamic>> current,
  ) {
    return _plugin.matchFeatures(prev, current);
  }

  Future<Map<String, dynamic>> estimatePosePnP({
    required List<List<double>> imagePoints,
    required List<List<double>> worldPoints,
    required List<double> intrinsics, // fx, fy, cx, cy
  }) {
    return _plugin.estimatePosePnP(
      imagePoints: imagePoints,
      worldPoints: worldPoints,
      intrinsics: intrinsics,
    );
  }
}

