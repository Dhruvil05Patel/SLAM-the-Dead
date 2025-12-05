import 'dart:async';

import 'package:camera/camera.dart';

class CameraService {
  CameraController? _controller;
  StreamSubscription<CameraImage>? _imageSub;

  CameraController? get controller => _controller;

  Future<void> init() async {
    final cameras = await availableCameras();
    _controller = CameraController(
      cameras.first,
      ResolutionPreset.medium,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.yuv420,
    );
    await _controller!.initialize();
  }

  Future<void> startStream({
    required void Function(CameraImage image) onImage,
  }) async {
    if (_controller == null) {
      await init();
    }
    _imageSub = _controller!.startImageStream(onImage);
  }

  Future<void> stop() async {
    await _imageSub?.cancel();
    _imageSub = null;
    await _controller?.dispose();
    _controller = null;
  }
}

