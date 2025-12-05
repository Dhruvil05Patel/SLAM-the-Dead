import 'dart:math' as math;

import 'package:vector_math/vector_math_64.dart';

import 'pose_types.dart';

class AlignmentResult {
  AlignmentResult({
    required this.scale,
    required this.rotation,
    required this.translation,
    required this.rmse,
  });

  final double scale;
  final Matrix3 rotation;
  final Vector3 translation;
  final double rmse;
}

/// Umeyama similarity transform to align trajectories.
AlignmentResult umeyama(List<Vector3> src, List<Vector3> dst) {
  assert(src.length == dst.length && src.length >= 3, 'Need >=3 points');

  final n = src.length;
  final meanSrc = _mean(src);
  final meanDst = _mean(dst);

  final cov = Matrix3.zero();
  for (var i = 0; i < n; i++) {
    final xs = src[i] - meanSrc;
    final ys = dst[i] - meanDst;
    cov.setRow(0, cov.row0 + ys * xs.x);
    cov.setRow(1, cov.row1 + ys * xs.y);
    cov.setRow(2, cov.row2 + ys * xs.z);
  }
  cov.scale(1 / n);

  final svd = _svd(cov);
  var r = svd.v * svd.u.transposed();

  // Enforce proper rotation (determinant > 0)
  if (r.determinant() < 0) {
    final v = svd.v;
    v.setColumn(2, v.getColumn(2)..scale(-1));
    r = v * svd.u.transposed();
  }

  final varSrc = src.fold<double>(0, (acc, p) => acc + (p - meanSrc).length2) / n;
  final scale = (svd.sigma.trace() / varSrc);
  final t = meanDst - r.transposed() * (meanSrc * scale);

  final rmse = _rmse(src, dst, scale, r, t);
  return AlignmentResult(scale: scale, rotation: r, translation: t, rmse: rmse);
}

Vector3 _mean(List<Vector3> pts) {
  final sum = pts.fold<Vector3>(Vector3.zero(), (acc, p) => acc + p);
  return sum / pts.length.toDouble();
}

double _rmse(
  List<Vector3> src,
  List<Vector3> dst,
  double scale,
  Matrix3 r,
  Vector3 t,
) {
  var err = 0.0;
  for (var i = 0; i < src.length; i++) {
    final est = r.transposed() * (src[i] * scale) + t;
    err += (est - dst[i]).length2;
  }
  return math.sqrt(err / src.length);
}

/// Minimal SVD (3x3) using eigen decomposition of ATA. Good enough for alignment.
class _SvdResult {
  _SvdResult(this.u, this.sigma, this.v);
  final Matrix3 u;
  final Matrix3 sigma;
  final Matrix3 v;
}

_SvdResult _svd(Matrix3 a) {
  // Compute eigen of A^T A
  final ata = a.transposed() * a;
  final eigen = _eigenSymmetric(ata);
  final singularValues = eigen.values.map((e) => math.sqrt(math.max(e, 0))).toList();

  final v = eigen.vectors;
  final sigma = Matrix3.zero();
  sigma.setEntry(0, 0, singularValues[0]);
  sigma.setEntry(1, 1, singularValues[1]);
  sigma.setEntry(2, 2, singularValues[2]);

  // U = A * V * Sigma^{-1}
  final sigmaInv = Matrix3.zero();
  for (var i = 0; i < 3; i++) {
    if (singularValues[i] > 1e-9) {
      sigmaInv.setEntry(i, i, 1 / singularValues[i]);
    }
  }
  final u = a * v * sigmaInv;
  return _SvdResult(u, sigma, v);
}

class _EigenResult {
  _EigenResult(this.values, this.vectors);
  final List<double> values;
  final Matrix3 vectors;
}

/// Very small symmetric eigen decomposition using power iteration.
_EigenResult _eigenSymmetric(Matrix3 m) {
  final vectors = Matrix3.identity();
  final values = <double>[];
  var a = m.clone();
  for (var i = 0; i < 3; i++) {
    var v = Vector3(math.Random(i).nextDouble(), math.Random(i + 1).nextDouble(), math.Random(i + 2).nextDouble());
    for (var iter = 0; iter < 50; iter++) {
      v = a * v;
      final norm = v.length;
      if (norm < 1e-9) break;
      v.scale(1 / norm);
    }
    final lambda = v.dot(a * v);
    values.add(lambda);
    vectors.setColumn(i, v);
    // Deflate
    final outer = Matrix3.columns(v * v.x, v * v.y, v * v.z);
    a = a - outer * lambda;
  }
  return _EigenResult(values, vectors);
}

/// Compute RMSE and drift metrics between aligned pose traces.
class TrajectoryMetrics {
  TrajectoryMetrics({
    required this.rmse,
    required this.meanAbsError,
    required this.maxError,
    required this.driftRate,
  });

  final double rmse;
  final double meanAbsError;
  final double maxError;
  final double driftRate;
}

TrajectoryMetrics computeMetrics(List<Pose> ref, List<Pose> est) {
  if (ref.isEmpty || est.isEmpty) {
    return TrajectoryMetrics(rmse: 0, meanAbsError: 0, maxError: 0, driftRate: 0);
  }
  final n = math.min(ref.length, est.length);
  var errSum = 0.0;
  var absSum = 0.0;
  var maxErr = 0.0;
  for (var i = 0; i < n; i++) {
    final e = (est[i].position - ref[i].position).length;
    errSum += e * e;
    absSum += e;
    maxErr = math.max(maxErr, e);
  }
  final duration = (ref.last.timestamp - ref.first.timestamp).abs();
  final driftRate = duration > 0 ? maxErr / duration : 0;
  return TrajectoryMetrics(
    rmse: math.sqrt(errSum / n),
    meanAbsError: absSum / n,
    maxError: maxErr,
    driftRate: driftRate,
  );
}

