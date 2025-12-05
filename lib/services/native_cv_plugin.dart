import 'package:flutter/services.dart';

class NativeCvPlugin {
  static const _channel = MethodChannel('native_cv');

  Future<List<Map<String, dynamic>>> detectFeatures({
    required List<int> imageBytes,
    required int width,
    required int height,
  }) async {
    final result = await _channel.invokeMethod<List<dynamic>>('detectFeatures', {
      'bytes': imageBytes,
      'width': width,
      'height': height,
    });
    return result?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<List<Map<String, dynamic>>> matchFeatures(
    List<Map<String, dynamic>> prev,
    List<Map<String, dynamic>> current,
  ) async {
    final result = await _channel.invokeMethod<List<dynamic>>('matchFeatures', {
      'prev': prev,
      'current': current,
    });
    return result?.cast<Map<String, dynamic>>() ?? [];
  }

  Future<Map<String, dynamic>> estimatePosePnP({
    required List<List<double>> imagePoints,
    required List<List<double>> worldPoints,
    required List<double> intrinsics,
  }) async {
    final result = await _channel.invokeMethod<Map<dynamic, dynamic>>('estimatePosePnP', {
      'imagePoints': imagePoints,
      'worldPoints': worldPoints,
      'intrinsics': intrinsics,
    });
    return result?.cast<String, dynamic>() ?? {};
  }
}

