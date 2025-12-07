import 'dart:ui' as ui;
import 'package:flutter/material.dart';

class FeaturePainter extends CustomPainter {
  final List<Offset> features;
  final Color color;
  final double pointSize;

  FeaturePainter({
    required this.features,
    this.color = Colors.cyan,
    this.pointSize = 4.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = pointSize
      ..strokeCap = StrokeCap.round;

    // Draw each feature point
    for (final feature in features) {
      canvas.drawPoints(
        ui.PointMode.points,
        [feature],
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(FeaturePainter oldDelegate) {
    return oldDelegate.features != features ||
        oldDelegate.color != color ||
        oldDelegate.pointSize != pointSize;
  }
}
