import 'dart:math' as math;

import 'package:vector_math/vector_math_64.dart';

import 'pose_types.dart';

class ImuCalibration {
  ImuCalibration({
    Vector3? accelBias,
    Vector3? gyroBias,
    this.gravity = 9.80665,
  })  : accelBias = accelBias ?? Vector3.zero(),
        gyroBias = gyroBias ?? Vector3.zero();

  final Vector3 accelBias;
  final Vector3 gyroBias;
  final double gravity;
}

class DeadReckoningState {
  DeadReckoningState({
    required this.pose,
    required this.velocity,
  });

  final Pose pose;
  final Vector3 velocity;

  DeadReckoningState copyWith({
    Pose? pose,
    Vector3? velocity,
  }) {
    return DeadReckoningState(
      pose: pose ?? this.pose,
      velocity: velocity ?? this.velocity.clone(),
    );
  }
}

/// Lightweight Madgwick implementation tuned for mobile IMU rates.
class MadgwickFilter {
  MadgwickFilter({
    this.beta = 0.04,
    Quaternion? initialOrientation,
  }) : _q = initialOrientation ?? Quaternion.identity();

  Quaternion get orientation => _q;

  double beta;
  Quaternion _q;

  void reset() {
    _q = Quaternion.identity();
  }

  void update({
    required Vector3 gyro,
    required Vector3 accel,
    required double dt,
  }) {
    // Normalize accelerometer
    if (accel.length2 > 1e-9) {
      accel.normalize();
    } else {
      // If accel is invalid, fall back to gyro integration only.
      _integrateGyro(gyro, dt);
      return;
    }

    final q1 = _q.w;
    final q2 = _q.x;
    final q3 = _q.y;
    final q4 = _q.z;

    // Objective function and Jacobian for gradient descent
    final f1 = 2 * (q2 * q4 - q1 * q3) - accel.x;
    final f2 = 2 * (q1 * q2 + q3 * q4) - accel.y;
    final f3 = 2 * (0.5 - q2 * q2 - q3 * q3) - accel.z;

    final J11 = -2 * q3;
    final J12 = 2 * q4;
    final J13 = -2 * q1;
    final J14 = 2 * q2;

    final J21 = 2 * q2;
    final J22 = 2 * q1;
    final J23 = 2 * q4;
    final J24 = 2 * q3;

    const J31 = 0;
    final J32 = -4 * q2;
    final J33 = -4 * q3;
    const J34 = 0;

    final grad1 = J11 * f1 + J21 * f2 + J31 * f3;
    final grad2 = J12 * f1 + J22 * f2 + J32 * f3;
    final grad3 = J13 * f1 + J23 * f2 + J33 * f3;
    final grad4 = J14 * f1 + J24 * f2 + J34 * f3;

    final grad = Vector4(grad1, grad2, grad3, grad4);
    if (grad.length2 > 0) {
      grad.scale(1 / grad.length);
    }

    // Gyro measured in rad/s
    final qDot1 = 0.5 * (-q2 * gyro.x - q3 * gyro.y - q4 * gyro.z) - beta * grad.x;
    final qDot2 = 0.5 * (q1 * gyro.x + q3 * gyro.z - q4 * gyro.y) - beta * grad.y;
    final qDot3 = 0.5 * (q1 * gyro.y - q2 * gyro.z + q4 * gyro.x) - beta * grad.z;
    final qDot4 = 0.5 * (q1 * gyro.z + q2 * gyro.y - q3 * gyro.x) - beta * grad.w;

    _q = Quaternion(
      q2 + qDot2 * dt,
      q3 + qDot3 * dt,
      q4 + qDot4 * dt,
      q1 + qDot1 * dt,
    ).normalized();
  }

  void _integrateGyro(Vector3 gyro, double dt) {
    final theta = gyro * dt;
    final mag = theta.length;
    if (mag < 1e-6) return;
    final axis = theta / mag;
    final dq = Quaternion.axisAngle(axis, mag);
    _q = (_q * dq).normalized();
  }
}

/// Strapdown integration for DR in ENU frame.
class DeadReckoningEngine {
  DeadReckoningEngine({
    ImuCalibration? calibration,
    MadgwickFilter? filter,
  })  : _calibration = calibration ?? ImuCalibration(),
        _filter = filter ?? MadgwickFilter(),
        _state = DeadReckoningState(
          pose: Pose(
            timestamp: 0,
            position: Vector3.zero(),
            orientation: Quaternion.identity(),
          ),
          velocity: Vector3.zero(),
        );

  DeadReckoningState get state => _state;

  ImuCalibration _calibration;
  final MadgwickFilter _filter;
  DeadReckoningState _state;

  void updateCalibration(ImuCalibration calibration) {
    _calibration = calibration;
  }

  void reset() {
    _filter.reset();
    _state = DeadReckoningState(
      pose: Pose(
        timestamp: 0,
        position: Vector3.zero(),
        orientation: Quaternion.identity(),
      ),
      velocity: Vector3.zero(),
    );
  }

  /// Process one IMU sample (rad/s gyro, m/s^2 accel).
  DeadReckoningState processSample({
    required double timestamp,
    required Vector3 accel,
    required Vector3 gyro,
    required double dt,
  }) {
    final correctedGyro = gyro - _calibration.gyroBias;
    final correctedAccel = accel - _calibration.accelBias;

    _filter.update(gyro: correctedGyro, accel: correctedAccel, dt: dt);
    final orientation = _filter.orientation;

    final worldAccel = rotateBodyToWorld(orientation, correctedAccel);
    final gravityVec = Vector3(0, 0, _calibration.gravity);
    final linearAccel = worldAccel - gravityVec;

    final velocity = _state.velocity + linearAccel * dt;
    final position = _state.pose.position + velocity * dt + linearAccel * (0.5 * dt * dt);

    _state = DeadReckoningState(
      pose: Pose(timestamp: timestamp, position: position, orientation: orientation),
      velocity: velocity,
    );

    return _state;
  }
}

