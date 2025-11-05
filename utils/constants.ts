// imu-dead-reckoning.ts
// Improved constants, types, and an IMU Dead Reckoning processor with filtering,
// calibration, simple fusion, gravity compensation, integration, and plotting helpers.

/* ===========================
   Tuned constants & thresholds
   =========================== */
export const GRAVITY = 9.80665; // m/s^2
export const ALPHA = 0.8; // LPF alpha for raw accel smoothing
export const FUSION_ALPHA = 0.98; // complementary filter for yaw (gyro trust)
export const ACCELERATION_THRESHOLD = 0.15; // m/s^2 -> ignore small accel noise
export const VELOCITY_THRESHOLD = 0.02; // m/s -> ignore tiny velocities
export const VELOCITY_DECAY = 0.98; // residual velocity decay when stationary
export const SENSOR_UPDATE_INTERVAL = 10; // ms target sampling (≈100Hz)
export const DEFAULT_STRIDE_LENGTH = 0.75; // m per step (if using step-based updates)
export const PLOT_INTERVAL_MS = 200; // ms between appended plot points
export const CALIBRATION_SAMPLE_MS = 2000; // ms of static data to estimate bias

/* ===========================
   Types
   =========================== */
export type Position = {
  x: number;
  y: number;
  timestamp?: number;
};

export type Velocity = {
  x: number;
  y: number;
};

export type Acceleration = {
  x: number;
  y: number;
  z: number;
};

export type IMUState = {
  position: Position;
  velocity: Velocity;
  acceleration: Acceleration;
  orientation: number; // radians, yaw (heading)
};

export type SensorType = 'accelerometer' | 'gyroscope' | 'magnetometer';

export type SensorData = {
  timestamp: number; // ms epoch or performance.now()
  type: SensorType;
  x: number;
  y: number;
  z: number;
};

/* ===========================
   Utilities
   =========================== */

/** Normalize angle to [0, 2π) */
export const normalizeAngle = (theta: number) => {
  const twoPi = 2 * Math.PI;
  theta = theta % twoPi;
  if (theta < 0) theta += twoPi;
  return theta;
};

/** Simple low-pass filter: new = alpha * prev + (1-alpha) * raw */
export function lowPass(prev: Acceleration, raw: Acceleration, alpha = ALPHA): Acceleration {
  return {
    x: alpha * prev.x + (1 - alpha) * raw.x,
    y: alpha * prev.y + (1 - alpha) * raw.y,
    z: alpha * prev.z + (1 - alpha) * raw.z,
  };
}

/** Smooth a position for plotting */
export const smoothPosition = (prev: Position, next: Position, alpha = 0.85): Position => ({
  x: alpha * prev.x + (1 - alpha) * next.x,
  y: alpha * prev.y + (1 - alpha) * next.y,
  timestamp: next.timestamp,
});

/** Fuse gyro yaw with magnetometer yaw using complementary filter */
export const fuseOrientation = (gyroYaw: number, magYaw: number, alpha = FUSION_ALPHA) =>
  normalizeAngle(alpha * gyroYaw + (1 - alpha) * magYaw);

/** Rotate a vector in body frame to world frame using yaw */
export const bodyToWorld = (vx: number, vy: number, yawRad: number) => {
  const c = Math.cos(yawRad);
  const s = Math.sin(yawRad);
  return {
    x: c * vx - s * vy,
    y: s * vx + c * vy,
  };
};

/* ===========================
   Dead-Reckoning Processor
   =========================== */

export class IMUDeadReckoning {
  // public state
  public state: IMUState;

  // internal
  private lastTimestamp: number | null = null;
  private lastPlotTimestamp: number | null = null;
  private smoothedAccel: Acceleration = { x: 0, y: 0, z: GRAVITY };
  private accelBias: Acceleration = { x: 0, y: 0, z: 0 }; // estimated during calibration
  private biasSamples: Acceleration[] = [];
  private calibratingUntil: number | null = null;
  private isCalibrated = false;

  // orientation sources
  private gyroYaw = 0; // integrated gyro yaw (rad)
  private magYaw = 0; // magnetometer heading (rad)
  private fusedYaw = 0;

  // plot buffer for UI
  private path: Position[] = []; // high-frequency raw path (maybe downsampled)
  private plotBuffer: Position[] = []; // points intended for plotting (PLOT_INTERVAL_MS)

  // step detection (simple peak-based)
  private lastVertical = 0;
  private stepCooldownUntil = 0;
  private stepCount = 0;

  constructor(initial?: Partial<IMUState>) {
    this.state = {
      position: initial?.position ?? { x: 0, y: 0, timestamp: undefined },
      velocity: initial?.velocity ?? { x: 0, y: 0 },
      acceleration: initial?.acceleration ?? { x: 0, y: 0, z: 0 },
      orientation: initial?.orientation ?? 0,
    };

    // initialize smoothed accel to reasonable zero with gravity on z
    this.smoothedAccel = { x: 0, y: 0, z: GRAVITY };
    this.calibratingUntil = null;
  }

  /* ---------------------------
     Calibration helpers
     --------------------------- */

  /** Start calibration: collect stationary samples for CALIBRATION_SAMPLE_MS */
  public startCalibration(nowMs: number) {
    this.biasSamples = [];
    this.calibratingUntil = nowMs + CALIBRATION_SAMPLE_MS;
    this.isCalibrated = false;
  }

  /** Call to manually finish calibration now */
  public finishCalibration() {
    if (this.biasSamples.length === 0) {
      return;
    }
    const n = this.biasSamples.length;
    const sum = this.biasSamples.reduce(
      (acc, s) => ({ x: acc.x + s.x, y: acc.y + s.y, z: acc.z + s.z }),
      { x: 0, y: 0, z: 0 }
    );
    this.accelBias = { x: sum.x / n, y: sum.y / n, z: sum.z / n - GRAVITY }; // bias relative to gravity
    this.isCalibrated = true;
    this.biasSamples = [];
    this.calibratingUntil = null;
  }

  /* ---------------------------
     Core processing
     --------------------------- */

  /**
   * Feed incoming sensor data (accelerometer, gyroscope, magnetometer).
   * - timestamp must be ms (e.g., performance.now() or Date.now()).
   */
  public feed(sensor: SensorData) {
    // initialize timestamps if needed
    if (this.lastTimestamp == null) {
      this.lastTimestamp = sensor.timestamp;
      this.lastPlotTimestamp = sensor.timestamp;
    }

    // if calibrating, collect accel samples
    if (this.calibratingUntil && sensor.timestamp <= this.calibratingUntil && sensor.type === 'accelerometer') {
      this.biasSamples.push({ x: sensor.x, y: sensor.y, z: sensor.z });
    } else if (this.calibratingUntil && sensor.timestamp > this.calibratingUntil) {
      // finalize calibration automatically
      this.finishCalibration();
    }

    switch (sensor.type) {
      case 'accelerometer':
        this.handleAccelerometer(sensor);
        break;
      case 'gyroscope':
        this.handleGyroscope(sensor);
        break;
      case 'magnetometer':
        this.handleMagnetometer(sensor);
        break;
    }

    // after processing, update fused orientation
    this.fusedYaw = fuseOrientation(this.gyroYaw, this.magYaw);

    // integrate to update position if we have both accel and timestamps
    const now = sensor.timestamp;
    const dtMs = now - (this.lastTimestamp ?? now);
    // guard: if dt is zero or huge reset lastTimestamp and skip
    if (dtMs <= 0 || dtMs > 500) {
      this.lastTimestamp = now;
      return;
    }
    const dt = dtMs / 1000; // convert to seconds

    // integrate using the smoothed and gravity-compensated accel
    this.integrate(dt, now);

    this.lastTimestamp = now;
  }

  /* ---------------------------
     Sensor handlers
     --------------------------- */

  private handleAccelerometer(sensor: SensorData) {
    const raw: Acceleration = { x: sensor.x, y: sensor.y, z: sensor.z };

    // smooth raw accel
    this.smoothedAccel = lowPass(this.smoothedAccel, raw, ALPHA);

    // if not calibrated yet and not currently calibrating, we can optionally
    // start an auto-calibration if initial samples appear stationary — left to user.

    // store raw accel in state (before gravity removal)
    this.state.acceleration = { ...this.smoothedAccel };

    // simple vertical peak-based step detection (optional fallback)
    this.detectStepFromAccel(this.smoothedAccel, sensor.timestamp);
  }

  private handleGyroscope(sensor: SensorData) {
    // gyroscope typically in rad/s or deg/s depending on platform.
    // Assume rad/s for this module. If your gyroscope uses deg/s, convert externally.
    // Integrate yaw around Z axis (assuming sensor.x/y are roll/pitch rates and z is yaw rate).
    const gz = sensor.z;
    // integrate gyro yaw
    const dt = this.lastTimestamp ? (sensor.timestamp - this.lastTimestamp) / 1000 : 0;
    if (dt > 0 && Math.abs(gz) < 50) {
      this.gyroYaw = normalizeAngle(this.gyroYaw + gz * dt);
    }
  }

  private handleMagnetometer(sensor: SensorData) {
    // Compute heading from magnetometer readings (approx).
    // This is a simple estimate and assumes phone is roughly horizontal.
    // heading = atan2(mx, my) OR atan2(y, x) depending on axes: we'll use atan2(y, x).
    this.magYaw = normalizeAngle(Math.atan2(sensor.y, sensor.x));
  }

  /* ---------------------------
     Integration and updates
     --------------------------- */

  /**
   * Integrate velocity and position with simple bias removal, gravity compensation,
   * thresholding and decay. dt in seconds.
   */
  private integrate(dt: number, nowMs: number) {
    // remove accel bias and gravity (approx)
    const uncompensated = this.removeBiasAndGravity(this.smoothedAccel, this.fusedYaw);

    // apply small-deadzone to accel
    const ax = Math.abs(uncompensated.x) > ACCELERATION_THRESHOLD ? uncompensated.x : 0;
    const ay = Math.abs(uncompensated.y) > ACCELERATION_THRESHOLD ? uncompensated.y : 0;

    // integrate velocity (body frame)
    this.state.velocity.x += ax * dt;
    this.state.velocity.y += ay * dt;

    // apply velocity threshold and decay to prevent runaway drift
    if (Math.abs(this.state.velocity.x) < VELOCITY_THRESHOLD) {
      this.state.velocity.x *= VELOCITY_DECAY;
      if (Math.abs(this.state.velocity.x) < 1e-4) this.state.velocity.x = 0;
    }
    if (Math.abs(this.state.velocity.y) < VELOCITY_THRESHOLD) {
      this.state.velocity.y *= VELOCITY_DECAY;
      if (Math.abs(this.state.velocity.y) < 1e-4) this.state.velocity.y = 0;
    }

    // convert body-frame velocities to world-frame using fused yaw
    const worldV = bodyToWorld(this.state.velocity.x, this.state.velocity.y, this.fusedYaw);

    // integrate position in world frame
    const dx = worldV.x * dt;
    const dy = worldV.y * dt;

    const newPos: Position = {
      x: this.state.position.x + dx,
      y: this.state.position.y + dy,
      timestamp: nowMs,
    };

    // append to internal path (high frequency)
    this.path.push(newPos);

    // smoothing for plotted points and downsample by PLOT_INTERVAL_MS
    if (this.lastPlotTimestamp == null) this.lastPlotTimestamp = nowMs;
    if (nowMs - this.lastPlotTimestamp >= PLOT_INTERVAL_MS) {
      const lastPlotPoint = this.plotBuffer.length ? this.plotBuffer[this.plotBuffer.length - 1] : this.state.position;
      const smoothed = smoothPosition(lastPlotPoint ?? this.state.position, newPos);
      this.plotBuffer.push(smoothed);
      this.lastPlotTimestamp = nowMs;
    }

    // update stored position
    this.state.position = newPos;
    // update orientation (expose fused yaw)
    this.state.orientation = this.fusedYaw;
  }

  /**
   * Remove bias and gravity from smoothed accelerometer reading.
   * This uses a simplified assumption: gravity acts on device z-axis and
   * orientation correction uses yaw only (good if device stays mostly level).
   */
  private removeBiasAndGravity(accel: Acceleration, yawRad: number): Acceleration {
    // subtract bias (if calibrated). Bias z is estimated relative to gravity.
    const bx = this.accelBias.x;
    const by = this.accelBias.y;
    const bz = this.accelBias.z;

    // remove bias
    const rx = accel.x - bx;
    const ry = accel.y - by;
    const rz = accel.z - bz;

    // remove gravity - simple approx: assume device is near horizontal and gravity mostly on z
    // If device pitch/roll are available, apply full rotation of gravity vector instead.
    const compensated = {
      x: rx,
      y: ry,
      z: rz - GRAVITY,
    };

    // For horizontal movement, world-frame horizontal acceleration is roughly body x,y
    // Return body-frame horizontal accelerations (z ignored after compensation).
    return { x: compensated.x, y: compensated.y, z: compensated.z };
  }

  /* ---------------------------
     Step detection (simple)
     --------------------------- */
  private detectStepFromAccel(accel: Acceleration, timestampMs: number) {
    // use vertical (z) axis for simple peak detection.
    const vertical = accel.z;

    // require some minimal time between steps
    const now = timestampMs;
    if (this.stepCooldownUntil > now) {
      this.lastVertical = vertical;
      return;
    }

    // detect a positive peak exceeding gravity + margin
    const peakThreshold = GRAVITY + 1.0; // tune this: 1 m/s^2 above gravity
    if (vertical > peakThreshold && this.lastVertical <= peakThreshold) {
      // rising edge -> count a step
      this.stepCount++;
      // optionally, use step to correct position: step-based dead-reckoning
      // e.g., move DEFAULT_STRIDE_LENGTH in heading direction
      const worldDelta = bodyToWorld(DEFAULT_STRIDE_LENGTH, 0, this.fusedYaw);
      this.state.position.x += worldDelta.x;
      this.state.position.y += worldDelta.y;

      // append to plot buffer immediately
      const sp: Position = { x: this.state.position.x, y: this.state.position.y, timestamp: now };
      this.plotBuffer.push(sp);
      this.lastPlotTimestamp = now;

      // cooldown (avoid double count)
      this.stepCooldownUntil = now + 300; // 300 ms minimum between steps
    }

    this.lastVertical = vertical;
  }

  /* ---------------------------
     Public getters / utilities
     --------------------------- */

  /** Returns the path (high frequency) then clears it optionally */
  public consumePath(clear = false): Position[] {
    const p = [...this.path];
    if (clear) this.path = [];
    return p;
  }

  /** Returns the plot buffer (coarser points suitable for UI graphing) */
  public consumePlotBuffer(clear = true): Position[] {
    const p = [...this.plotBuffer];
    if (clear) this.plotBuffer = [];
    return p;
  }

  /** Reset positions / velocities */
  public reset(position?: Position) {
    this.state.position = position ?? { x: 0, y: 0, timestamp: undefined };
    this.state.velocity = { x: 0, y: 0 };
    this.state.acceleration = { x: 0, y: 0, z: 0 };
    this.path = [];
    this.plotBuffer = [];
    this.lastTimestamp = null;
    this.lastPlotTimestamp = null;
    this.gyroYaw = 0;
    this.magYaw = 0;
    this.fusedYaw = 0;
    this.isCalibrated = false;
    this.accelBias = { x: 0, y: 0, z: 0 };
  }

  /** Quick summary useful for debugging */
  public debugSummary() {
    return {
      position: this.state.position,
      velocity: this.state.velocity,
      accel: this.state.acceleration,
      yaw: this.fusedYaw,
      calibrated: this.isCalibrated,
      accelBias: this.accelBias,
      stepCount: this.stepCount,
    };
  }
}
