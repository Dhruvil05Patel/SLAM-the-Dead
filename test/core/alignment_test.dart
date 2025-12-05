import 'package:flutter_test/flutter_test.dart';
import 'package:vector_math/vector_math_64.dart';

import 'package:slam_the_dead/core/alignment.dart';
import 'package:slam_the_dead/core/pose_types.dart';

void main() {
  test('Umeyama recovers identity transform', () {
    final src = [
      Vector3.zero(),
      Vector3(1, 0, 0),
      Vector3(0, 1, 0),
    ];
    final dst = src.map((e) => e + Vector3(1, 2, 3)).toList();
    final result = umeyama(src, dst);
    expect(result.scale, closeTo(1.0, 1e-3));
    expect(result.translation, equals(Vector3(1, 2, 3)));
  });

  test('Metrics compute rmse', () {
    final ref = [
      Pose(timestamp: 0, position: Vector3.zero(), orientation: Quaternion.identity()),
      Pose(timestamp: 1, position: Vector3(1, 0, 0), orientation: Quaternion.identity()),
    ];
    final est = [
      Pose(timestamp: 0, position: Vector3(0.5, 0, 0), orientation: Quaternion.identity()),
      Pose(timestamp: 1, position: Vector3(1.5, 0, 0), orientation: Quaternion.identity()),
    ];
    final m = computeMetrics(ref, est);
    expect(m.rmse, closeTo(0.5, 1e-3));
  });
}

