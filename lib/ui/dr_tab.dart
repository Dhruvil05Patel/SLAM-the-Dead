import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vector_math/vector_math_64.dart';

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
    final velocity = poses.length >= 2
        ? (poses.last.position - poses[poses.length - 2].position) /
            (poses.last.timestamp - poses[poses.length - 2].timestamp).clamp(0.01, 10.0)
        : Vector3.zero();

    return SafeArea(
      child: Column(
        children: [
          const SizedBox(height: 8),
          TrajectoryPlot(poses: poses),
          Row(
            children: [
              Expanded(
                child: NumericCard(
                  title: 'Heading',
                  value: heading.toStringAsFixed(2),
                  unit: 'rad',
                ),
              ),
              Expanded(
                child: NumericCard(
                  title: 'Velocity',
                  value: velocity.length.toStringAsFixed(2),
                  unit: 'm/s',
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            children: [
              ElevatedButton.icon(
                onPressed: controller.start,
                icon: const Icon(Icons.play_arrow),
                label: const Text('Start'),
              ),
              ElevatedButton.icon(
                onPressed: controller.stop,
                icon: const Icon(Icons.stop),
                label: const Text('Stop'),
              ),
              ElevatedButton.icon(
                onPressed: controller.reset,
                icon: const Icon(Icons.refresh),
                label: const Text('Reset'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Uses strapdown integration + Madgwick orientation. ENU frame.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

