import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vector_math/vector_math_64.dart' hide Colors;
import 'dart:math';

import '../providers.dart';
import '../core/pose_types.dart';
import 'widgets/numeric_card.dart';
import 'widgets/trajectory_plot.dart';

class DrTab extends ConsumerWidget {
  const DrTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final poses = ref.watch(drHistoryProvider);
    final controller = ref.watch(drControllerProvider);
    final heading = poses.isNotEmpty ? yawFromQuaternion(poses.last.orientation) : 0.0;
    
    // Improved velocity calculation with smoothing
    final velocity = _calculateSmoothedVelocity(poses);
    final speed = min(velocity.length, 10.0); // Cap at 10 m/s for display
    
    // Calculate distance traveled
    final distance = _calculateTotalDistance(poses);

    return SafeArea(
      child: SingleChildScrollView(
        child: Column(
          children: [
            const SizedBox(height: 8),
            // Graph section with fixed height
            SizedBox(
              height: 200,
              child: TrajectoryPlot(poses: poses),
            ),
            
            // Stats row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: NumericCard(
                      title: 'Heading',
                      value: '${(heading * 180 / pi).toStringAsFixed(1)}°',
                      unit: '${heading.toStringAsFixed(2)} rad',
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: NumericCard(
                      title: 'Speed',
                      value: speed.toStringAsFixed(2),
                      unit: 'm/s',
                      warning: speed > 5.0 ? 'High speed' : null,
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
                ],
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
                  ElevatedButton.icon(
                    onPressed: controller.start,
                    icon: const Icon(Icons.play_arrow, size: 20),
                    label: const Text('Start'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: controller.stop,
                    icon: const Icon(Icons.stop, size: 20),
                    label: const Text('Stop'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red[700],
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: controller.reset,
                    icon: const Icon(Icons.refresh, size: 20),
                    label: const Text('Reset'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                ],
              ),
            ),
            
            // Additional info
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Text(
                'Dead Reckoning using IMU sensors. ENU coordinate frame.\nTap the graph to zoom and pan.',
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  // Calculate smoothed velocity using multiple samples
  Vector3 _calculateSmoothedVelocity(List<Pose> poses, {int windowSize = 5}) {
    if (poses.length < 2) return Vector3.zero();
    
    final velocities = <Vector3>[];
    final count = min(windowSize, poses.length - 1);
    
    for (var i = 1; i <= count; i++) {
      final dt = poses[poses.length - i].timestamp - poses[poses.length - i - 1].timestamp;
      if (dt <= 0) continue;
      
      final velocity = (poses[poses.length - i].position - 
                       poses[poses.length - i - 1].position) / dt;
      velocities.add(velocity);
    }
    
    if (velocities.isEmpty) return Vector3.zero();
    
    // Return average velocity
    final avg = Vector3.zero();
    for (final v in velocities) {
      avg.add(v);
    }
    avg.scale(1.0 / velocities.length);
    
    return avg;
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
}
