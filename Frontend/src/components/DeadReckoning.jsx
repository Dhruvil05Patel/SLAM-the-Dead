import React, { useState, useEffect, useCallback, useRef } from "react";
import Card from "./Cards";
import PathVisualizer from "./PathVisualizer";
import { formatSensorData, format2DData } from "../utils/formatters";

/**
 * DeadReckoning - Dead Reckoning Module
 * Uses IMU sensors (accelerometer, gyroscope, compass) for position tracking
 */
export default function DeadReckoning({ theme = "dark", onTrajectoryUpdate }) {
    // Raw sensor data
    const [accelerometerData, setAccelerometerData] = useState(null);
    const [gyroscopeData, setGyroscopeData] = useState(null);

    // Dead Reckoning state
    const [velocity, setVelocity] = useState({ x: 0, y: 0 });
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [path, setPath] = useState([{ x: 0, y: 0 }]);
    const [heading, setHeading] = useState(0);

    // System state
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [error, setError] = useState(null);
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [calibrationStatus, setCalibrationStatus] = useState(""); // Calibration feedback

    // Refs for DR state
    const velRef = useRef(velocity);
    const posRef = useRef(position);
    const pathRef = useRef(path);
    const headingRef = useRef(heading);
    const lastTimestampRef = useRef(null);
    const lastCompassUpdateRef = useRef(null);
    const lastPathUpdateRef = useRef(null); // Separate timestamp for path sampling
    const lastDisplayUpdateRef = useRef(null); // Throttle UI updates to every 500ms
    const stationaryCountRef = useRef(0);
    const accelBiasRef = useRef({ x: 0, y: 0, z: 0 });
    const accelNoiseRef = useRef({ x: 0, y: 0, z: 0 }); // Accelerometer noise std dev
    const gyroBiasRef = useRef(0); // Gyro Z-axis bias (rad/s)
    const gyroNoiseRef = useRef(0); // Gyro noise std dev
    const compassFilterRef = useRef({ lastValue: null, alpha: 0.08 });
    const compassNoiseRef = useRef(0); // Compass noise std dev (degrees)
    const gravityRef = useRef(9.81);
    const gyroHeadingDriftRef = useRef(0); // Accumulate heading change from gyro
    const gyroHeadingSamplesRef = useRef(0); // Sample count for bias estimation
    const calibrationDataRef = useRef(null); // Store calibration results

    // Update refs whenever state changes
    useEffect(() => {
        velRef.current = velocity;
    }, [velocity]);
    useEffect(() => {
        posRef.current = position;
    }, [position]);
    useEffect(() => {
        pathRef.current = path;
    }, [path]);
    useEffect(() => {
        headingRef.current = heading;
    }, [heading]);

    // Handle device orientation (compass)
    const handleDeviceOrientation = useCallback((event) => {
        const alpha = event.alpha ?? event.webkitCompassHeading;
        const beta = event.beta;
        const gamma = event.gamma;

        if (
            typeof alpha === "number" &&
            !Number.isNaN(alpha) &&
            typeof beta === "number" &&
            !Number.isNaN(beta) &&
            typeof gamma === "number" &&
            !Number.isNaN(gamma)
        ) {
            let compensatedHeading = alpha;

            // Tilt compensation
            if (Math.abs(beta) > 5 || Math.abs(gamma) > 5) {
                const betaRad = beta * (Math.PI / 180);
                const gammaRad = gamma * (Math.PI / 180);
                const cosB = Math.cos(betaRad);
                const sinB = Math.sin(betaRad);
                const cosG = Math.cos(gammaRad);
                const sinG = Math.sin(gammaRad);

                compensatedHeading =
                    Math.atan2(
                        sinG * cosB * Math.cos((alpha * Math.PI) / 180) +
                        sinB * Math.sin((alpha * Math.PI) / 180),
                        cosG * Math.cos((alpha * Math.PI) / 180)
                    ) *
                    (180 / Math.PI);

                compensatedHeading = (compensatedHeading + 360) % 360;
            }

            // Low-pass filter
            if (compassFilterRef.current.lastValue === null) {
                compassFilterRef.current.lastValue = compensatedHeading;
            } else {
                const filterAlpha = compassFilterRef.current.alpha;
                const filtered =
                    filterAlpha * compensatedHeading +
                    (1 - filterAlpha) * compassFilterRef.current.lastValue;
                compassFilterRef.current.lastValue = filtered;
                compensatedHeading = filtered;
            }

            // Handle iOS vs Android
            if (event.webkitCompassHeading !== undefined) {
                compensatedHeading = 360 - compensatedHeading;
            } else if (window.screen && window.screen.orientation) {
                const screenOrientation = window.screen.orientation.angle || 0;
                compensatedHeading = (compensatedHeading + screenOrientation) % 360;
            }

            // Detect interference
            const variationThreshold = 20;
            const previousHeading = headingRef.current;
            if (Math.abs(compensatedHeading - previousHeading) > variationThreshold) {
                setIsCalibrating(true);
                setTimeout(() => setIsCalibrating(false), 2000);
            }

            // Update ref IMMEDIATELY (don't wait for state update)
            headingRef.current = compensatedHeading;
            lastCompassUpdateRef.current = performance.now();
            gyroHeadingDriftRef.current = 0; // Reset gyro drift when compass updates
            setHeading(compensatedHeading);
        }
    }, []);

    // Handle device motion (acceleration & rotation)
    const handleDeviceMotion = useCallback((event) => {
        // Raw acceleration for display (includes gravity)
        if (event.accelerationIncludingGravity) {
            const { x, y, z } = event.accelerationIncludingGravity;
            setAccelerometerData({ x, y, z });
        }

        // Linear acceleration for DR (already has gravity removed)
        const acc = event.acceleration;
        if (!acc) return;

        const now =
            typeof event.timeStamp === "number" ? event.timeStamp : performance.now();
        if (lastTimestampRef.current === null) {
            lastTimestampRef.current = now;
            return;
        }

        const deltaTime = (now - lastTimestampRef.current) / 1000.0;

        // Rotation rate for display and heading prediction
        if (event.rotationRate) {
            const { alpha, beta, gamma } = event.rotationRate;
            setGyroscopeData({
                alpha: (alpha || 0) * (180 / Math.PI),
                beta: (beta || 0) * (180 / Math.PI),
                gamma: (gamma || 0) * (180 / Math.PI),
            });
            
            // Integrate gyro Z-axis (heading rotation) between compass updates
            // Z-axis rotation rate is alpha in rad/s
            const omega_z = (alpha || 0) - gyroBiasRef.current; // Subtract bias
            const gyroHeadingChange = omega_z * deltaTime * (180 / Math.PI); // Convert to degrees
            gyroHeadingDriftRef.current += gyroHeadingChange;
            gyroHeadingSamplesRef.current += 1;
        }
        if (deltaTime <= 0 || deltaTime < 0.001 || deltaTime > 0.1) {
            // Skip if deltaTime is unreasonable (>100ms = likely tab switch)
            lastTimestampRef.current = now;
            return;
        }
        lastTimestampRef.current = now;

        const axRaw = acc.x || 0;
        const ayRaw = acc.y || 0;

        // Bias correction FIRST (use calibrated bias)
        const axUnbiased = axRaw - accelBiasRef.current.x;
        const ayUnbiased = ayRaw - accelBiasRef.current.y;

        // Stationary detection - use UNBIASED acceleration (2D magnitude)
        // Adaptive based on measured noise (2x std dev - less aggressive), minimum 0.15 m/s²
        const stationaryThreshold = calibrationDataRef.current
            ? Math.max(0.15, Math.hypot(accelNoiseRef.current.x, accelNoiseRef.current.y) * 2)
            : 0.15;
        const stationarySamplesRequired = 5;
        
        // Stationary detection using UNBIASED acceleration
        const accMag2D = Math.hypot(axUnbiased, ayUnbiased);

        if (accMag2D < stationaryThreshold) {
            stationaryCountRef.current += 1;
        } else {
            stationaryCountRef.current = 0;
        }

        // When stationary, update bias and reset velocity
        if (stationaryCountRef.current >= stationarySamplesRequired) {
            accelBiasRef.current.x = accelBiasRef.current.x * 0.9 + axRaw * 0.1;
            accelBiasRef.current.y = accelBiasRef.current.y * 0.9 + ayRaw * 0.1;
            
            // Calibrate gyro bias when stationary (very slow adaptation)
            if (gyroHeadingSamplesRef.current > 10) {
                const avgGyroRate = gyroHeadingDriftRef.current / gyroHeadingSamplesRef.current * (Math.PI / 180) / event.rotationRate?.alpha_sample_time || 0.01;
                gyroBiasRef.current = gyroBiasRef.current * 0.95 + avgGyroRate * 0.05;
            }
            
            // Reset gyro drift when stationary
            gyroHeadingDriftRef.current = 0;
            gyroHeadingSamplesRef.current = 0;
            
            velRef.current = { x: 0, y: 0 };
            setVelocity({ x: 0, y: 0 });
            return;
        }

        // Adaptive deadzone based on measured noise (1.5x standard deviation - less filtering)
        // Minimum of 0.02 to allow small movements
        const deadzone = calibrationDataRef.current 
            ? Math.max(0.02, Math.max(accelNoiseRef.current.x, accelNoiseRef.current.y) * 1.5)
            : 0.02;
        const ax = Math.abs(axUnbiased) > deadzone ? axUnbiased : 0;
        const ay = Math.abs(ayUnbiased) > deadzone ? ayUnbiased : 0;

        // Rotate to world frame using heading angle
        // Use compass heading + gyro prediction between updates for smoother rotation
        // Limit gyro drift to prevent large errors (max ±10° drift between compass updates)
        const maxGyroDrift = 10; // degrees
        const clampedGyroDrift = Math.max(-maxGyroDrift, Math.min(maxGyroDrift, gyroHeadingDriftRef.current));
        const predictedHeading = (headingRef.current || 0) + clampedGyroDrift;
        const headingRad = predictedHeading * (Math.PI / 180);
        const cosH = Math.cos(headingRad);
        const sinH = Math.sin(headingRad);
        
        // Rotation matrix: [cos -sin; sin cos]
        const worldAx = ax * cosH - ay * sinH;
        const worldAy = ax * sinH + ay * cosH;

        // Integrate velocity with minimal friction (less damping for better tracking)
        // Reduced friction from 0.98 to 0.995 (0.5% decay instead of 2%)
        const friction = 0.995;
        const newVelX = (velRef.current.x + worldAx * deltaTime) * friction;
        const newVelY = (velRef.current.y + worldAy * deltaTime) * friction;

        // Velocity threshold to prevent noise accumulation (reduced for better sensitivity)
        const velThreshold = 0.0005; // Reduced from 0.001
        const finalVelX = Math.abs(newVelX) > velThreshold ? newVelX : 0;
        const finalVelY = Math.abs(newVelY) > velThreshold ? newVelY : 0;

        // Integrate position
        const newPosX = posRef.current.x + finalVelX * deltaTime;
        const newPosY = posRef.current.y + finalVelY * deltaTime;

        velRef.current = { x: finalVelX, y: finalVelY };
        posRef.current = { x: newPosX, y: newPosY };

        // Debug logging every 60 frames (~1 second)
        if (Math.random() < 0.016) {
            console.log(`DR Debug:`, {
                accMag: accMag2D.toFixed(4),
                threshold: stationaryThreshold.toFixed(4),
                stationary: stationaryCountRef.current,
                deadzone: deadzone.toFixed(4),
                ax: ax.toFixed(4),
                ay: ay.toFixed(4),
                vel: `(${finalVelX.toFixed(4)}, ${finalVelY.toFixed(4)})`,
                pos: `(${newPosX.toFixed(3)}, ${newPosY.toFixed(3)})`
            });
        }

        // Update display every 100ms for responsive UI (10Hz update rate)
        // (calculations run at 60Hz, display updates at 10Hz)
        if (lastDisplayUpdateRef.current === null) {
            lastDisplayUpdateRef.current = now;
            setVelocity(velRef.current);
            setPosition(posRef.current);
        } else {
            const timeSinceDisplay = now - lastDisplayUpdateRef.current;
            if (timeSinceDisplay > 100) {
                setVelocity(velRef.current);
                setPosition(posRef.current);
                lastDisplayUpdateRef.current = now;
            }
        }

        // Update path with intelligent sampling
        // Only add point if: (1) moved > 0.02m OR (2) 250ms elapsed
        const currentPath = pathRef.current;
        const lastPathPoint = currentPath[currentPath.length - 1];
        const distFromLast = Math.hypot(
            newPosX - lastPathPoint.x,
            newPosY - lastPathPoint.y
        );
        
        // Initialize path timestamp on first update
        if (lastPathUpdateRef.current === null) {
            lastPathUpdateRef.current = now;
        }
        
        const timeSinceLastPath = now - lastPathUpdateRef.current;

        // Add to path if: moved 0.02m OR waited 250ms (fast, accurate graph)
        if (distFromLast > 0.02 || timeSinceLastPath > 250) {
            const newPath = [...currentPath, { x: newPosX, y: newPosY }];
            pathRef.current = newPath;
            setPath(newPath);
            if (onTrajectoryUpdate) onTrajectoryUpdate(newPath);
            lastPathUpdateRef.current = now; // Reset path update timer
        }
    }, [onTrajectoryUpdate]);

    // IMU Calibration - measures bias and noise of all sensors
    const calibrateIMU = async () => {
        return new Promise((resolve) => {
            setIsCalibrating(true);
            setCalibrationStatus("Calibrating IMU sensors (5 seconds)...");
            
            const calibrationDuration = 5000; // 5 seconds
            const startTime = performance.now();
            const accelSamples = { x: [], y: [], z: [] };
            const gyroSamples = []; // Z-axis only (alpha)
            const compassSamples = [];
            
            const calibrationHandler = (event) => {
                const now = performance.now();
                const elapsed = now - startTime;
                
                if (elapsed > calibrationDuration) {
                    window.removeEventListener("devicemotion", calibrationHandler);
                    window.removeEventListener("deviceorientation", calibrationOrientationHandler);
                    
                    // Calculate bias and noise from samples
                    const calcStats = (samples) => {
                        if (samples.length === 0) return { mean: 0, stdDev: 0 };
                        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
                        const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
                        const stdDev = Math.sqrt(variance);
                        return { mean, stdDev };
                    };
                    
                    const accelStats = {
                        x: calcStats(accelSamples.x),
                        y: calcStats(accelSamples.y),
                        z: calcStats(accelSamples.z),
                    };
                    const gyroStats = calcStats(gyroSamples);
                    const compassStats = calcStats(compassSamples);
                    
                    // Store calibration
                    calibrationDataRef.current = { accelStats, gyroStats, compassStats };
                    
                    // Set biases (mean of stationary readings)
                    accelBiasRef.current = {
                        x: accelStats.x.mean,
                        y: accelStats.y.mean,
                        z: accelStats.z.mean - gravityRef.current, // Remove gravity from Z
                    };
                    gyroBiasRef.current = gyroStats.mean;
                    accelNoiseRef.current = {
                        x: accelStats.x.stdDev,
                        y: accelStats.y.stdDev,
                        z: accelStats.z.stdDev,
                    };
                    gyroNoiseRef.current = gyroStats.stdDev;
                    compassNoiseRef.current = compassStats.stdDev;
                    
                    setCalibrationStatus(
                        `Calibration complete!\nAccel Bias: (${accelBiasRef.current.x.toFixed(3)}, ${accelBiasRef.current.y.toFixed(3)})\n` +
                        `Gyro Bias: ${gyroBiasRef.current.toFixed(4)} rad/s\n` +
                        `Compass Noise: ${compassNoiseRef.current.toFixed(1)}°`
                    );
                    
                    setIsCalibrating(false);
                    setTimeout(() => setCalibrationStatus(""), 3000);
                    resolve({ accelStats, gyroStats, compassStats });
                    return;
                }
                
                // Collect samples
                if (event.acceleration) {
                    accelSamples.x.push(event.acceleration.x || 0);
                    accelSamples.y.push(event.acceleration.y || 0);
                    accelSamples.z.push(event.acceleration.z || 0);
                }
                if (event.rotationRate) {
                    gyroSamples.push(event.rotationRate.alpha || 0);
                }
            };
            
            const calibrationOrientationHandler = (event) => {
                if (typeof event.alpha === "number" && !Number.isNaN(event.alpha)) {
                    compassSamples.push(event.alpha);
                }
            };
            
            window.addEventListener("devicemotion", calibrationHandler);
            window.addEventListener("deviceorientation", calibrationOrientationHandler);
        });
    };

    // Start monitoring
    const startMonitoring = async () => {
        setError(null);
        lastTimestampRef.current = null;
        
        // Perform calibration first
        try {
            setCalibrationStatus("Requesting sensor permissions...");
            let motionGranted = false;
            let orientationGranted = false;

            if (typeof DeviceMotionEvent.requestPermission === "function") {
                const motionPermission = await DeviceMotionEvent.requestPermission();
                if (motionPermission === "granted") {
                    motionGranted = true;
                }
            } else {
                motionGranted = true;
            }

            if (typeof DeviceOrientationEvent.requestPermission === "function") {
                const orientationPermission =
                    await DeviceOrientationEvent.requestPermission();
                if (orientationPermission === "granted") {
                    orientationGranted = true;
                }
            } else {
                orientationGranted = true;
            }

            if (motionGranted && orientationGranted) {
                // Run calibration before starting DR
                await calibrateIMU();
                
                // Reset position and path after calibration
                velRef.current = { x: 0, y: 0 };
                posRef.current = { x: 0, y: 0 };
                pathRef.current = [{ x: 0, y: 0 }];
                lastPathUpdateRef.current = null; // Reset path timing for next session
                lastDisplayUpdateRef.current = null; // Reset display update timing
                setVelocity({ x: 0, y: 0 });
                setPosition({ x: 0, y: 0 });
                setPath([{ x: 0, y: 0 }]);
                
                window.addEventListener("devicemotion", handleDeviceMotion);
                window.addEventListener("deviceorientation", handleDeviceOrientation);
                setIsMonitoring(true);
                setCalibrationStatus("Ready! Move your device to track position.");
                setTimeout(() => setCalibrationStatus(""), 2000);
            } else {
                setError("Permission to access one or more sensors was denied.");
            }
        } catch (err) {
            setError(`Error starting sensor monitoring: ${err.message}`);
            console.error(err);
        }
    };

    // Stop monitoring
    const stopMonitoring = () => {
        window.removeEventListener("devicemotion", handleDeviceMotion);
        window.removeEventListener("deviceorientation", handleDeviceOrientation);
        setIsMonitoring(false);
        lastTimestampRef.current = null;
    };

    // Clear path
    const clearPath = () => {
        setVelocity({ x: 0, y: 0 });
        setPosition({ x: 0, y: 0 });
        const resetPath = [{ x: 0, y: 0 }];
        setPath(resetPath);
        if (onTrajectoryUpdate) onTrajectoryUpdate(resetPath);
        lastTimestampRef.current = null;
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            window.removeEventListener("devicemotion", handleDeviceMotion);
            window.removeEventListener("deviceorientation", handleDeviceOrientation);
        };
    }, [handleDeviceMotion, handleDeviceOrientation]);

    const isLight = theme === "light";

    return (
        <div className={`module-shell ${isLight ? "module-light" : "module-dark"} bg-[#060910]/95 text-white overflow-y-auto flex flex-col h-full rounded-3xl border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.45)]`}>
            {/* Header & Controls - Neo gothic */}
            <div className="p-6 md:p-7 border-b border-white/10 bg-white/5 backdrop-blur-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/80 mb-2">
                            Gravemark IMU Core
                        </p>
                        <h2 className="text-2xl md:text-3xl font-semibold text-white drop-shadow">
                            Zombie-proof inertial desk
                        </h2>
                        <p className="text-xs text-slate-200/90 mt-2 max-w-2xl">
                            Bias-aware acceleration, compass smoothing, and drift guardrails for
                            warehouses, tunnels, and emergency walks.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3 text-[11px] text-white/90">
                            <span className="px-3 py-1 rounded-full border border-white/20 bg-white/5">
                                Drift tamer
                            </span>
                            <span className="px-3 py-1 rounded-full border border-white/20 bg-white/5">
                                Compass filter
                            </span>
                            <span className="px-3 py-1 rounded-full border border-white/20 bg-white/5">
                                Drift leash
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 items-start md:items-end">
                        <div className="flex gap-2 flex-wrap justify-end">
                            <button
                                onClick={isMonitoring ? stopMonitoring : startMonitoring}
                                className={`px-4 py-2 rounded-xl font-semibold text-sm shadow-lg transition ${isMonitoring
                                        ? "bg-gradient-to-r from-[#ff8bb0] to-[#ffc76f] text-slate-950 shadow-[0_10px_40px_rgba(255,139,176,0.35)]"
                                        : "bg-gradient-to-r from-[#5bf870] via-[#9efcf6] to-[#ff7ac3] text-slate-950 shadow-[0_10px_40px_rgba(158,252,246,0.4)]"
                                    } hover:brightness-110`}
                            >
                                {isMonitoring ? "Stop Sensors" : "Start Sensors"}
                            </button>
                            <button
                                onClick={clearPath}
                                className="px-4 py-2 rounded-xl font-semibold text-sm border border-white/20 bg-black/40 hover:border-white/60"
                            >
                                Reset Path
                            </button>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end text-[11px] text-white/80">
                            <span
                                className={`px-2.5 py-1 rounded-full border ${isMonitoring
                                        ? "border-emerald-300/70 bg-emerald-500/15 text-emerald-100"
                                        : "border-slate-500/60 bg-slate-800/60 text-slate-200"
                                    }`}
                            >
                                {isMonitoring ? "Live" : "Idle"}
                            </span>
                            {isCalibrating && (
                                <span className="px-2.5 py-1 rounded-full border border-amber-300/60 bg-amber-500/15 text-amber-100">
                                    Calibrating
                                </span>
                            )}
                        </div>
                        {error && (
                            <p className="text-rose-200 text-sm bg-rose-900/50 border border-rose-500/60 rounded px-3 py-2 mt-1 max-w-md text-right">
                                {error}
                            </p>
                        )}
                        {calibrationStatus && (
                            <p className="text-amber-200 text-sm bg-amber-900/30 border border-amber-500/40 rounded px-3 py-2 mt-1 max-w-md text-right whitespace-pre-line">
                                {calibrationStatus}
                            </p>
                        )}
                        {!isMonitoring && !error && !calibrationStatus && (
                            <p className="text-slate-300 text-xs text-right max-w-xs">
                                Fire up sensors to start the crawl.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Stat Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 md:px-8 py-4 bg-black/30 backdrop-blur border-b border-white/10">
                <div className="rounded-xl bg-black/40 border border-white/15 p-3 shadow-inner">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Vel (m/s)
                    </div>
                    <div className="text-sm font-semibold text-emerald-200">
                        {format2DData(velocity)}
                    </div>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/15 p-3 shadow-inner">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Pos (m)
                    </div>
                    <div className="text-sm font-semibold text-cyan-200">
                        {format2DData(position)}
                    </div>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/15 p-3 shadow-inner">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                        Heading
                    </div>
                    <div className="text-lg font-bold text-amber-200">
                        {(heading ?? 0).toFixed(1)}°
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-col xl:grid xl:grid-cols-[1.05fr_0.95fr] gap-6 flex-1 p-6 md:p-8 min-h-0">
                {/* LEFT: Path */}
                <div className="flex flex-col gap-4 min-h-0 lg:border-r lg:border-white/10 lg:pr-6">
                    <div className="bg-slate-900/70 border border-white/10 rounded-2xl shadow-xl overflow-hidden flex-1 min-h-0">
                        <div className="px-4 py-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300/80">
                                    Path
                                </p>
                                <h3 className="text-lg font-semibold">DR Trajectory</h3>
                            </div>
                            <span className="px-3 py-1 rounded-full text-[11px] bg-emerald-500/15 border border-emerald-400/40 text-emerald-100">
                                IMU
                            </span>
                        </div>
                        <div className="p-3">
                            <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950">
                                <PathVisualizer path={path} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Position, Velocity, Sensors */}
                <div className="overflow-y-auto flex flex-col gap-4 lg:pl-6 min-h-0">
                    <div className="bg-slate-900/70 border border-white/10 rounded-2xl shadow-lg p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">
                            Pose
                        </p>
                        <h3 className="text-lg font-semibold mb-2">Measured Position</h3>
                        <Card
                            title="DR Position (2D)"
                            dataString={format2DData(position)}
                            unit="meters"
                            theme={theme}
                        />
                        <Card
                            title="Estimated Velocity"
                            dataString={format2DData(velocity)}
                            unit="m/s"
                            theme={theme}
                        />
                    </div>

                    <div className="bg-slate-900/70 border border-white/10 rounded-2xl shadow-lg p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-fuchsia-300/80">
                            Sensors
                        </p>
                        <h3 className="text-lg font-semibold mb-2">Raw Sensor Data</h3>
                        <Card
                            title="Accelerometer (with Gravity)"
                            dataString={formatSensorData(accelerometerData)}
                            unit="m/s²"
                            theme={theme}
                        />
                        <Card
                            title="Gyroscope (Rotation Rate)"
                            dataString={formatSensorData(gyroscopeData)}
                            unit="°/s"
                            theme={theme}
                        />
                        <Card
                            title="Orientation (Compass)"
                            dataString={`alpha: ${(heading ?? 0).toFixed(2)}°`}
                            unit="0° = North"
                            theme={theme}
                        />
                    </div>

                    <div className="p-4 text-xs text-slate-200 text-center mt-auto bg-white/5 border border-white/10 rounded-xl">
                        <p>Inertial Navigation | IMU-based Dead Reckoning</p>
                        <p className="mt-1 text-emerald-200">
                            <span className="text-emerald-300">●</span> Sensor Fusion Active
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
