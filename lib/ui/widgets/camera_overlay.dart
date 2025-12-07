import 'package:flutter/material.dart';

class CameraOverlay extends StatelessWidget {
  const CameraOverlay({
    super.key, 
    required this.showFeatures, 
    required this.features,
    this.cameraWidth = 1,
    this.cameraHeight = 1,
  });

  final bool showFeatures;
  final List<Offset> features;
  final double cameraWidth;
  final double cameraHeight;

  @override
  Widget build(BuildContext context) {
    if (!showFeatures || features.isEmpty) return const SizedBox.shrink();
    return CustomPaint(
      painter: _FeaturePainter(
        features, 
        cameraWidth: cameraWidth,
        cameraHeight: cameraHeight,
      ),
      size: Size.infinite,
    );
  }
}

class _FeaturePainter extends CustomPainter {
  _FeaturePainter(
    this.features, {
    this.cameraWidth = 1,
    this.cameraHeight = 1,
  });

  final List<Offset> features;
  final double cameraWidth;
  final double cameraHeight;

  @override
  void paint(Canvas canvas, Size size) {
    // Calculate scale factors from camera space to screen space
    final scaleX = size.width / cameraWidth;
    final scaleY = size.height / cameraHeight;

    // Smaller feature markers so more can fit without clutter
    final paint = Paint()
      ..color = Colors.greenAccent
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    final fillPaint = Paint()
      ..color = Colors.greenAccent.withOpacity(0.18)
      ..style = PaintingStyle.fill;

    const radius = 4.0;

    for (final f in features) {
      // Scale feature coordinates from camera space to screen space
      final scaledX = f.dx * scaleX;
      final scaledY = f.dy * scaleY;
      final scaledPos = Offset(scaledX, scaledY);
      
      // Only draw if within screen bounds
      if (scaledX >= 0 && scaledX < size.width && scaledY >= 0 && scaledY < size.height) {
        // Draw filled circle with transparency
        canvas.drawCircle(scaledPos, radius, fillPaint);
        // Draw outline
        canvas.drawCircle(scaledPos, radius, paint);
        // Draw center dot
        canvas.drawCircle(scaledPos, 1.5, Paint()..color = Colors.greenAccent);
      }
    }

    // Draw feature count and camera info in corner
    final textPainter = TextPainter(
      text: TextSpan(
        text: 'Features: ${features.length}\\nCamera: ${cameraWidth.toInt()}x${cameraHeight.toInt()}',
        style: const TextStyle(
          color: Colors.greenAccent,
          fontSize: 14,
          fontWeight: FontWeight.bold,
          shadows: [
            Shadow(
              offset: Offset(1, 1),
              blurRadius: 2,
              color: Colors.black,
            ),
          ],
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(canvas, const Offset(10, 10));
  }

  @override
  bool shouldRepaint(covariant _FeaturePainter oldDelegate) {
    return oldDelegate.features.length != features.length ||
           oldDelegate.cameraWidth != cameraWidth ||
           oldDelegate.cameraHeight != cameraHeight;
  }
}

