/**
 * Feature Detection for Visual SLAM
 * Implements Harris corner detection and feature matching in TypeScript
 * Ported from Dart implementation for React Native/Expo compatibility
 */

export interface Feature {
  pt: [number, number];
  response: number;
  score: number;
}

export interface Match {
  prevIndex: number;
  currIndex: number;
  score: number;
}

/**
 * Detect corners using Harris corner response
 */
export function detectCorners(
  imageData: Uint8Array,
  width: number,
  height: number,
  maxFeatures: number = 150,
  threshold: number = 20
): Feature[] {
  if (imageData.length < width * height || width < 10 || height < 10) {
    return [];
  }

  const corners: Feature[] = [];

  // Compute gradients using Sobel operators
  const gx: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  const gy: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (idx >= imageData.length) continue;

      const left = imageData[y * width + (x - 1)] || 0;
      const right = imageData[y * width + (x + 1)] || 0;
      const above = imageData[(y - 1) * width + x] || 0;
      const below = imageData[(y + 1) * width + x] || 0;

      gx[y][x] = right - left;
      gy[y][x] = below - above;
    }
  }

  // Compute Harris response
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      let gxx = 0, gyy = 0, gxy = 0;

      // Sum gradients in 3x3 neighborhood
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const gradX = gx[y + dy][x + dx];
          const gradY = gy[y + dy][x + dx];
          gxx += gradX * gradX;
          gyy += gradY * gradY;
          gxy += gradX * gradY;
        }
      }

      // Harris corner response: det - 0.04 * trace^2
      const trace = gxx + gyy;
      const det = gxx * gyy - gxy * gxy;
      const response = det - 0.04 * trace * trace;

      if (response > threshold) {
        corners.push({
          pt: [x, y],
          response,
          score: response,
        });
      }
    }
  }

  // Sort by response (highest first)
  corners.sort((a, b) => b.response - a.response);

  // Non-maximum suppression - keep features that are far apart
  const filtered: Feature[] = [];
  const minDistance = 15;

  for (const corner of corners) {
    if (filtered.length >= maxFeatures) break;

    let isSuppressed = false;
    for (const kept of filtered) {
      const dx = corner.pt[0] - kept.pt[0];
      const dy = corner.pt[1] - kept.pt[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        isSuppressed = true;
        break;
      }
    }

    if (!isSuppressed) {
      filtered.push(corner);
    }
  }

  return filtered;
}

/**
 * Match features between previous and current frames
 */
export function matchFeatures(
  prevFeatures: Feature[],
  currFeatures: Feature[],
  prevImage: Uint8Array,
  currImage: Uint8Array,
  width: number,
  height: number,
  patchSize: number = 15,
  maxSearchRadius: number = 60,
  ssdThreshold: number = 10000
): Match[] {
  if (prevFeatures.length === 0 || currFeatures.length === 0) {
    return [];
  }

  const matches: Match[] = [];
  const halfPatch = Math.floor(patchSize / 2);

  for (let i = 0; i < Math.min(prevFeatures.length, 50); i++) {
    const prevPt = prevFeatures[i].pt;
    const px = Math.floor(prevPt[0]);
    const py = Math.floor(prevPt[1]);

    // Validate bounds
    if (px < halfPatch || px >= width - halfPatch || 
        py < halfPatch || py >= height - halfPatch) {
      continue;
    }

    // Extract patch from previous image
    const prevPatch = extractPatch(prevImage, width, px, py, patchSize);
    if (!prevPatch || prevPatch.length === 0) continue;

    let bestScore = Infinity;
    let bestJ = -1;
    let secondBestScore = Infinity;

    // Search for match in current image
    for (let j = 0; j < currFeatures.length; j++) {
      const currPt = currFeatures[j].pt;
      const cx = Math.floor(currPt[0]);
      const cy = Math.floor(currPt[1]);

      // Check search radius
      if (Math.abs(cx - px) > maxSearchRadius || 
          Math.abs(cy - py) > maxSearchRadius) {
        continue;
      }

      // Validate bounds
      if (cx < halfPatch || cx >= width - halfPatch || 
          cy < halfPatch || cy >= height - halfPatch) {
        continue;
      }

      // Extract patch from current image
      const currPatch = extractPatch(currImage, width, cx, cy, patchSize);
      if (!currPatch || currPatch.length === 0) continue;

      // Compute normalized cross-correlation (SSD)
      const ncc = computeNCC(prevPatch, currPatch);

      if (ncc < bestScore) {
        secondBestScore = bestScore;
        bestScore = ncc;
        bestJ = j;
      } else if (ncc < secondBestScore) {
        secondBestScore = ncc;
      }
    }

    // Accept match if best is significantly better than second best (Lowe's ratio test)
    if (bestJ >= 0 && bestScore < ssdThreshold) {
      const ratio = bestScore / (secondBestScore + 0.001);
      if (ratio < 0.8) {
        matches.push({
          prevIndex: i,
          currIndex: bestJ,
          score: bestScore,
        });
      }
    }
  }

  return matches;
}

/**
 * Extract image patch around a point
 */
function extractPatch(
  image: Uint8Array,
  width: number,
  cx: number,
  cy: number,
  patchSize: number
): Uint8Array | null {
  const half = Math.floor(patchSize / 2);
  const patch: number[] = [];

  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const ny = cy + dy;
      const nx = cx + dx;
      if (nx >= 0 && nx < width && ny >= 0 && ny < Math.floor(image.length / width)) {
        const idx = ny * width + nx;
        if (idx < image.length) {
          patch.push(image[idx]);
        }
      }
    }
  }

  return patch.length > 0 ? new Uint8Array(patch) : null;
}

/**
 * Compute normalized cross-correlation (sum of squared differences)
 */
function computeNCC(patch1: Uint8Array, patch2: Uint8Array): number {
  if (patch1.length !== patch2.length) return Infinity;

  // Compute means
  const mean1 = patch1.reduce((a, b) => a + b, 0) / patch1.length;
  const mean2 = patch2.reduce((a, b) => a + b, 0) / patch2.length;

  // Compute SSD with normalized patches
  let ssd = 0;
  for (let i = 0; i < patch1.length; i++) {
    const diff = (patch1[i] - mean1) - (patch2[i] - mean2);
    ssd += diff * diff;
  }

  return ssd;
}

/**
 * Estimate camera pose from matched features
 * Returns translation in normalized coordinates
 */
export function estimatePose(
  matches: Match[],
  prevFeatures: Feature[],
  currFeatures: Feature[],
  intrinsics: [number, number, number, number] = [800, 800, 320, 240]
): { translation: [number, number, number]; inlierRatio: number; inlierCount: number } {
  if (matches.length < 8) {
    return { translation: [0, 0, 0], inlierRatio: 0, inlierCount: 0 };
  }

  const [fx, fy, cx, cy] = intrinsics;

  // Collect normalized image coordinates
  const flowsX: number[] = [];
  const flowsY: number[] = [];

  for (const m of matches) {
    if (m.prevIndex >= prevFeatures.length || m.currIndex >= currFeatures.length) {
      continue;
    }

    const prevPt = prevFeatures[m.prevIndex].pt;
    const currPt = currFeatures[m.currIndex].pt;

    // Normalize coordinates
    const prevX = (prevPt[0] - cx) / fx;
    const prevY = (prevPt[1] - cy) / fy;
    const currX = (currPt[0] - cx) / fx;
    const currY = (currPt[1] - cy) / fy;

    flowsX.push(currX - prevX);
    flowsY.push(currY - prevY);
  }

  if (flowsX.length < 8) {
    return { translation: [0, 0, 0], inlierRatio: 0, inlierCount: 0 };
  }

  // Compute median flow
  const sortedX = [...flowsX].sort((a, b) => a - b);
  const sortedY = [...flowsY].sort((a, b) => a - b);
  const medianFlowX = sortedX[Math.floor(sortedX.length / 2)];
  const medianFlowY = sortedY[Math.floor(sortedY.length / 2)];

  // Count inliers (points close to median flow)
  let madX = 0, madY = 0;
  for (const fx of flowsX) {
    madX += Math.abs(fx - medianFlowX);
  }
  for (const fy of flowsY) {
    madY += Math.abs(fy - medianFlowY);
  }
  madX = Math.abs(madX / flowsX.length);
  madY = Math.abs(madY / flowsY.length);

  const thresholdX = Math.max(0.001, Math.min(0.05, madX * 3));
  const thresholdY = Math.max(0.001, Math.min(0.05, madY * 3));

  let inliers = 0;
  for (let i = 0; i < flowsX.length; i++) {
    const dx = Math.abs(flowsX[i] - medianFlowX);
    const dy = Math.abs(flowsY[i] - medianFlowY);
    if (dx < thresholdX && dy < thresholdY) {
      inliers++;
    }
  }

  const inlierRatio = flowsX.length > 0 ? inliers / flowsX.length : 0;

  // Estimate translation with scale factor
  const scale = 0.05;
  const translation: [number, number, number] = [
    -medianFlowX * scale,
    -medianFlowY * scale,
    0,
  ];

  return { translation, inlierRatio, inlierCount: inliers };
}

/**
 * Convert image to grayscale Uint8Array
 */
export function imageToGrayscale(
  imageData: ImageData | Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const gray = new Uint8Array(width * height);

  if (imageData instanceof ImageData) {
    // RGBA format
    for (let i = 0; i < width * height; i++) {
      const r = imageData.data[i * 4];
      const g = imageData.data[i * 4 + 1];
      const b = imageData.data[i * 4 + 2];
      gray[i] = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
    }
  } else {
    // Assume grayscale or convert
    for (let i = 0; i < Math.min(imageData.length, gray.length); i++) {
      gray[i] = imageData[i];
    }
  }

  return gray;
}
