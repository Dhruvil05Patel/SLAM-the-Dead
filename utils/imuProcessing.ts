import {
  GRAVITY,
  ALPHA,
  VELOCITY_THRESHOLD,
  ACCELERATION_THRESHOLD,
  IMUState,
  Position,
  Velocity,
} from './constants';

// Export enhanced classes (new PDR-based approach)
export {
  EnhancedDeadReckoningEngine,
  GyroscopeBiasCalibration,
  GyroscopeOrientationDCM,
  MagnetometerOrientation,
  ComplementaryFilter,
  DynamicStepCounter,
} from './imuProcessingEnhanced';

/**
 * Legacy complementary filter for sensor fusion
 * (Kept for backward compatibility)
 */
export class LegacyComplementaryFilter {
  private alpha: number;
  private filteredX: number = 0;
  private filteredY: number = 0;
  private filteredZ: number = 0;

  constructor(alpha: number = ALPHA) {
    this.alpha = alpha;
  }

  /**
   * Apply complementary filter to sensor data
   */
  filter(rawX: number, rawY: number, rawZ: number): { x: number; y: number; z: number } {
    this.filteredX = this.alpha * this.filteredX + (1 - this.alpha) * rawX;
    this.filteredY = this.alpha * this.filteredY + (1 - this.alpha) * rawY;
    this.filteredZ = this.alpha * this.filteredZ + (1 - this.alpha) * rawZ;

    return {
      x: this.filteredX,
      y: this.filteredY,
      z: this.filteredZ,
    };
  }

  reset() {
    this.filteredX = 0;
    this.filteredY = 0;
    this.filteredZ = 0;
  }
}

/**
 * Simple Kalman Filter for 1D estimation
 */
export class KalmanFilter {
  private estimate: number = 0;
  private errorCovariance: number = 1;
  private processNoise: number;
  private measurementNoise: number;

  constructor(processNoise: number = 0.01, measurementNoise: number = 0.1) {
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }

  /**
   * Update the Kalman filter with a new measurement
   */
  update(measurement: number): number {
    // Prediction step
    const predictedErrorCovariance = this.errorCovariance + this.processNoise;

    // Update step
    const kalmanGain = predictedErrorCovariance / (predictedErrorCovariance + this.measurementNoise);
    this.estimate = this.estimate + kalmanGain * (measurement - this.estimate);
    this.errorCovariance = (1 - kalmanGain) * predictedErrorCovariance;

    return this.estimate;
  }

  reset() {
    this.estimate = 0;
    this.errorCovariance = 1;
  }
}

/**
 * Dead Reckoning Engine (Legacy - continuous integration approach)
 * Processes IMU data to estimate position over time
 * NOTE: For better accuracy, use EnhancedDeadReckoningEngine with step-based PDR
 */
export class DeadReckoningEngine {
  private state: IMUState;
  private accelFilter: LegacyComplementaryFilter;
  private kalmanX: KalmanFilter;
  private kalmanY: KalmanFilter;
  private lastUpdateTime: number;
  private gravityX: number = 0;
  private gravityY: number = 0;
  private gravityZ: number = GRAVITY;

  constructor() {
    this.state = {
      position: { x: 0, y: 0, timestamp: Date.now() },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      orientation: 0,
    };
    this.accelFilter = new LegacyComplementaryFilter(ALPHA);
    this.kalmanX = new KalmanFilter();
    this.kalmanY = new KalmanFilter();
    this.lastUpdateTime = Date.now();
  }

  /**
   * Remove gravity component from accelerometer data
   */
  private removeGravity(ax: number, ay: number, az: number): { x: number; y: number; z: number } {
    // Use low-pass filter to isolate gravity
    const alpha = 0.9;
    this.gravityX = alpha * this.gravityX + (1 - alpha) * ax;
    this.gravityY = alpha * this.gravityY + (1 - alpha) * ay;
    this.gravityZ = alpha * this.gravityZ + (1 - alpha) * az;

    // Linear acceleration = Raw acceleration - Gravity
    return {
      x: ax - this.gravityX,
      y: ay - this.gravityY,
      z: az - this.gravityZ,
    };
  }

  /**
   * Update orientation from magnetometer data
   */
  updateOrientation(mx: number, my: number, mz: number) {
    // Calculate heading from magnetometer (simplified 2D heading)
    this.state.orientation = Math.atan2(my, mx);
  }

  /**
   * Update state with gyroscope data
   */
  updateGyroscope(gx: number, gy: number, gz: number, deltaTime: number) {
    // Integrate gyroscope to update orientation
    // gz is the rotation around the vertical axis (yaw)
    this.state.orientation += gz * deltaTime;
    
    // Normalize to [-π, π]
    while (this.state.orientation > Math.PI) this.state.orientation -= 2 * Math.PI;
    while (this.state.orientation < -Math.PI) this.state.orientation += 2 * Math.PI;
  }

  /**
   * Update position using accelerometer data
   */
  updateAccelerometer(ax: number, ay: number, az: number): Position {
    const currentTime = Date.now();
    let deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
    // Clamp deltaTime to avoid spikes on resume or backgrounding
    if (!isFinite(deltaTime) || deltaTime <= 0) deltaTime = 0.001;
    if (deltaTime > 0.2) deltaTime = 0.2;
    this.lastUpdateTime = currentTime;

    // Remove gravity component
    const linearAccel = this.removeGravity(ax, ay, az);

    // Apply complementary filter to reduce noise
    const filtered = this.accelFilter.filter(linearAccel.x, linearAccel.y, linearAccel.z);

    // Apply threshold to reduce drift from noise
    const accelX = Math.abs(filtered.x) > ACCELERATION_THRESHOLD ? filtered.x : 0;
    const accelY = Math.abs(filtered.y) > ACCELERATION_THRESHOLD ? filtered.y : 0;

    // Store acceleration
    this.state.acceleration = { x: accelX, y: accelY, z: filtered.z };

    // Integrate acceleration to get velocity
    this.state.velocity.x += accelX * deltaTime;
    this.state.velocity.y += accelY * deltaTime;

    // Apply velocity threshold to reduce drift
    if (Math.abs(this.state.velocity.x) < VELOCITY_THRESHOLD) {
      this.state.velocity.x = 0;
    }
    if (Math.abs(this.state.velocity.y) < VELOCITY_THRESHOLD) {
      this.state.velocity.y = 0;
    }

    // Apply Kalman filter to velocity
    const filteredVelX = this.kalmanX.update(this.state.velocity.x);
    const filteredVelY = this.kalmanY.update(this.state.velocity.y);

    // Integrate velocity to get position
    // Rotate velocity based on device orientation
    const cos = Math.cos(this.state.orientation);
    const sin = Math.sin(this.state.orientation);
    
    const globalVelX = filteredVelX * cos - filteredVelY * sin;
    const globalVelY = filteredVelX * sin + filteredVelY * cos;

    // Scale up movement for better visualization (reduced multiplier for realism)
    // Real IMU-based DR produces very small movements that are hard to see
    const visualizationScale = 6;
    this.state.position.x += globalVelX * deltaTime * visualizationScale;
    this.state.position.y += globalVelY * deltaTime * visualizationScale;
    this.state.position.timestamp = currentTime;

    return { ...this.state.position };
  }

  /**
   * Get current state
   */
  getState(): IMUState {
    return { ...this.state };
  }

  /**
   * Get current position
   */
  getPosition(): Position {
    return { ...this.state.position };
  }

  /**
   * Reset the dead reckoning engine
   */
  reset() {
    this.state = {
      position: { x: 0, y: 0, timestamp: Date.now() },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      orientation: 0,
    };
    this.accelFilter.reset();
    this.kalmanX.reset();
    this.kalmanY.reset();
    this.lastUpdateTime = Date.now();
    this.gravityX = 0;
    this.gravityY = 0;
    this.gravityZ = GRAVITY;
  }
}

/**
 * Calculate distance between two positions
 */
export const calculateDistance = (p1: Position, p2: Position): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Calculate total path length
 */
export const calculatePathLength = (positions: Position[]): number => {
  let totalDistance = 0;
  for (let i = 1; i < positions.length; i++) {
    totalDistance += calculateDistance(positions[i - 1], positions[i]);
  }
  return totalDistance;
};

/**
 * Calculate drift (difference between DR and SLAM positions)
 */
export const calculateDrift = (drPosition: Position, slamPosition: Position): number => {
  return calculateDistance(drPosition, slamPosition);
};
