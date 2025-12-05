import 'package:flutter_test/flutter_test.dart';
import 'package:vector_math/vector_math_64.dart';

import 'package:slam_the_dead/core/dr_engine.dart';

void main() {
  test('Madgwick holds steady without motion', () {
    final filter = MadgwickFilter();
    filter.update(gyro: Vector3.zero(), accel: Vector3(0, 0, 1), dt: 0.01);
    expect(filter.orientation.length, closeTo(1.0, 1e-6));
  });

  test('Dead reckoning integrates acceleration', () {
    final engine = DeadReckoningEngine();
    engine.processSample(
      timestamp: 0.01,
      accel: Vector3(0, 0, 9.80665),
      gyro: Vector3.zero(),
      dt: 0.01,
    );
    final state = engine.state;
    // With gravity compensated, net accel is zero -> no displacement.
    expect(state.pose.position.length, closeTo(0.0, 1e-6));
  });
}

