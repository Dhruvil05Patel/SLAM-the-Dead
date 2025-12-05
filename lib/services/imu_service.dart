import 'dart:async';

import 'package:async/async.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:vector_math/vector_math_64.dart';

import '../core/dr_engine.dart';

class ImuSample {
  ImuSample({
    required this.timestamp,
    required this.accel,
    required this.gyro,
  });

  final double timestamp;
  final Vector3 accel;
  final Vector3 gyro;
}

class ImuService {
  StreamSubscription<List<dynamic>>? _subscription;

  Future<void> start({
    required void Function(ImuSample) onSample,
  }) async {
    // Combine accelerometer + gyroscope streams.
    final accelStream = accelerometerEventStream();
    final gyroStream = gyroscopeEventStream();
    _subscription = StreamZip([
      accelStream,
      gyroStream,
    ]).listen((values) {
      final accel = values[0] as AccelerometerEvent;
      final gyro = values[1] as GyroscopeEvent;
      final ts = DateTime.now().millisecondsSinceEpoch / 1000.0;
      onSample(
        ImuSample(
          timestamp: ts,
          accel: Vector3(accel.x, accel.y, accel.z),
          gyro: Vector3(gyro.x, gyro.y, gyro.z),
        ),
      );
    });
  }

  Future<void> stop() async {
    await _subscription?.cancel();
    _subscription = null;
  }
}

