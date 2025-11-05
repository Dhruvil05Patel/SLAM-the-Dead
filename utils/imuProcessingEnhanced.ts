import {
  GRAVITY,
  ALPHA,
  IMUState,
  Position,
} from './constants';

/**
 * Enhanced IMU Processing based on nisargnp/DeadReckoning approach
 * Implements Pedestrian Dead Reckoning (PDR) with:
 * - Step detection (Dynamic Step Counter)
 * - Direction Cosine Matrix (DCM) for orientation
 * - Complementary filter for heading fusion
 * - Gyroscope bias calibration
 */

/**
 * 3x3 Matrix operations for Direction Cosine Matrix
 */
class Matrix3x3 {
  data: number[][];

  constructor(initial?: number[][]) {
    if (initial) {
      this.data = initial.map(row => [...row]);
    } else {
      // Identity matrix
      this.data = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ];
    }
  }

  static identity(): Matrix3x3 {
    return new Matrix3x3();
  }

  static multiply(a: Matrix3x3, b: Matrix3x3): Matrix3x3 {
    const result = new Matrix3x3();
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        result.data[i][j] = 0;
        for (let k = 0; k < 3; k++) {
          result.data[i][j] += a.data[i][k] * b.data[k][j];
        }
      }
    }
    return result;
  }

  static add(a: Matrix3x3, b: Matrix3x3): Matrix3x3 {
    const result = new Matrix3x3();
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        result.data[i][j] = a.data[i][j] + b.data[i][j];
      }
    }
    return result;
  }

  static scale(matrix: Matrix3x3, scalar: number): Matrix3x3 {
    const result = new Matrix3x3();
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        result.data[i][j] = matrix.data[i][j] * scalar;
      }
    }
    return result;
  }

  getHeading(): number {
    // Extract heading from DCM: atan2(C[1][0], C[0][0])
    return Math.atan2(this.data[1][0], this.data[0][0]);
  }

  clone(): Matrix3x3 {
    return new Matrix3x3(this.data);
  }
}

/**
 * Gyroscope bias calibration
 * Computes running average of gyroscope readings when stationary
 */
export class GyroscopeBiasCalibration {
  private bias: { x: number; y: number; z: number };
  private sampleCount: number;
  private readonly maxSamples: number;
  private isCalibrated: boolean;

  constructor(maxSamples: number = 300) {
    this.bias = { x: 0, y: 0, z: 0 };
    this.sampleCount = 0;
    this.maxSamples = maxSamples;
    this.isCalibrated = false;
  }

  addSample(gx: number, gy: number, gz: number): boolean {
    if (this.sampleCount >= this.maxSamples) {
      return true; // Calibration complete
    }

    if (this.sampleCount === 0) {
      this.bias.x = gx;
      this.bias.y = gy;
      this.bias.z = gz;
    } else {
      // Moving average
      const n = this.sampleCount + 1;
      this.bias.x = (this.bias.x * this.sampleCount + gx) / n;
      this.bias.y = (this.bias.y * this.sampleCount + gy) / n;
      this.bias.z = (this.bias.z * this.sampleCount + gz) / n;
    }

    this.sampleCount++;

    if (this.sampleCount >= this.maxSamples) {
      this.isCalibrated = true;
      console.log(`Gyroscope bias calibrated: x=${this.bias.x.toFixed(4)}, y=${this.bias.y.toFixed(4)}, z=${this.bias.z.toFixed(4)}`);
      return true;
    }

    return false;
  }

  getBias(): { x: number; y: number; z: number } {
    return { ...this.bias };
  }

  getCalibrationProgress(): number {
    return Math.min(this.sampleCount / this.maxSamples, 1.0);
  }

  isComplete(): boolean {
    return this.isCalibrated;
  }

  reset() {
    this.bias = { x: 0, y: 0, z: 0 };
    this.sampleCount = 0;
    this.isCalibrated = false;
  }
}

/**
 * Direction Cosine Matrix (DCM) based gyroscope orientation
 * Integrates gyroscope data to track device orientation
 */
export class GyroscopeOrientationDCM {
  private dcm: Matrix3x3;
  private lastTimestamp: number = 0;
  private isFirstRun: boolean = true;
  private sensitivity: number;
  private bias: { x: number; y: number; z: number };

  constructor(sensitivity: number = 0.0025, initialOrientation?: Matrix3x3) {
    this.dcm = initialOrientation ? initialOrientation.clone() : Matrix3x3.identity();
    this.sensitivity = sensitivity;
    this.bias = { x: 0, y: 0, z: 0 };
  }

  setBias(bias: { x: number; y: number; z: number }) {
    this.bias = bias;
  }

  private removeBias(gx: number, gy: number, gz: number): { x: number; y: number; z: number } {
    const unbiased = {
      x: gx - this.bias.x,
      y: gy - this.bias.y,
      z: gz - this.bias.z
    };

    // Apply sensitivity threshold (high-pass filter)
    return {
      x: Math.abs(unbiased.x) > this.sensitivity ? unbiased.x : 0,
      y: Math.abs(unbiased.y) > this.sensitivity ? unbiased.y : 0,
      z: Math.abs(unbiased.z) > this.sensitivity ? unbiased.z : 0
    };
  }

  updateOrientation(gx: number, gy: number, gz: number, timestamp: number): number {
    if (this.isFirstRun) {
      this.lastTimestamp = timestamp;
      this.isFirstRun = false;
      return this.getHeading();
    }

    const deltaTime = (timestamp - this.lastTimestamp) / 1000; // Convert ms to seconds
    this.lastTimestamp = timestamp;

    // Remove bias and apply threshold
    const gyro = this.removeBias(gx, gy, gz);

    // Integrate using small angle approximation
    // dC/dt = C * Ω where Ω is the skew-symmetric matrix of angular velocity
    const norm = Math.sqrt(gyro.x ** 2 + gyro.y ** 2 + gyro.z ** 2);

    if (norm < 0.0001) {
      return this.getHeading(); // No significant rotation
    }

    // Create skew-symmetric matrix B
    const B = new Matrix3x3([
      [0, gyro.z, -gyro.y],
      [-gyro.z, 0, gyro.x],
      [gyro.y, -gyro.x, 0]
    ]);

    // B²
    const B_sq = Matrix3x3.multiply(B, B);

    // Taylor series approximation for small angles
    // A = I + (sin σ / σ) * B + ((1 - cos σ) / σ²) * B²
    const sigma = norm * deltaTime;
    
    // (sin σ) / σ ≈ 1 - (σ² / 6) + (σ⁴ / 120)
    const sinSigmaOverSigma = sigma < 0.1 
      ? 1 - (sigma ** 2) / 6 + (sigma ** 4) / 120
      : Math.sin(sigma) / sigma;

    // (1 - cos σ) / σ² ≈ 0.5 - (σ² / 24) + (σ⁴ / 720)
    const oneMinusCosSigmaOverSigmaSq = sigma < 0.1
      ? 0.5 - (sigma ** 2) / 24 + (sigma ** 4) / 720
      : (1 - Math.cos(sigma)) / (sigma ** 2);

    const B_scaled = Matrix3x3.scale(B, sinSigmaOverSigma * deltaTime);
    const B_sq_scaled = Matrix3x3.scale(B_sq, oneMinusCosSigmaOverSigmaSq * deltaTime * deltaTime);

    // A = I + B_scaled + B_sq_scaled
    const A = Matrix3x3.add(
      Matrix3x3.add(Matrix3x3.identity(), B_scaled),
      B_sq_scaled
    );

    // Update DCM: C_new = C_old * A
    this.dcm = Matrix3x3.multiply(this.dcm, A);

    return this.getHeading();
  }

  getHeading(): number {
    return this.dcm.getHeading();
  }

  reset() {
    this.dcm = Matrix3x3.identity();
    this.lastTimestamp = 0;
    this.isFirstRun = true;
  }
}

/**
 * Magnetometer-based heading calculation
 */
export class MagnetometerOrientation {
  private magBias: { x: number; y: number; z: number };

  constructor() {
    this.magBias = { x: 0, y: 0, z: 0 };
  }

  setBias(bias: { x: number; y: number; z: number }) {
    this.magBias = bias;
  }

  getHeading(mx: number, my: number, mz: number): number {
    // Remove bias
    const magX = mx - this.magBias.x;
    const magY = my - this.magBias.y;

    // Calculate heading from horizontal components
    return Math.atan2(magY, magX);
  }
}

/**
 * Complementary filter for sensor fusion
 * Combines magnetometer and gyroscope headings
 */
export class ComplementaryFilter {
  private alpha: number;

  constructor(alpha: number = 0.98) {
    this.alpha = alpha; // 0.98 for gyroscope, 0.02 for magnetometer
  }

  filter(magHeading: number, gyroHeading: number): number {
    // Normalize angles to [0, 2π]
    let mag = magHeading < 0 ? (magHeading % (2 * Math.PI)) + 2 * Math.PI : magHeading;
    let gyro = gyroHeading < 0 ? (gyroHeading % (2 * Math.PI)) + 2 * Math.PI : gyroHeading;

    // Handle wrap-around
    const diff = mag - gyro;
    if (Math.abs(diff) > Math.PI) {
      if (mag > gyro) {
        mag -= 2 * Math.PI;
      } else {
        gyro -= 2 * Math.PI;
      }
    }

    // Complementary filter
    let filtered = this.alpha * gyro + (1 - this.alpha) * mag;

    // Normalize to [-π, π]
    while (filtered > Math.PI) filtered -= 2 * Math.PI;
    while (filtered < -Math.PI) filtered += 2 * Math.PI;

    return filtered;
  }
}

/**
 * Dynamic Step Counter
 * Detects steps from linear acceleration magnitude using adaptive thresholds
 */
export class DynamicStepCounter {
  private sensitivity: number;
  private upperThreshold: number;
  private lowerThreshold: number;
  private stepCount: number = 0;
  private peakFound: boolean = false;
  private firstRun: boolean = true;
  private avgAcc: number = 0;
  private runCount: number = 0;
  private smoothedAcc: number = 0;
  private readonly ewmaBeta: number;
  private readonly minStepIntervalMs: number;
  private lastStepTimestamp: number = 0;

  constructor(sensitivity: number = 0.65, minStepIntervalMs: number = 250, ewmaBeta: number = 0.25) {
    this.sensitivity = sensitivity;
    this.upperThreshold = 10.8;
    this.lowerThreshold = 8.8;
    this.minStepIntervalMs = minStepIntervalMs;
    this.ewmaBeta = ewmaBeta;
  }

  findStep(accelerationMagnitude: number, timestampMs: number): boolean {
    // Smooth the magnitude to stabilize peaks
    this.smoothedAcc = this.firstRun
      ? accelerationMagnitude
      : this.ewmaBeta * accelerationMagnitude + (1 - this.ewmaBeta) * this.smoothedAcc;

    // Update thresholds from smoothed value
    this.updateThresholds(this.smoothedAcc);

    // Enforce minimum interval between detected steps to reduce double-counting
    const refractoryOk = (timestampMs - this.lastStepTimestamp) >= this.minStepIntervalMs;

    // Detect step (peak above upper threshold) on smoothed signal
    if (this.smoothedAcc > this.upperThreshold && refractoryOk) {
      if (!this.peakFound) {
        this.stepCount++;
        this.peakFound = true;
        this.lastStepTimestamp = timestampMs;
        return true;
      }
    }
    // Reset peak detection after crossing lower threshold
    else if (this.smoothedAcc < this.lowerThreshold) {
      this.peakFound = false;
    }

    return false;
  }

  private updateThresholds(acc: number) {
    this.runCount++;

    if (this.firstRun) {
      this.upperThreshold = acc + this.sensitivity;
      this.lowerThreshold = acc - this.sensitivity;
      this.avgAcc = acc;
      this.smoothedAcc = acc;
      this.firstRun = false;
      return;
    }

    // Moving average baseline
    this.avgAcc = (this.avgAcc * (this.runCount - 1) + acc) / this.runCount;
    this.upperThreshold = this.avgAcc + this.sensitivity;
    this.lowerThreshold = this.avgAcc - this.sensitivity;
  }

  getStepCount(): number {
    return this.stepCount;
  }

  reset() {
    this.stepCount = 0;
    this.peakFound = false;
    this.firstRun = true;
    this.avgAcc = 0;
    this.runCount = 0;
  }
}

/**
 * Enhanced Dead Reckoning Engine using Pedestrian Dead Reckoning (PDR)
 */
export class EnhancedDeadReckoningEngine {
  private state: IMUState;
  private gyroBiasCalibration: GyroscopeBiasCalibration;
  private gyroOrientation: GyroscopeOrientationDCM;
  private magOrientation: MagnetometerOrientation;
  private complementaryFilter: ComplementaryFilter;
  private stepCounter: DynamicStepCounter;
  private strideLength: number; // in meters
  private magHeading: number = 0;
  private gyroHeading: number = 0;
  private fusedHeading: number = 0;
  private initialHeading: number = 0;
  private gravityX: number = 0;
  private gravityY: number = 0;
  private gravityZ: number = GRAVITY;

  constructor(strideLength: number = 0.75) {
    this.state = {
      position: { x: 0, y: 0, timestamp: Date.now() },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      orientation: 0,
    };
    this.strideLength = strideLength;
    this.gyroBiasCalibration = new GyroscopeBiasCalibration();
    this.gyroOrientation = new GyroscopeOrientationDCM();
    this.magOrientation = new MagnetometerOrientation();
    this.complementaryFilter = new ComplementaryFilter();
    // Slightly lower sensitivity and enforce a refractory period for more reliable step detection
    this.stepCounter = new DynamicStepCounter(0.65, 250, 0.25);
  }

  /**
   * Remove gravity component from accelerometer data
   */
  private removeGravity(ax: number, ay: number, az: number): { x: number; y: number; z: number } {
    // Slightly faster response to walking dynamics
    const alpha = 0.8;
    this.gravityX = alpha * this.gravityX + (1 - alpha) * ax;
    this.gravityY = alpha * this.gravityY + (1 - alpha) * ay;
    this.gravityZ = alpha * this.gravityZ + (1 - alpha) * az;

    return {
      x: ax - this.gravityX,
      y: ay - this.gravityY,
      z: az - this.gravityZ,
    };
  }

  /**
   * Update with accelerometer data (for step detection)
   */
  updateAccelerometer(ax: number, ay: number, az: number): { stepDetected: boolean; position: Position } {
    const currentTime = Date.now();

    // Remove gravity to get linear acceleration
    const linearAccel = this.removeGravity(ax, ay, az);

    // Calculate magnitude
    const magnitude = Math.sqrt(
      linearAccel.x ** 2 + linearAccel.y ** 2 + linearAccel.z ** 2
    );

    // Store acceleration
    this.state.acceleration = linearAccel;

    // Detect step
  const stepDetected = this.stepCounter.findStep(magnitude, currentTime);

    if (stepDetected) {
      // Update position based on step and current heading
      const heading = this.fusedHeading;
      
      // Calculate displacement
      const dx = this.strideLength * Math.cos(heading);
      const dy = this.strideLength * Math.sin(heading);

      this.state.position.x += dx;
      this.state.position.y += dy;
      this.state.position.timestamp = currentTime;
    }

    return {
      stepDetected,
      position: { ...this.state.position }
    };
  }

  /**
   * Update orientation from gyroscope
   */
  updateGyroscope(gx: number, gy: number, gz: number): void {
    const currentTime = Date.now();

    // Calibrate gyroscope bias if not yet complete
    if (!this.gyroBiasCalibration.isComplete()) {
      this.gyroBiasCalibration.addSample(gx, gy, gz);
      if (this.gyroBiasCalibration.isComplete()) {
        this.gyroOrientation.setBias(this.gyroBiasCalibration.getBias());
      }
      return;
    }

    // Update gyroscope-based heading using DCM
    this.gyroHeading = this.gyroOrientation.updateOrientation(gx, gy, gz, currentTime);

    // Apply complementary filter if magnetometer data available
    if (this.magHeading !== undefined) {
      this.fusedHeading = this.complementaryFilter.filter(this.magHeading, this.gyroHeading + this.initialHeading);
    } else {
      this.fusedHeading = this.gyroHeading + this.initialHeading;
    }

    this.state.orientation = this.fusedHeading;
  }

  /**
   * Update orientation from magnetometer
   */
  updateMagnetometer(mx: number, my: number, mz: number): void {
    this.magHeading = this.magOrientation.getHeading(mx, my, mz);

    // Set initial heading on first magnetometer reading
    if (this.initialHeading === 0 && this.magHeading !== 0) {
      this.initialHeading = this.magHeading;
    }

    // Update fused heading if gyroscope is calibrated
    if (this.gyroBiasCalibration.isComplete()) {
      this.fusedHeading = this.complementaryFilter.filter(this.magHeading, this.gyroHeading + this.initialHeading);
      this.state.orientation = this.fusedHeading;
    }
  }

  /**
   * Get current state
   */
  getState(): IMUState & { stepCount: number; calibrationProgress: number } {
    return {
      ...this.state,
      stepCount: this.stepCounter.getStepCount(),
      calibrationProgress: this.gyroBiasCalibration.getCalibrationProgress(),
    };
  }

  /**
   * Get current position
   */
  getPosition(): Position {
    return { ...this.state.position };
  }

  /**
   * Set stride length
   */
  setStrideLength(strideLength: number) {
    this.strideLength = strideLength;
  }

  /**
   * Reset engine
   */
  reset() {
    this.state = {
      position: { x: 0, y: 0, timestamp: Date.now() },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      orientation: 0,
    };
    this.gyroBiasCalibration.reset();
    this.gyroOrientation.reset();
    this.stepCounter.reset();
    this.magHeading = 0;
    this.gyroHeading = 0;
    this.fusedHeading = 0;
    this.initialHeading = 0;
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
