import 'package:flutter/material.dart' as mat;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/alignment.dart';
import '../core/pose_types.dart';
import '../providers.dart';
import 'widgets/trajectory_plot.dart';

class ComparisonTab extends ConsumerWidget {
  const ComparisonTab({super.key});

  @override
  mat.Widget build(mat.BuildContext context, WidgetRef ref) {
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

    return mat.SafeArea(
      child: mat.SingleChildScrollView(
        padding: const mat.EdgeInsets.all(12),
        child: mat.Column(
          crossAxisAlignment: mat.CrossAxisAlignment.start,
          children: [
            TrajectoryPlot(
              poses: dr,
              secondary: slam,
              color: mat.Colors.cyan,
              secondaryColor: mat.Colors.orange,
            ),
            if (aligned != null && metrics != null) ...[
              mat.Text('Alignment scale: ${aligned.scale.toStringAsFixed(3)}'),
              mat.Text('RMSE: ${metrics.rmse.toStringAsFixed(3)} m'),
              mat.Text('Max drift: ${metrics.maxError.toStringAsFixed(3)} m'),
              const mat.SizedBox(height: 8),
              mat.Text(
                'Auto-analysis: Drift rate ${metrics.driftRate.toStringAsFixed(3)} m/s. '
                'If divergence spikes, recalibrate IMU, increase feature count, or run loop closures.',
              ),
            ] else
              const mat.Text('Waiting for both trajectories to accumulate...'),
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

