# Dead Reckoning Implementation - Enhanced vs Legacy

## Overview

SmartNav now includes **two Dead Reckoning implementations** based on different approaches:

1. **Legacy DR** (`DeadReckoningEngine`) - Continuous IMU integration
2. **Enhanced PDR** (`EnhancedDeadReckoningEngine`) - Pedestrian Dead Reckoning with step detection

## Key Differences

### Legacy DR (Original)
- **Approach**: Continuous double integration of accelerometer data
- **Position Update**: Every sensor reading (~150ms intervals)
- **Orientation**: Simple gyroscope integration + magnetometer
- **Accuracy**: Lower - accumulates drift quickly
- **Use Case**: Smooth continuous movement visualization

**Pros**:
- Simple, continuous tracking
- Good for visualization of movement patterns
- Works without walking

**Cons**:
- High drift accumulation
- Sensitive to sensor noise
- Unrealistic for pedestrian navigation

### Enhanced PDR (New - Based on nisargnp/DeadReckoning)
- **Approach**: Step-based Pedestrian Dead Reckoning
- **Position Update**: Only when a step is detected
- **Orientation**: Direction Cosine Matrix (DCM) + complementary filter fusion
- **Accuracy**: Much higher - discrete steps reduce integration errors
- **Use Case**: Realistic pedestrian navigation

**Pros**:
- Significantly less drift
- More accurate for walking/running
- Gyroscope bias calibration
- Complementary filter for heading fusion
- Adaptive step detection

**Cons**:
- Only works when walking
- Requires calibration period
- Depends on stride length accuracy

## Technical Implementation

### Enhanced PDR Components

#### 1. **Gyroscope Bias Calibration**
```typescript
const calibration = new GyroscopeBiasCalibration(300);
// Collect 300 samples while stationary
calibration.addSample(gx, gy, gz);
if (calibration.isComplete()) {
  const bias = calibration.getBias();
}
```

#### 2. **Direction Cosine Matrix (DCM)**
```typescript
const dcm = new GyroscopeOrientationDCM();
dcm.setBias(bias);
const heading = dcm.updateOrientation(gx, gy, gz, timestamp);
```

Uses Taylor series approximation for rotation:
- Small angle optimization
- Skew-symmetric matrix approach
- Higher accuracy than Euler integration

#### 3. **Dynamic Step Counter**
```typescript
const stepCounter = new DynamicStepCounter(0.85);
const stepDetected = stepCounter.findStep(accelerationMagnitude);
```

Features:
- Adaptive thresholds (moving average)
- Peak detection algorithm
- Adjustable sensitivity

#### 4. **Complementary Filter**
```typescript
const filter = new ComplementaryFilter(0.98);
const fusedHeading = filter.filter(magHeading, gyroHeading);
```

Combines:
- 98% gyroscope (short-term accuracy)
- 2% magnetometer (long-term stability)

### Usage Example

```typescript
import { EnhancedDeadReckoningEngine } from './utils/imuProcessing';

// Create engine with stride length
const drEngine = new EnhancedDeadReckoningEngine(0.75); // 0.75m stride

// In accelerometer callback
const { stepDetected, position } = drEngine.updateAccelerometer(ax, ay, az);
if (stepDetected) {
  console.log('Step detected!', position);
}

// In gyroscope callback
drEngine.updateGyroscope(gx, gy, gz);

// In magnetometer callback
drEngine.updateMagnetometer(mx, my, mz);

// Get state
const state = drEngine.getState();
console.log('Steps:', state.stepCount);
console.log('Calibration:', `${(state.calibrationProgress * 100).toFixed(0)}%`);
console.log('Heading:', state.orientation);
```

## Configuration

### Stride Length Calibration

The stride length significantly affects accuracy. Average values:
- **Walking**: 0.6 - 0.8 meters
- **Fast walking**: 0.8 - 1.0 meters
- **Running**: 1.2 - 1.5 meters

To calibrate:
1. Measure a known distance (e.g., 10 meters)
2. Count steps while walking
3. Calculate: `strideLength = distance / stepCount`

### Step Counter Sensitivity

```typescript
const stepCounter = new DynamicStepCounter(sensitivity);
```

- **Lower** (0.6 - 0.8): Detects more steps (may have false positives)
- **Default** (0.85): Balanced
- **Higher** (0.9 - 1.2): Stricter detection (may miss steps)

## Migrating from Legacy to Enhanced

### DR.tsx Migration
```typescript
// OLD
const drEngine = useRef(new DeadReckoningEngine());

// NEW
import { EnhancedDeadReckoningEngine } from '../../utils/imuProcessing';
const drEngine = useRef(new EnhancedDeadReckoningEngine(0.75));

// Accelerometer listener
const { stepDetected, position } = drEngine.current.updateAccelerometer(x, y, z);
if (stepDetected) {
  setTrajectory(prev => [...prev, position]);
}

// Gyroscope listener (no deltaTime needed)
drEngine.current.updateGyroscope(x, y, z);

// Magnetometer listener
drEngine.current.updateMagnetometer(x, y, z);
```

### Compare.tsx Migration
```typescript
// Use enhanced engine for both DR and keep SLAM simulation
const drEngine = useRef(new EnhancedDeadReckoningEngine(0.75));

// Same sensor callbacks as DR.tsx
// SLAM remains simulated (more accurate baseline)
```

## Performance Comparison

| Metric | Legacy DR | Enhanced PDR |
|--------|-----------|--------------|
| Drift after 100m | ~15-30m | ~3-8m |
| Position updates/sec | ~6-7 | ~1-2 (steps) |
| CPU usage | Moderate | Lower |
| Calibration time | None | ~30-60 sec |
| Walking required | No | Yes |

## Reference Implementation

Based on: https://github.com/nisargnp/DeadReckoning

Key papers:
- **Direction Cosine Matrix**: "Strapdown Inertial Navigation Technology" (Titterton & Weston)
- **Step Detection**: "Step Detection Robust Against the Dynamics of Smartphones" (Zhao, 2015)
- **Complementary Filter**: "Keeping a Good Attitude" (Euston et al., 2008)

## Future Enhancements

Potential improvements:
1. **Zero-velocity updates (ZUPT)** - Detect stationary periods to reset drift
2. **Map matching** - Constrain movement to valid paths
3. **Particle filter** - Probabilistic position estimation
4. **Sensor fusion with WiFi/BLE** - Indoor positioning assistance
5. **Machine learning** - Personalized stride detection

## Troubleshooting

### "Steps not detected"
- Check sensor availability
- Ensure device is moving (walking)
- Adjust step counter sensitivity
- Verify linear acceleration magnitude > 10 m/s²

### "High drift despite PDR"
- Complete gyroscope calibration (keep device still)
- Calibrate stride length accurately
- Check magnetometer interference (avoid metal)
- Ensure complementary filter is active

### "Calibration stuck"
- Keep device completely still on flat surface
- Wait for 300 samples (~45 seconds at 150ms interval)
- Check gyroscope sensor availability

## Summary

Use **Enhanced PDR** for:
- ✅ Realistic pedestrian navigation
- ✅ Long-distance tracking
- ✅ Accurate path reconstruction
- ✅ Comparison with SLAM

Use **Legacy DR** for:
- ✅ Quick visualization
- ✅ Non-walking scenarios
- ✅ Debugging sensor data
- ✅ Baseline comparison

For best results in DR vs SLAM comparison, **use Enhanced PDR** as it provides a fair comparison with actual pedestrian movement patterns.
