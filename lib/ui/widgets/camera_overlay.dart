import 'package:flutter/material.dart';

class CameraOverlay extends StatelessWidget {
  const CameraOverlay({super.key, required this.showFeatures, required this.features});

  final bool showFeatures;
  final List<Offset> features;

  @override
  Widget build(BuildContext context) {
    if (!showFeatures) return const SizedBox.shrink();
    return CustomPaint(
      painter: _FeaturePainter(features),
    );
  }
}

class _FeaturePainter extends CustomPainter {
  _FeaturePainter(this.features);

  final List<Offset> features;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.greenAccent
      ..strokeWidth = 2;
    for (final f in features) {
      canvas.drawCircle(f, 3, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _FeaturePainter oldDelegate) {
    return oldDelegate.features != features;
  }
}

