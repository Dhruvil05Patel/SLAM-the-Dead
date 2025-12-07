import 'dart:math' as math;

/// High-quality feature detection and tracking for SLAM
class DartFeatureDetector {
  // Detection parameters
  static const int fastThreshold = 20; // Lower for more features
  static const int maxFeatures = 150; // Increase for better tracking
  static const int minDistance = 15; // Closer spacing allowed

  // Matching parameters
  static const int patchSize = 15;
  static const double ssdThreshold = 10000.0; // More lenient
  static const int maxSearchRadius = 60; // Larger search area

  /// High-quality corner detection using Harris corner response
  static List<Map<String, dynamic>> detectCorners(
    List<int> imageBytes,
    int width,
    int height,
  ) {
    if (imageBytes.isEmpty || width < 10 || height < 10) return [];

    final corners = <Map<String, dynamic>>[];

    // Compute gradients
    final gx = List<List<double>>.generate(height, (_) => List<double>.filled(width, 0));
    final gy = List<List<double>>.generate(height, (_) => List<double>.filled(width, 0));

    for (int y = 1; y < height - 1; y++) {
      for (int x = 1; x < width - 1; x++) {
        final idx = y * width + x;
        if (idx >= imageBytes.length) continue;

        // Sobel operators
        final left = imageBytes[y * width + (x - 1)];
        final right = imageBytes[y * width + (x + 1)];
        final above = imageBytes[(y - 1) * width + x];
        final below = imageBytes[(y + 1) * width + x];

        gx[y][x] = (right - left).toDouble();
        gy[y][x] = (below - above).toDouble();
      }
    }

    // Compute Harris response
    for (int y = 2; y < height - 2; y++) {
      for (int x = 2; x < width - 2; x++) {
        double gxx = 0, gyy = 0, gxy = 0;

        // Sum gradients in neighborhood
        for (int dy = -1; dy <= 1; dy++) {
          for (int dx = -1; dx <= 1; dx++) {
            final gradX = gx[y + dy][x + dx];
            final gradY = gy[y + dy][x + dx];
            gxx += gradX * gradX;
            gyy += gradY * gradY;
            gxy += gradX * gradY;
          }
        }

        // Harris corner response
        final trace = gxx + gyy;
        final det = gxx * gyy - gxy * gxy;
        final response = det - 0.04 * trace * trace;

        if (response > fastThreshold) {
          corners.add({
            'pt': [x.toDouble(), y.toDouble()],
            'response': response,
            'score': response,
          });
        }
      }
    }

    // Sort by response
    corners.sort((a, b) => (b['response'] as num).compareTo(a['response'] as num));

    // Non-maximum suppression - keep features that are far apart
    final filtered = <Map<String, dynamic>>[];
    for (final corner in corners) {
      if (filtered.length >= maxFeatures) break;

      final pt = corner['pt'] as List<double>;
      bool isSuppressed = false;

      for (final kept in filtered) {
        final kpt = kept['pt'] as List<double>;
        final dx = pt[0] - kpt[0];
        final dy = pt[1] - kpt[1];
        final dist = math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) {
          isSuppressed = true;
          break;
        }
      }

      if (!isSuppressed) {
        filtered.add(corner);
      }
    }

    return filtered;
  }

  /// Robust feature matching using normalized cross-correlation
  static List<Map<String, dynamic>> matchFeatures(
    List<Map<String, dynamic>> prev,
    List<Map<String, dynamic>> current,
    List<int> prevImage,
    List<int> currImage,
    int width,
    int height,
  ) {
    if (prev.isEmpty || current.isEmpty || prevImage.isEmpty || currImage.isEmpty) {
      return [];
    }

    final matches = <Map<String, dynamic>>[];
    const int searchRadius = maxSearchRadius;
    const int pSize = patchSize;

    for (int i = 0; i < prev.length && i < 50; i++) {
      final prevPt = prev[i]['pt'] as List<dynamic>? ?? [0, 0];
      final px = (prevPt[0] as num).toInt();
      final py = (prevPt[1] as num).toInt();

      // Validate bounds
      if (px < pSize || px >= width - pSize || py < pSize || py >= height - pSize) continue;

      // Extract patch from previous image
      final prevPatch = _extractPatch(prevImage, width, px, py, pSize);
      if (prevPatch == null || prevPatch.isEmpty) continue;

      double bestScore = double.infinity;
      int bestJ = -1;
      double secondBestScore = double.infinity;

      // Search for match in current image
      for (int j = 0; j < current.length; j++) {
        final currPt = current[j]['pt'] as List<dynamic>? ?? [0, 0];
        final cx = (currPt[0] as num).toInt();
        final cy = (currPt[1] as num).toInt();

        // Check search radius
        if ((cx - px).abs() > searchRadius || (cy - py).abs() > searchRadius) continue;

        // Validate bounds
        if (cx < pSize || cx >= width - pSize || cy < pSize || cy >= height - pSize) continue;

        // Extract patch from current image
        final currPatch = _extractPatch(currImage, width, cx, cy, pSize);
        if (currPatch == null || currPatch.isEmpty) continue;

        // Compute normalized cross-correlation
        final ncc = _computeNCC(prevPatch, currPatch);

        if (ncc < bestScore) {
          secondBestScore = bestScore;
          bestScore = ncc;
          bestJ = j;
        } else if (ncc < secondBestScore) {
          secondBestScore = ncc;
        }
      }

      // Accept match if best is significantly better than second best
      if (bestJ >= 0 && bestScore < ssdThreshold) {
        final ratio = bestScore / (secondBestScore + 0.001);
        if (ratio < 0.8) {
          // Lowe's ratio test
          matches.add({
            'prevIndex': i,
            'currIndex': bestJ,
            'score': bestScore,
          });
        }
      }
    }

    return matches;
  }

  /// Extract image patch around point
  static List<int>? _extractPatch(List<int> image, int width, int cx, int cy, int pSize) {
    final half = pSize ~/ 2;
    final patch = <int>[];

    for (int dy = -half; dy <= half; dy++) {
      for (int dx = -half; dx <= half; dx++) {
        final ny = cy + dy;
        final nx = cx + dx;
        if (nx >= 0 && nx < width && ny >= 0 && ny < (image.length ~/ width)) {
          patch.add(image[ny * width + nx]);
        }
      }
    }

    return patch.isEmpty ? null : patch;
  }

  /// Compute normalized cross-correlation (sum of squared differences after normalization)
  static double _computeNCC(List<int> patch1, List<int> patch2) {
    if (patch1.length != patch2.length) return double.infinity;

    // Compute means
    final mean1 = patch1.reduce((a, b) => a + b) / patch1.length;
    final mean2 = patch2.reduce((a, b) => a + b) / patch2.length;

    // Compute SSD with normalized patches
    double ssd = 0;
    for (int i = 0; i < patch1.length; i++) {
      final diff = (patch1[i] - mean1) - (patch2[i] - mean2);
      ssd += diff * diff;
    }

    return ssd;
  }

  /// Estimate camera pose from matched features using robust median flow with inlier scoring
  static Map<String, dynamic> estimatePose(
    List<Map<String, dynamic>> matches,
    List<Map<String, dynamic>> prevFeatures,
    List<Map<String, dynamic>> currFeatures,
    List<double> intrinsics,
  ) {
    if (matches.length < 8) {
      return {
        'rotation': [0.0, 0.0, 0.0],
        'translation': [0.0, 0.0, 0.0],
      };
    }

    final fx = intrinsics.isNotEmpty ? intrinsics[0] : 800.0;
    final fy = intrinsics.length > 1 ? intrinsics[1] : 800.0;
    final cx = intrinsics.length > 2 ? intrinsics[2] : 320.0;
    final cy = intrinsics.length > 3 ? intrinsics[3] : 240.0;

    // Collect normalized image coordinates
    final prevPoints = <List<double>>[];
    final currPoints = <List<double>>[];

    for (final m in matches) {
      final prevIdx = m['prevIndex'] as int? ?? 0;
      final currIdx = m['currIndex'] as int? ?? 0;

      if (prevIdx >= prevFeatures.length || currIdx >= currFeatures.length) continue;

      final prevPt = prevFeatures[prevIdx]['pt'] as List<dynamic>? ?? [0, 0];
      final currPt = currFeatures[currIdx]['pt'] as List<dynamic>? ?? [0, 0];

      // Normalize coordinates (convert from pixels to normalized camera coordinates)
      final prevX = ((prevPt[0] as num).toDouble() - cx) / fx;
      final prevY = ((prevPt[1] as num).toDouble() - cy) / fy;
      final currX = ((currPt[0] as num).toDouble() - cx) / fx;
      final currY = ((currPt[1] as num).toDouble() - cy) / fy;

      prevPoints.add([prevX, prevY]);
      currPoints.add([currX, currY]);
    }

    if (prevPoints.length < 8) {
      return {
        'rotation': [0.0, 0.0, 0.0],
        'translation': [0.0, 0.0, 0.0],
      };
    }

    // Compute flows in normalized coordinates
    final flowsX = <double>[];
    final flowsY = <double>[];

    for (int i = 0; i < prevPoints.length; i++) {
      final fx = currPoints[i][0] - prevPoints[i][0];
      final fy = currPoints[i][1] - prevPoints[i][1];
      flowsX.add(fx);
      flowsY.add(fy);
    }

    flowsX.sort();
    flowsY.sort();
    
    final medianFlowX = flowsX[flowsX.length ~/ 2];
    final medianFlowY = flowsY[flowsY.length ~/ 2];

    // RANSAC-lite: count inliers based on residuals to median flow
    double madX = 0;
    double madY = 0;
    for (final fx in flowsX) {
      madX += (fx - medianFlowX).abs();
    }
    for (final fy in flowsY) {
      madY += (fy - medianFlowY).abs();
    }
    madX = (madX / flowsX.length).abs();
    madY = (madY / flowsY.length).abs();

    final thresholdX = (madX * 3).clamp(0.001, 0.05);
    final thresholdY = (madY * 3).clamp(0.001, 0.05);

    int inliers = 0;
    for (int i = 0; i < flowsX.length; i++) {
      final dx = (flowsX[i] - medianFlowX).abs();
      final dy = (flowsY[i] - medianFlowY).abs();
      if (dx < thresholdX && dy < thresholdY) {
        inliers++;
      }
    }

    final inlierRatio = flowsX.isNotEmpty ? inliers / flowsX.length : 0.0;

    // Estimate translation with better depth model
    // Smaller scale factor for more stable tracking
    const scale = 0.05; // Reduced from 0.1

    return {
      'rotation': [0.0, 0.0, 0.0],
      'translation': [
        -medianFlowX * scale,
        -medianFlowY * scale,
        0.0,
      ],
      'inlierRatio': inlierRatio,
      'inlierCount': inliers,
      'matchCount': flowsX.length,
    };
  }
}
