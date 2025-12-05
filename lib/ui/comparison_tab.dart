import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vector_math/vector_math_64.dart';

import '../core/alignment.dart';
import '../providers.dart';
import 'widgets/trajectory_plot.dart';

class ComparisonTab extends ConsumerWidget {
  const ComparisonTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dr = ref.watch(drHistoryProvider);
    final slam = ref.watch(slamHistoryProvider);

    AlignmentResult? aligned;
    TrajectoryMetrics? metrics;
    if (dr.length >= 3 && slam.length >= 3) {
      final n = [dr.length, slam.length].reduce((a, b) => a < b ? a : b);
      final drPts = dr.take(n).map((p) => p.position).toList();
      final slamPts = slam.take(n).map((p) => p.position).toList();
      aligned = umeyama(slamPts, drPts);
      final alignedSlam = _applyTransform(slam.take(n).toList(), aligned);
      metrics = computeMetrics(dr.take(n).toList(), alignedSlam);
    }

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TrajectoryPlot(
              poses: dr,
              secondary: slam,
              color: Colors.cyan,
              secondaryColor: Colors.orange,
            ),
            if (aligned != null && metrics != null) ...[
              Text('Alignment scale: ${aligned.scale.toStringAsFixed(3)}'),
              Text('RMSE: ${metrics.rmse.toStringAsFixed(3)} m'),
              Text('Max drift: ${metrics.maxError.toStringAsFixed(3)} m'),
              const SizedBox(height: 8),
              Text(
                'Auto-analysis: Drift rate ${metrics.driftRate.toStringAsFixed(3)} m/s. '
                'If divergence spikes, recalibrate IMU, increase feature count, or run loop closures.',
              ),
            ] else
              const Text('Waiting for both trajectories to accumulate...'),
          ],
        ),
      ),
    );
  }

  List<Pose> _applyTransform(List<Pose> poses, AlignmentResult result) {
    return poses
        .map(
          (p) => p.copyWith(
            position: result.rotation.transposed() * (p.position * result.scale) + result.translation,
          ),
        )
        .toList();
  }
}

