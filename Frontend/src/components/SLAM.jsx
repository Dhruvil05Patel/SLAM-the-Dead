import React, { useState, useEffect, useRef, useCallback } from "react";
import PathVisualizer from "./PathVisualizer";
import Card from "./Cards";
import { format2DData } from "../utils/formatters";

/**
 * SLAM - Real-time Visual SLAM for Mobile Web
 * Uses camera-based visual odometry for pose estimation
 */
export default function SLAM({ theme = "dark", onTrajectoryUpdate }) {
  // Camera & Video state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const processCanvasRef = useRef(null);
  const trajectoryCanvasRef = useRef(null);
  const streamRef = useRef(null);

  // SLAM state
  const [isRunning, setIsRunning] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [pose, setPose] = useState({ x: 0, y: 0, heading: 0 });
  const [trajectory, setTrajectory] = useState([{ x: 0, y: 0 }]);
  const [landmarkCount, setLandmarkCount] = useState(0);
  const [features, setFeatures] = useState([]);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState(null);
  const [depthAvailable, setDepthAvailable] = useState(false);
  const [sensorInfo, setSensorInfo] = useState("");
  
  // Advanced metrics
  const [trackingAccuracy, setTrackingAccuracy] = useState(0);
  const [mapDensity, setMapDensity] = useState(0);
  const [motionMagnitude, setMotionMagnitude] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  // Depth & AR state
  const depthDataRef = useRef(null);
  const arSessionRef = useRef(null);

  // Refs for state that doesn't trigger re-renders
  const poseRef = useRef({ x: 0, y: 0, heading: 0 });
  const trajectoryRef = useRef([{ x: 0, y: 0 }]);
  const landmarksRef = useRef([]);
  const prevFeaturesRef = useRef(null);
  const prevFrameRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastFrameTimeRef = useRef(0);

  const isLight = theme === "light";

  // ======================
  // FEATURE EXTRACTION
  // ======================

  /**
   * Extract corner features from grayscale frame using FAST-like detector
   */
  const extractFeatures = useCallback((frameData, depthData = null) => {
    const { width, height, data } = frameData;
    const features = [];
    const threshold = 20;
    const gridSize = 6;
    const grid = {};

    // Simple FAST-like corner detector
    const circle = [
      [-3, 0],
      [-3, 1],
      [-2, 2],
      [-1, 3],
      [0, 3],
      [1, 3],
      [2, 2],
      [3, 1],
      [3, 0],
      [3, -1],
      [2, -2],
      [1, -3],
      [0, -3],
      [-1, -3],
      [-2, -2],
      [-3, -1],
    ];

    // Optimize: larger step size for faster processing
    for (let y = 10; y < height - 10; y += 3) {
      for (let x = 10; x < width - 10; x += 3) {
        const centerIdx = y * width + x;
        const centerIntensity = data[centerIdx * 4];

        let brighterCount = 0;
        let darkerCount = 0;

        // Check circle pixels
        for (let i = 0; i < circle.length; i++) {
          const [dx, dy] = circle[i];
          const checkIdx = ((y + dy) * width + (x + dx)) * 4;
          const intensity = data[checkIdx];

          if (intensity > centerIntensity + threshold) brighterCount++;
          if (intensity < centerIntensity - threshold) darkerCount++;
        }

        // If enough pixels are brighter or darker, it's a corner
        if (brighterCount >= 12 || darkerCount >= 12) {
          const score = Math.max(brighterCount, darkerCount);
          const gridKey = `${Math.floor(x / gridSize)}_${Math.floor(
            y / gridSize
          )}`;

          // Get depth value if available (from AR depth sensing)
          let depth = null;
          if (depthData && depthData.data) {
            const depthIdx = centerIdx;
            if (depthIdx < depthData.data.length) {
              depth = depthData.data[depthIdx];
            }
          }

          // Non-maximum suppression within grid
          if (!grid[gridKey] || grid[gridKey].score < score) {
            grid[gridKey] = { x, y, score, brighterCount, darkerCount, depth };
          }
        }
      }
    }

    // Extract raw features from grid
    const rawFeatures = [];
    for (let key in grid) {
      rawFeatures.push(grid[key]);
    }

    // Analyze spatial clustering to distinguish obstacles from environment
    // Enhanced with depth information when available
    const clusterMap = new Map();
    const clusterSize = 35; // Smaller clusters for better human detection

    rawFeatures.forEach((feat) => {
      const clusterKey = `${Math.floor(feat.x / clusterSize)}_${Math.floor(
        feat.y / clusterSize
      )}`;
      if (!clusterMap.has(clusterKey)) {
        clusterMap.set(clusterKey, []);
      }
      clusterMap.get(clusterKey).push(feat);
    });

    // Calculate cluster statistics for better detection
    let maxClusterSize = 0;
    let totalFeatures = 0;
    const clusterSizes = [];

    clusterMap.forEach((cluster) => {
      const size = cluster.length;
      totalFeatures += size;
      clusterSizes.push(size);
      if (size > maxClusterSize) maxClusterSize = size;
    });

    // Sort to find median cluster size
    clusterSizes.sort((a, b) => a - b);
    const medianClusterSize =
      clusterSizes[Math.floor(clusterSizes.length / 2)] || 1;
    const avgClusterSize = totalFeatures / Math.max(clusterMap.size, 1);

    // Dynamic threshold based on scene complexity
    const obstacleDensityThreshold = Math.max(2.5, avgClusterSize * 1.4);

    // Classify each feature and KEEP ONLY obstacle-type features
    rawFeatures.forEach((feat) => {
      const clusterKey = `${Math.floor(feat.x / clusterSize)}_${Math.floor(
        feat.y / clusterSize
      )}`;
      const clusterDensity = clusterMap.get(clusterKey).length;

      let isObstacle = false;

      // 1. DEPTH-BASED: close depth => obstacle
      if (feat.depth !== null && feat.depth !== undefined) {
        if (feat.depth < 1.8) isObstacle = true;
        else if (feat.depth > 0.5 && feat.depth < 4.0 && clusterDensity >= 2)
          isObstacle = true;
      }

      // 2. Dense clusters
      if (!isObstacle && clusterDensity >= obstacleDensityThreshold * 1.1)
        isObstacle = true;

      // 3. High-contrast edges
      if (
        !isObstacle &&
        feat.score >= 15 &&
        Math.abs(feat.brighterCount - feat.darkerCount) <= 2
      )
        isObstacle = true;

      // 4. Center-frame vertical features
      if (
        !isObstacle &&
        feat.x > width * 0.3 &&
        feat.x < width * 0.7 &&
        feat.y > height * 0.2 &&
        feat.y < height * 0.8 &&
        clusterDensity >= medianClusterSize * 1.4
      )
        isObstacle = true;

      // 5. Strong corners or anomalies
      if (!isObstacle && feat.score >= 16) isObstacle = true;
      if (!isObstacle && clusterDensity > medianClusterSize * 2.2)
        isObstacle = true;

      // Only keep features considered obstacles
      if (isObstacle) {
        features.push({
          x: feat.x,
          y: feat.y,
          score: feat.score,
          type: "obstacle",
          depth: feat.depth,
        });
      }
    });

    return features.slice(0, 2200); // allow a few more validated obstacle features
  }, []);

  /**
   * Compute descriptor for a feature point (simple patch-based)
   * @param {ImageData} frameData - Image data
   * @param {Object} feature - Feature point {x, y}
   * @returns {Array} Simple descriptor vector
   */
  const computeDescriptor = useCallback((frameData, feature) => {
    const { width, data } = frameData;
    const { x, y } = feature;
    const patchSize = 3; // Reduced from 5 for faster computation
    const descriptor = [];

    for (let dy = -patchSize; dy <= patchSize; dy++) {
      for (let dx = -patchSize; dx <= patchSize; dx++) {
        const idx = ((y + dy) * width + (x + dx)) * 4;
        descriptor.push(data[idx] || 0);
      }
    }

    return descriptor;
  }, []);

  /**
   * Track features between consecutive frames using patch matching
   * @param {ImageData} prevFrame - Previous frame
   * @param {ImageData} currFrame - Current frame
   * @param {Array} prevFeatures - Features from previous frame
   * @returns {Array} Matched feature pairs [{prev, curr}, ...]
   */
  const trackFeatures = useCallback(
    (prevFrame, currFrame, prevFeatures) => {
      const matches = [];
      const searchRadius = 20; // Reduced from 30 for faster search
      const { width, height } = currFrame;

      // Sample only a subset of features for tracking to improve FPS
      const sampleStep = Math.max(1, Math.floor(prevFeatures.length / 300));

      for (let i = 0; i < prevFeatures.length; i += sampleStep) {
        const prevFeat = prevFeatures[i];
        const prevDesc = computeDescriptor(prevFrame, prevFeat);

        let bestMatch = null;
        let bestScore = Infinity;

        // Search for best match in current frame with larger step
        for (let dy = -searchRadius; dy <= searchRadius; dy += 3) {
          for (let dx = -searchRadius; dx <= searchRadius; dx += 3) {
            const currX = prevFeat.x + dx;
            const currY = prevFeat.y + dy;

            if (
              currX < 10 ||
              currX >= width - 10 ||
              currY < 10 ||
              currY >= height - 10
            ) {
              continue;
            }

            const currDesc = computeDescriptor(currFrame, {
              x: currX,
              y: currY,
            });

            // Compute Sum of Squared Differences (SSD)
            let ssd = 0;
            for (let j = 0; j < prevDesc.length; j++) {
              const diff = prevDesc[j] - currDesc[j];
              ssd += diff * diff;
            }

            if (ssd < bestScore) {
              bestScore = ssd;
              bestMatch = { x: currX, y: currY };
            }
          }
        }

        // Only accept good matches
        if (bestMatch && bestScore < 3000) {
          matches.push({
            prev: prevFeat,
            curr: bestMatch,
            score: bestScore,
          });
        }
      }

      return matches;
    },
    [computeDescriptor]
  );

  /**
   * Estimate pose change from matched features
   * Uses 2D motion estimation (translation + rotation)
   * @param {Array} matches - Matched feature pairs
   * @returns {Object} Pose delta {dx, dy, dHeading}
   */
  const estimatePose = useCallback((matches) => {
    if (matches.length < 5) {
      return { dx: 0, dy: 0, dHeading: 0 };
    }

    // Compute median displacement (robust to outliers)
    const displacements = matches.map((m) => ({
      dx: m.curr.x - m.prev.x,
      dy: m.curr.y - m.prev.y,
    }));

    displacements.sort((a, b) => a.dx - b.dx);
    const medianDx = displacements[Math.floor(displacements.length / 2)].dx;

    displacements.sort((a, b) => a.dy - b.dy);
    const medianDy = displacements[Math.floor(displacements.length / 2)].dy;

    // Estimate rotation from feature flow
    let rotationSum = 0;
    let rotationCount = 0;

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const angle1 = Math.atan2(m.prev.y - 240, m.prev.x - 320); // Center at 320x240
      const angle2 = Math.atan2(m.curr.y - 240, m.curr.x - 320);
      let dAngle = angle2 - angle1;

      // Normalize angle
      if (dAngle > Math.PI) dAngle -= 2 * Math.PI;
      if (dAngle < -Math.PI) dAngle += 2 * Math.PI;

      if (Math.abs(dAngle) < 0.5) {
        rotationSum += dAngle;
        rotationCount++;
      }
    }

    const dHeading = rotationCount > 0 ? rotationSum / rotationCount : 0;

    // Scale from pixels to meters (rough calibration)
    const pixelToMeter = 0.001; // Adjust based on camera FOV and distance

    return {
      dx: -medianDx * pixelToMeter, // Negative because camera moves opposite
      dy: medianDy * pixelToMeter,
      dHeading: dHeading,
    };
  }, []);

  /**
   * Fuse visual odometry (no IMU available in this build)
   * @param {Object} visualPose - Pose from visual odometry {dx, dy, dHeading}
   * @param {Number} dt - Time delta
   * @returns {Object} Pose delta (visual only)
   */
  // Simplified fusion: visual odometry only (no IMU)
  const fuseIMU = useCallback((visualPose, dt) => {
    return visualPose;
  }, []);

  /**
   * Update map landmarks with new features
   * @param {Array} landmarks - Current map landmarks
   * @param {Array} features - New detected features
   * @param {Object} currentPose - Current robot pose
   * @returns {Array} Updated landmarks
   */
  const updateMap = useCallback((landmarks, features, currentPose) => {
    const updatedLandmarks = [...landmarks];
    const maxLandmarks = 500;
    const matchThreshold = 10; // pixels

    features.forEach((feat) => {
      // Transform feature to world coordinates
      const worldX =
        currentPose.x + feat.x * 0.001 * Math.cos(currentPose.heading);
      const worldY =
        currentPose.y + feat.x * 0.001 * Math.sin(currentPose.heading);

      // Check if landmark already exists
      let matched = false;
      for (let i = 0; i < updatedLandmarks.length; i++) {
        const lm = updatedLandmarks[i];
        const dist = Math.hypot(lm.x - worldX, lm.y - worldY);

        if (dist < matchThreshold * 0.001) {
          // Update existing landmark
          lm.x = (lm.x * lm.quality + worldX) / (lm.quality + 1);
          lm.y = (lm.y * lm.quality + worldY) / (lm.quality + 1);
          lm.quality = Math.min(lm.quality + 1, 10);
          matched = true;
          break;
        }
      }

      // Add new landmark
      if (!matched && updatedLandmarks.length < maxLandmarks) {
        updatedLandmarks.push({
          id: Date.now() + Math.random(),
          x: worldX,
          y: worldY,
          quality: 1,
        });
      }
    });

    return updatedLandmarks;
  }, []);

  // IMU handlers removed — SLAM uses visual odometry only

  // ======================
  // CAMERA CONTROL
  // ======================

  const startCamera = async () => {
    try {
      setError(null);
      let sensorTypes = [];

      // Request camera access with high frame rate (fallback to lower rates if unavailable)
      let stream;
      try {
        // Try to get depth stream first (ARCore/ARKit supported devices)
        const constraints = {
          video: {
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 120 },
          },
        };

        // Check for depth sensor support
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");

        // Try to detect LiDAR/depth capable devices
        for (const device of videoDevices) {
          if (
            device.label.toLowerCase().includes("depth") ||
            device.label.toLowerCase().includes("tof") ||
            device.label.toLowerCase().includes("lidar")
          ) {
            sensorTypes.push("LiDAR/Depth");
            setDepthAvailable(true);
          }
        }

        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Check video track capabilities
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();

        if (capabilities.torch) sensorTypes.push("Torch");
        if (capabilities.zoom) sensorTypes.push("Zoom");

        sensorTypes.push("RGB Camera");
      } catch (err) {
        // Fallback to standard constraints if high FPS not supported
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
        sensorTypes.push("RGB Camera");
      }

      // Try to initialize WebXR for AR depth data (disabled to prevent fullscreen)
      // Uncomment below if you want AR session support
      /*
      if ("xr" in navigator) {
        try {
          const isARSupported = await navigator.xr.isSessionSupported(
            "immersive-ar"
          );
          if (isARSupported) {
            sensorTypes.push("WebXR AR");
            // Request AR session with depth sensing
            const xrSession = await navigator.xr
              .requestSession("immersive-ar", {
                requiredFeatures: ["local-floor"],
                optionalFeatures: ["depth-sensing", "hit-test", "anchors"],
              })
              .catch(() => null);

            if (xrSession) {
              arSessionRef.current = xrSession;
              sensorTypes.push("Depth Sensing");
              setDepthAvailable(true);
            }
          }
        } catch (xrErr) {
          console.log("WebXR AR not available:", xrErr);
        }
      }
      */

      setSensorInfo(
        sensorTypes.length > 0 ? sensorTypes.join(" + ") : "Basic Camera"
      );

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      return true;
    } catch (err) {
      setError(`Camera error: ${err.message}`);
      return false;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // End AR session if active
    if (arSessionRef.current) {
      arSessionRef.current.end();
      arSessionRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setDepthAvailable(false);
    setSensorInfo("");
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities();

    if (capabilities.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchEnabled }],
        });
        setTorchEnabled(!torchEnabled);
      } catch (err) {
        console.error("Torch error:", err);
      }
    }
  };

  // ======================
  // SLAM PROCESSING LOOP
  // ======================

  const processSLAMFrame = useCallback(() => {
    if (!isRunning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const processCanvas = processCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const processCtx = processCanvas.getContext("2d");

    // Calculate FPS
    const now = performance.now();
    const dt = (now - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = now;
    if (dt > 0) {
      setFps(Math.round(1 / dt));
    }

    // Draw video to canvas
    ctx.drawImage(video, 0, 0, 640, 480);
    const imageData = ctx.getImageData(0, 0, 640, 480);

    // Convert to grayscale
    const grayData = new ImageData(640, 480);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const gray =
        0.299 * imageData.data[i] +
        0.587 * imageData.data[i + 1] +
        0.114 * imageData.data[i + 2];
      grayData.data[i] = grayData.data[i + 1] = grayData.data[i + 2] = gray;
      grayData.data[i + 3] = 255;
    }

    // Extract features with depth data if available
    const features = extractFeatures(grayData, depthDataRef.current);

    // Draw live video on process canvas
    processCtx.drawImage(video, 0, 0, 640, 480);

    // Track features if we have previous frame
    let poseDelta = { dx: 0, dy: 0, dHeading: 0 };
    let matches = [];

    if (prevFrameRef.current && prevFeaturesRef.current) {
      matches = trackFeatures(
        prevFrameRef.current,
        grayData,
        prevFeaturesRef.current
      );

      if (matches.length > 5) {
        // Estimate visual odometry pose
        const visualPose = estimatePose(matches);

        // Use visual odometry (no IMU fusion)
        poseDelta = fuseIMU(visualPose, dt);
        
        // Calculate tracking accuracy
        const accuracy = Math.min(100, (matches.length / 10) * 10);
        setTrackingAccuracy(accuracy);
        
        // Calculate motion magnitude
        const magnitude = Math.sqrt(poseDelta.dx ** 2 + poseDelta.dy ** 2);
        setMotionMagnitude(magnitude);
      }
      
      setMatchCount(matches.length);
    }

    // Draw all detected features with color-coding based on type
    // Optimize: render only every 3rd feature for better FPS
    const time = performance.now() / 1000;
    const renderStep = Math.max(1, Math.floor(features.length / 1400)); // Render more points while keeping perf reasonable

    // Count obstacle features (we only keep obstacles now)
    let obstacleCount = features.length;

    for (let idx = 0; idx < features.length; idx += renderStep) {
      const feat = features[idx];
      // Simplified pulsing animation
      const pulse = Math.sin(time * 2 + idx * 0.05) * 0.15 + 0.85;

      // All features are obstacles now (smaller, sharper markers)
      const radius = 2.6 * pulse;
      processCtx.fillStyle = `rgba(34, 197, 94, ${0.9 * pulse})`;
      processCtx.beginPath();
      processCtx.arc(feat.x, feat.y, radius, 0, Math.PI * 2);
      processCtx.fill();

      // Thin double ring for precision
      processCtx.strokeStyle = `rgba(74, 222, 128, ${0.75 * pulse})`;
      processCtx.lineWidth = 1.4;
      processCtx.beginPath();
      processCtx.arc(feat.x, feat.y, radius + 2, 0, Math.PI * 2);
      processCtx.stroke();

      // Subtle inner glow
      processCtx.strokeStyle = `rgba(134, 239, 172, ${0.45 * pulse})`;
      processCtx.lineWidth = 0.8;
      processCtx.beginPath();
      processCtx.arc(feat.x, feat.y, radius + 3.5, 0, Math.PI * 2);
      processCtx.stroke();
    }

    // Draw legend on canvas - centered at top
    const legendWidth = depthAvailable ? 320 : 280;
    const legendHeight = depthAvailable ? 75 : 60;
    const legendX = (640 - legendWidth) / 2;
    processCtx.fillStyle = "rgba(0, 0, 0, 0.75)";
    processCtx.fillRect(legendX, 10, legendWidth, legendHeight);

    // Title
    processCtx.fillStyle = "white";
    processCtx.font = "bold 13px Arial";
    processCtx.textAlign = "center";
    const titleText = depthAvailable
      ? "Feature Detection (LiDAR/Depth Enhanced)"
      : "Feature Detection";
    processCtx.fillText(titleText, legendX + legendWidth / 2, 28);

    // Obstacles count - centered
    const obstacleX = legendX + 40;
    processCtx.fillStyle = "rgba(34, 197, 94, 1)";
    processCtx.fillRect(obstacleX, 40, 10, 10);
    processCtx.fillStyle = "rgba(34, 197, 94, 1)";
    processCtx.font = "12px Arial";
    processCtx.textAlign = "left";
    processCtx.fillText(`Obstacles: ${obstacleCount}`, obstacleX + 15, 49);

    // Depth indicator if available
    if (depthAvailable) {
      processCtx.fillStyle = "rgba(100, 200, 255, 1)";
      processCtx.font = "10px Arial";
      processCtx.textAlign = "center";
      processCtx.fillText(
        "⚡ Depth Sensing Active",
        legendX + legendWidth / 2,
        68
      );
    }

    // Reset text align
    processCtx.textAlign = "left";

    // Update pose
    const newPose = {
      x: poseRef.current.x + poseDelta.dx,
      y: poseRef.current.y + poseDelta.dy,
      heading: poseRef.current.heading + poseDelta.dHeading,
    };

    poseRef.current = newPose;
    setPose(newPose);

    // Update trajectory
    const newTrajectory = [
      ...trajectoryRef.current,
      { x: newPose.x, y: newPose.y },
    ];
    if (newTrajectory.length > 500) newTrajectory.shift(); // Limit trajectory length
    trajectoryRef.current = newTrajectory;
    setTrajectory(newTrajectory);
    if (onTrajectoryUpdate) onTrajectoryUpdate(newTrajectory);

    // Update map
    const updatedLandmarks = updateMap(landmarksRef.current, features, newPose);
    landmarksRef.current = updatedLandmarks;
    setLandmarkCount(updatedLandmarks.length);
    
    // Calculate map density (landmarks per square meter)
    const mapArea = Math.max(1, (newPose.x * newPose.x + newPose.y * newPose.y) * 0.5);
    const density = Math.min(100, (updatedLandmarks.length / mapArea) * 10);
    setMapDensity(density);

    // Update features state for UI display
    setFeatures(features);

    // Draw trajectory
    drawTrajectory();

    // Store current frame and features for next iteration
    prevFrameRef.current = grayData;
    prevFeaturesRef.current = features;

    // Continue loop
    animationFrameRef.current = requestAnimationFrame(processSLAMFrame);
  }, [
    isRunning,
    extractFeatures,
    trackFeatures,
    estimatePose,
    fuseIMU,
    updateMap,
  ]);

  /**
   * Draw 2D trajectory on canvas
   */
  const drawTrajectory = useCallback(() => {
    const canvas = trajectoryCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    const traj = trajectoryRef.current;
    if (traj.length < 2) return;

    // Find bounds
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    traj.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const rangeX = Math.max(maxX - minX, 1);
    const rangeY = Math.max(maxY - minY, 1);
    const padding = 20;

    // Draw trajectory
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.beginPath();

    traj.forEach((p, i) => {
      const x = padding + ((p.x - minX) / rangeX) * (width - 2 * padding);
      const y =
        height - padding - ((p.y - minY) / rangeY) * (height - 2 * padding);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw start point
    const start = traj[0];
    const sx = padding + ((start.x - minX) / rangeX) * (width - 2 * padding);
    const sy =
      height - padding - ((start.y - minY) / rangeY) * (height - 2 * padding);
    ctx.fillStyle = "#0088ff";
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw current point
    const curr = traj[traj.length - 1];
    const cx = padding + ((curr.x - minX) / rangeX) * (width - 2 * padding);
    const cy =
      height - padding - ((curr.y - minY) / rangeY) * (height - 2 * padding);
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw landmarks
    ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
    landmarksRef.current.forEach((lm) => {
      const lx = padding + ((lm.x - minX) / rangeX) * (width - 2 * padding);
      const ly =
        height - padding - ((lm.y - minY) / rangeY) * (height - 2 * padding);
      ctx.fillRect(lx - 1, ly - 1, 2, 2);
    });
  }, []);

  // ======================
  // CONTROL HANDLERS
  // ======================

  const handleStart = async () => {
    const success = await startCamera();
    if (success) {
      setIsRunning(true);
      lastFrameTimeRef.current = performance.now();
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    stopCamera();
  };

  const handleReset = () => {
    poseRef.current = { x: 0, y: 0, heading: 0 };
    trajectoryRef.current = [{ x: 0, y: 0 }];
    landmarksRef.current = [];
    prevFrameRef.current = null;
    prevFeaturesRef.current = null;

    setPose({ x: 0, y: 0, heading: 0 });
    const resetTraj = [{ x: 0, y: 0 }];
    setTrajectory(resetTraj);
    if (onTrajectoryUpdate) onTrajectoryUpdate(resetTraj);
    setLandmarkCount(0);
    setFeatures([]);
  };

  // Start processing loop when running
  useEffect(() => {
    if (isRunning) {
      animationFrameRef.current = requestAnimationFrame(processSLAMFrame);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, processSLAMFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className={`module-shell ${isLight ? "module-light" : "module-dark"} w-full h-full ${isLight ? "bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 text-slate-900" : "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white"} overflow-y-auto flex flex-col`}>
      {/* Hero / Header */}
      <div className={`p-6 md:p-7 border-b ${isLight ? "border-blue-200 bg-blue-50/40 text-slate-900" : "border-white/10 bg-white/5"} backdrop-blur-lg`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.3em] ${isLight ? "text-blue-600/80" : "text-cyan-200/80"} mb-2`}>
              Specter SLAM
            </p>
            <h2 className={`text-2xl md:text-3xl font-semibold ${isLight ? "text-blue-900" : "text-white"} drop-shadow`}>
              Field-ready spatial scanner
            </h2>
            <p className={`text-sm ${isLight ? "text-slate-600" : "text-slate-200/90"} mt-2 max-w-2xl`}>
              Camera-first view with obstacle-only overlays, torch-aware rendering,
              and depth hints for dim corridors.
            </p>
            <div className={`flex flex-wrap gap-2 mt-3 text-[11px] ${isLight ? "text-slate-600" : "text-white/80"}`}>
              {"Feature isolates,Visual odometry,Depth ready".split(",").map(
                (label) => (
                  <span
                    key={label}
                    className={`px-3 py-1 rounded-full border ${isLight ? "border-blue-300 bg-blue-100/60 text-blue-700" : "border-white/20 bg-white/5 text-white"}`}
                  >
                    {label}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 items-start md:items-end">
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={handleStart}
                disabled={isRunning}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#5bf870] via-[#9efcf6] to-[#ff7ac3] text-slate-950 font-semibold shadow-lg shadow-[0_10px_40px_rgba(158,252,246,0.4)] hover:brightness-110 disabled:opacity-50 text-sm"
              >
                Start
              </button>
              <button
                onClick={handleStop}
                disabled={!isRunning}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff8bb0] to-[#ffc76f] text-slate-950 font-semibold shadow-lg shadow-[0_10px_40px_rgba(255,139,176,0.35)] hover:brightness-110 disabled:opacity-50 text-sm"
              >
                Stop
              </button>
              <button
                onClick={handleReset}
                className={`px-4 py-2 rounded-xl border font-semibold text-sm transition ${isLight ? "border-blue-300 bg-blue-100/40 text-blue-700 hover:border-blue-400" : "border-white/20 bg-black/40 text-white hover:border-white/60"}`}
              >
                Reset
              </button>
              <button
                onClick={toggleTorch}
                disabled={!isRunning}
                className={`px-4 py-2 rounded-xl font-semibold text-sm border transition ${
                  torchEnabled
                    ? "bg-amber-500/90 text-slate-950 border-amber-300"
                    : isLight ? "bg-blue-100/40 border-blue-300 text-blue-700" : "bg-black/50 border-white/15 text-white"
                } disabled:opacity-50`}
              >
                {torchEnabled ? "Torch On" : "Torch Off"}
              </button>
            </div>
            <div className={`flex gap-2 flex-wrap justify-end text-[11px] ${isLight ? "text-slate-600" : "text-white/80"}`}>
              <span
                className={`px-2.5 py-1 rounded-full border ${
                  isRunning
                    ? isLight ? "border-blue-400 bg-blue-100/60 text-blue-700" : "border-emerald-300/70 bg-emerald-500/15 text-emerald-100"
                    : isLight ? "border-slate-300 bg-slate-200/60 text-slate-600" : "border-slate-500/60 bg-slate-800/60 text-slate-200"
                }`}
              >
                {isRunning ? "Live" : "Idle"}
              </span>
              {sensorInfo && (
                <span className={`px-2.5 py-1 rounded-full border ${isLight ? "border-blue-400 bg-blue-100/60 text-blue-700" : "border-cyan-300/60 bg-cyan-500/10 text-cyan-100"}`}>
                  {sensorInfo}
                </span>
              )}
              {depthAvailable && (
                <span className={`px-2.5 py-1 rounded-full border ${isLight ? "border-orange-400 bg-orange-100/60 text-orange-700" : "border-amber-300/60 bg-amber-500/10 text-amber-100"}`}>
                  Depth/LiDAR Active
                </span>
              )}
            </div>
            {error && (
              <p className={`text-sm border rounded px-3 py-2 mt-1 max-w-md text-right ${isLight ? "text-orange-700 bg-orange-100/40 border-orange-300" : "text-rose-300 bg-rose-900/40 border-rose-500/50"}`}>
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stat Strip */}
      <div className={`grid grid-cols-2 md:grid-cols-5 gap-3 px-6 md:px-8 py-4 ${isLight ? "bg-blue-100/30 border-b border-blue-200" : "bg-black/30 backdrop-blur border-b border-white/10"}`}>
        <div className={`rounded-xl border p-3 shadow-inner ${isLight ? "bg-white/40 border-blue-200 text-slate-900" : "bg-black/40 border-white/15"}`}>
          <div className={`text-[11px] uppercase tracking-wide ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            FPS
          </div>
          <div className={`text-2xl font-bold ${isLight ? "text-blue-700" : "text-emerald-300"}`}>{fps}</div>
        </div>
        <div className={`rounded-xl border p-3 shadow-inner ${isLight ? "bg-white/40 border-blue-200 text-slate-900" : "bg-black/40 border-white/15"}`}>
          <div className={`text-[11px] uppercase tracking-wide ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            Landmarks
          </div>
          <div className={`text-2xl font-bold ${isLight ? "text-blue-600" : "text-cyan-300"}`}>
            {landmarkCount}
          </div>
        </div>
        <div className={`rounded-xl border p-3 shadow-inner ${isLight ? "bg-white/40 border-blue-200 text-slate-900" : "bg-black/40 border-white/15"}`}>
          <div className={`text-[11px] uppercase tracking-wide ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            Pose X/Y
          </div>
          <div className={`text-sm ${isLight ? "text-slate-700" : "text-slate-200"}`}>{format2DData(pose)}</div>
        </div>
        <div className={`rounded-xl border p-3 shadow-inner ${isLight ? "bg-white/40 border-blue-200 text-slate-900" : "bg-black/40 border-white/15"}`}>
          <div className={`text-[11px] uppercase tracking-wide ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            Tracking Acc.
          </div>
          <div className={`text-2xl font-bold ${isLight ? "text-purple-700" : "text-purple-300"}`}>{trackingAccuracy.toFixed(0)}%</div>
        </div>
        <div className={`rounded-xl border p-3 shadow-inner ${isLight ? "bg-white/40 border-blue-200 text-slate-900" : "bg-black/40 border-white/15"}`}>
          <div className={`text-[11px] uppercase tracking-wide ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            Motion Mag.
          </div>
          <div className={`text-2xl font-bold ${isLight ? "text-orange-700" : "text-orange-300"}`}>{motionMagnitude.toFixed(3)}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex flex-col xl:grid xl:grid-cols-[1.15fr_0.85fr] gap-6 flex-1 p-6 md:p-8 min-h-0 ${isLight ? "bg-white/20" : ""}`}>
        {/* Camera Panel */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className={`border rounded-2xl shadow-2xl overflow-hidden flex-1 min-h-0 ${isLight ? "bg-white/60 border-blue-200" : "bg-black/35 border-white/15"}`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isLight ? "bg-blue-100/40 border-blue-200 text-slate-900" : "bg-white/5 border-white/10"}`}>
              <div>
                <p className={`text-[11px] uppercase tracking-[0.2em] ${isLight ? "text-blue-700/80" : "text-cyan-300/80"}`}>
                  Live Camera
                </p>
                <h3 className={`text-lg font-semibold ${isLight ? "text-blue-900" : "text-white"}`}>
                  Feature Detection Overlay
                </h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-[11px] border ${isLight ? "bg-orange-100/60 border-orange-300 text-orange-700" : "bg-rose-500/15 border-rose-400/40 text-rose-100"}`}>
                Obstacles
              </span>
            </div>
            <div
              className="relative w-full h-full"
              style={{ minHeight: "320px" }}
            >
              <video
                ref={videoRef}
                className="absolute top-0 left-0 w-full h-full opacity-0 object-cover"
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="hidden"
              />
              <canvas
                ref={processCanvasRef}
                width={640}
                height={480}
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Quick Hints */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className={`rounded-xl border p-3 ${isLight ? "border-blue-200 bg-blue-100/40 text-slate-700" : "border-white/15 bg-white/5 text-slate-200"}`}>
              Run in bold light for crisp features.
            </div>
            <div className={`rounded-xl border p-3 ${isLight ? "border-blue-200 bg-blue-100/40 text-slate-700" : "border-white/15 bg-white/5 text-slate-200"}`}>
              Depth/LiDAR boosts close obstacle certainty.
            </div>
            <div className={`rounded-xl border p-3 ${isLight ? "border-blue-200 bg-blue-100/40 text-slate-700" : "border-white/15 bg-white/5 text-slate-200"}`}>
              Keep motion smooth to cut blur noise.
            </div>
          </div>
        </div>

        {/* Data Panel */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className={`border rounded-2xl shadow-xl overflow-hidden ${isLight ? "bg-white/60 border-blue-200" : "bg-black/35 border-white/15"}`}>
            <div className={`px-4 py-3 border-b ${isLight ? "bg-blue-100/40 border-blue-200 text-slate-900" : "bg-white/5 border-white/10"}`}>
              <p className={`text-[11px] uppercase tracking-[0.2em] ${isLight ? "text-blue-700/80" : "text-emerald-300/80"}`}>
                Path
              </p>
              <h3 className={`text-lg font-semibold ${isLight ? "text-blue-900" : "text-white"}`}>SLAM Trajectory</h3>
            </div>
            <div className="p-3">
              <div className={`rounded-xl overflow-hidden border ${isLight ? "border-blue-200 bg-white" : "border-white/10 bg-slate-950"}`}>
                <PathVisualizer path={trajectory} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`border rounded-2xl shadow-xl p-4 ${isLight ? "bg-white/60 border-blue-200" : "bg-black/35 border-white/15"}`}>
              <p className={`text-[11px] uppercase tracking-[0.2em] ${isLight ? "text-blue-700/80" : "text-cyan-300/80"}`}>
                Pose
              </p>
              <h3 className={`text-lg font-semibold mb-2 ${isLight ? "text-blue-900" : "text-white"}`}>Measured Position</h3>
              <Card
                title="SLAM Position (2D)"
                dataString={format2DData(pose)}
                unit="meters"
                theme={theme}
              />
            </div>

            <div className={`border rounded-2xl shadow-xl p-4 ${isLight ? "bg-white/60 border-blue-200" : "bg-black/35 border-white/15"}`}>
              <p className={`text-[11px] uppercase tracking-[0.2em] ${isLight ? "text-orange-700/80" : "text-amber-300/80"}`}>
                Metrics
              </p>
              <h3 className={`text-lg font-semibold mb-2 ${isLight ? "text-blue-900" : "text-white"}`}>Match Quality</h3>
              <div className={`grid grid-cols-2 gap-2 text-xs ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                <div className={`rounded border p-2 ${isLight ? "bg-blue-50 border-blue-200" : "bg-white/5 border-white/10"}`}>
                  <div className={`font-semibold ${isLight ? "text-orange-700" : "text-orange-400"}`}>{matchCount}</div>
                  <div className={isLight ? "text-slate-600" : "text-slate-400"}>Matches</div>
                </div>
                <div className={`rounded border p-2 ${isLight ? "bg-blue-50 border-blue-200" : "bg-white/5 border-white/10"}`}>
                  <div className={`font-semibold ${isLight ? "text-purple-700" : "text-purple-400"}`}>{mapDensity.toFixed(1)}</div>
                  <div className={isLight ? "text-slate-600" : "text-slate-400"}>Map Density</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
