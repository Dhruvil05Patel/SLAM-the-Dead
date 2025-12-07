import 'dart:math';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vector_math/vector_math_64.dart' hide Colors;

import '../core/pose_types.dart';
import '../providers.dart';
import 'widgets/camera_overlay.dart';
import 'widgets/feature_painter.dart';
import 'widgets/numeric_card.dart';
import 'widgets/trajectory_plot.dart';

class SlamTab extends ConsumerStatefulWidget {
  const SlamTab({super.key});

  @override
  ConsumerState<SlamTab> createState() => _SlamTabState();
}

class _SlamTabState extends ConsumerState<SlamTab> {
  bool showFeatures = true;
  bool showTrajectory = true;
  final double _zoomLevel = 1.0;
  double _featureSize = 4.0;

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(slamControllerProvider);
    final poses = ref.watch(slamHistoryProvider);
    final rawFeatures = ref.watch(slamFeaturesProvider);
    final cam = ref.watch(cameraServiceProvider).controller;
    final lastMs = controller.lastProcessingMs;
    final fps = lastMs > 0 ? 1000 / lastMs : 0;
    final inlierRatio = controller.inlierRatio;
    final inlierText = '${(inlierRatio * 100).toStringAsFixed(0)}%';
    final skipped = controller.skippedFrames;

    // Calculate stats
    final featureCount = rawFeatures.length;
    final poseCount = poses.length;
    final distance = _calculateTotalDistance(poses);
    final velocity = _calculateVelocity(poses);

    // Convert feature maps to Offset points for rendering
    final features = rawFeatures
        .map((f) {
          final pt = f['pt'] as List<dynamic>? ?? [0, 0];
          return Offset(
            (pt[0] as num).toDouble(),
            (pt[1] as num).toDouble(),
          );
        })
        .toList();

    return SafeArea(
      child: Column(
        children: [
          // Camera preview section with controls
          Expanded(
            flex: 2,
            child: cam == null
                ? const Center(child: Text('Camera not started'))
                : Stack(
                    fit: StackFit.expand,
                    children: [
                      // Camera preview
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          margin: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.white24, width: 1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: CameraPreview(cam),
                        ),
                      ),
                      
                      // Feature overlay
                      if (showFeatures)
                        Positioned.fill(
                          child: Padding(
                            padding: const EdgeInsets.all(8.0),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: CustomPaint(
                                painter: FeaturePainter(
                                  features: features,
                                  color: Colors.cyan.withOpacity(0.7),
                                  pointSize: _featureSize,
                                ),
                              ),
                            ),
                          ),
                        ),
                      
                      // Top controls
                      Positioned(
                        top: 16,
                        left: 16,
                        right: 16,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            // Status indicators
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 12,
                                    height: 12,
                                    margin: const EdgeInsets.only(right: 6),
                                    decoration: BoxDecoration(
                                      color: controller.isRunning
                                          ? Colors.green
                                          : Colors.red,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  Text(
                                    controller.isRunning ? 'TRACKING' : 'STOPPED',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            
                            // Feature toggle
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.circle, size: 12, color: Colors.cyan),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Features: $featureCount',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Debug metrics overlay
                      Positioned(
                        bottom: 12,
                        left: 12,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: DefaultTextStyle(
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('FPS: ${fps.toStringAsFixed(1)}'),
                                Text('Inliers: $inlierText (${controller.inlierCount}/${controller.matchCount})'),
                                Text('Features: $featureCount | Skipped: $skipped'),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
          
          // Stats row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                Expanded(
                  child: NumericCard(
                    title: 'Poses',
                    value: poseCount.toString(),
                    unit: 'frames',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: NumericCard(
                    title: 'Distance',
                    value: distance.toStringAsFixed(2),
                    unit: 'meters',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: NumericCard(
                    title: 'Speed',
                    value: velocity.toStringAsFixed(2),
                    unit: 'm/s',
                  ),
                ),
              ],
            ),
          ),
          
          // Trajectory plot with toggle
          if (showTrajectory)
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              height: 180,
              margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(12),
              ),
              child: TrajectoryPlot(
                poses: poses,
                color: Colors.cyan,
              ),
            ),
          
          // Control buttons
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Wrap(
              alignment: WrapAlignment.center,
              spacing: 12,
              runSpacing: 8,
              children: [
                // Start button
                ElevatedButton.icon(
                  onPressed: () async {
                    await controller.start(intrinsics: const [800, 800, 320, 240]);
                  },
                  icon: const Icon(Icons.play_arrow, size: 20),
                  label: const Text('Start'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green[700],
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
                
                // Stop button
                ElevatedButton.icon(
                  onPressed: controller.stop,
                  icon: const Icon(Icons.stop, size: 20),
                  label: const Text('Stop'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red[700],
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
                
                // Reset button
                OutlinedButton.icon(
                  onPressed: controller.reset,
                  icon: const Icon(Icons.refresh, size: 20),
                  label: const Text('Reset'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
                
                // Toggle features button
                Tooltip(
                  message: 'Toggle feature points',
                  child: IconButton(
                    onPressed: () => setState(() => showFeatures = !showFeatures),
                    icon: Icon(
                      showFeatures ? Icons.visibility : Icons.visibility_off,
                      color: showFeatures ? Colors.cyan : Colors.grey,
                    ),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.black26,
                      padding: const EdgeInsets.all(12),
                    ),
                  ),
                ),
                
                // Toggle trajectory button
                Tooltip(
                  message: 'Toggle trajectory plot',
                  child: IconButton(
                    onPressed: () => setState(() => showTrajectory = !showTrajectory),
                    icon: Icon(
                      showTrajectory ? Icons.show_chart : Icons.show_chart_outlined,
                      color: showTrajectory ? Colors.cyan : Colors.grey,
                    ),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.black26,
                      padding: const EdgeInsets.all(12),
                    ),
                  ),
                ),
                
                // Feature size control
                Tooltip(
                  message: 'Adjust feature size',
                  child: Container(
                    width: 120,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Slider(
                      value: _featureSize,
                      min: 2.0,
                      max: 8.0,
                      divisions: 6,
                      label: 'Feature size: ${_featureSize.toStringAsFixed(1)}',
                      onChanged: (value) => setState(() => _featureSize = value),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Debug info (collapsible)
          ExpansionTile(
            title: const Text('Debug Info', style: TextStyle(fontSize: 14)),
            initiallyExpanded: false,
            children: [
              Padding(
                padding: const EdgeInsets.all(8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Last Position: ${poses.isNotEmpty ? _formatVector(poses.last.position) : 'N/A'}')
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  // Format vector for display
  String _formatVector(Vector3 v) {
    return '(${v.x.toStringAsFixed(2)}, ${v.y.toStringAsFixed(2)}, ${v.z.toStringAsFixed(2)})';
  }
  
  // Calculate total distance traveled
  double _calculateTotalDistance(List<Pose> poses) {
    if (poses.length < 2) return 0.0;
    
    double distance = 0.0;
    for (var i = 1; i < poses.length; i++) {
      distance += (poses[i].position - poses[i-1].position).length;
    }
    return distance;
  }
  
  // Calculate current velocity
  double _calculateVelocity(List<Pose> poses, {int windowSize = 5}) {
    if (poses.length < 2) return 0.0;
    
    final velocities = <double>[];
    final count = min(windowSize, poses.length - 1);
    
    for (var i = 1; i <= count; i++) {
      final dt = poses[poses.length - i].timestamp - 
                poses[poses.length - i - 1].timestamp;
      if (dt <= 0) continue;
      
      final dist = (poses[poses.length - i].position - 
                  poses[poses.length - i - 1].position).length;
      velocities.add(dist / dt);
    }
    
    if (velocities.isEmpty) return 0.0;
    
    // Return average velocity
    return velocities.reduce((a, b) => a + b) / velocities.length;
  }
}

