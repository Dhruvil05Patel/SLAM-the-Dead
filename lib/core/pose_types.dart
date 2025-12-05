import 'dart:math' as math;

import 'package:vector_math/vector_math_64.dart';

/// Basic pose representation shared by DR and SLAM tracks.
class Pose {
  Pose({
    required this.timestamp,
    required this.position,
    required this.orientation,
  });

  final double timestamp; // seconds
  final Vector3 position; // meters
  final Quaternion orientation; // world-to-body

  Pose copyWith({
    double? timestamp,
    Vector3? position,
    Quaternion? orientation,
  }) {
    return Pose(
      timestamp: timestamp ?? this.timestamp,
      position: position ?? this.position.clone(),
      orientation: orientation ?? this.orientation.clone(),
    );
  }
}

/// Simple linear interpolation for pose streams (orientation uses slerp).
Pose lerpPose(Pose a, Pose b, double t) {
  if (t <= a.timestamp) return a;
  if (t >= b.timestamp) return b;
  final fraction = (t - a.timestamp) / (b.timestamp - a.timestamp);
  final pos = Vector3.zero()
    ..setValues(
      a.position.x + (b.position.x - a.position.x) * fraction,
      a.position.y + (b.position.y - a.position.y) * fraction,
      a.position.z + (b.position.z - a.position.z) * fraction,
    );
  final q = Quaternion.identity();
  q.setFromSlerp(a.orientation, b.orientation, fraction.clamp(0, 1));
  return Pose(timestamp: t, position: pos, orientation: q);
}

/// Convenience to compute heading (yaw) from quaternion (ENU frame).
double yawFromQuaternion(Quaternion q) {
  final siny = 2.0 * (q.w * q.z + q.x * q.y);
  final cosy = 1.0 - 2.0 * (q.y * q.y + q.z * q.z);
  return math.atan2(siny, cosy);
}

Quaternion fromGyro(Vector3 omega, double dt, Quaternion current) {
  final theta = omega * dt;
  final mag = theta.length;
  if (mag < 1e-9) return current;
  final axis = theta / mag;
  final half = mag / 2.0;
  final dq = Quaternion.axisAngle(axis, half);
  return (current * dq).normalized();
}

Vector3 rotateBodyToWorld(Quaternion q, Vector3 body) {
  final v = Quaternion(body.x, body.y, body.z, 0);
  final r = q * v * q.conjugated();
  return Vector3(r.x, r.y, r.z);
}

