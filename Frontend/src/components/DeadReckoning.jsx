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

    // Refs for DR state
    const velRef = useRef(velocity);
    const posRef = useRef(position);
    const pathRef = useRef(path);
    const headingRef = useRef(heading);
    const lastTimestampRef = useRef(null);
    const stationaryCountRef = useRef(0);
    const accelBiasRef = useRef({ x: 0, y: 0 });
    const compassFilterRef = useRef({ lastValue: null, alpha: 0.2 });

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
                const alpha = compassFilterRef.current.alpha;
                const filtered =
                    alpha * compensatedHeading +
                    (1 - alpha) * compassFilterRef.current.lastValue;
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

            setHeading(compensatedHeading);
        }
    }, []);

    // Handle device motion (acceleration & rotation)
    const handleDeviceMotion = useCallback((event) => {
        // Raw acceleration for display
        if (event.accelerationIncludingGravity) {
            const { x, y, z } = event.accelerationIncludingGravity;
            setAccelerometerData({ x, y, z });
        }

        // Rotation rate for display
        if (event.rotationRate) {
            const { alpha, beta, gamma } = event.rotationRate;
            setGyroscopeData({
                alpha: (alpha || 0) * (180 / Math.PI),
                beta: (beta || 0) * (180 / Math.PI),
                gamma: (gamma || 0) * (180 / Math.PI),
            });
        }

        // Linear acceleration for DR
        const acc = event.acceleration;
        if (!acc) return;

        const now =
            typeof event.timeStamp === "number" ? event.timeStamp : performance.now();
        if (lastTimestampRef.current === null) {
            lastTimestampRef.current = now;
            return;
        }

        const deltaTime = (now - lastTimestampRef.current) / 1000.0;
        if (deltaTime <= 0 || deltaTime < 0.001) return;
        lastTimestampRef.current = now;

        const axRaw = acc.x || 0;
        const ayRaw = acc.y || 0;

        // Stationary detection
        const accMag2D = Math.hypot(axRaw, ayRaw);
        const stationaryThreshold = 0.12;
        const stationarySamplesRequired = 6;

        if (accMag2D < stationaryThreshold) {
            stationaryCountRef.current += 1;
        } else {
            stationaryCountRef.current = 0;
        }

        if (stationaryCountRef.current >= stationarySamplesRequired) {
            accelBiasRef.current.x = accelBiasRef.current.x * 0.8 + axRaw * 0.2;
            accelBiasRef.current.y = accelBiasRef.current.y * 0.8 + ayRaw * 0.2;
            velRef.current = { x: 0, y: 0 };
            setVelocity(velRef.current);
            return;
        }

        // Bias correction
        const axUnbiased = axRaw - accelBiasRef.current.x;
        const ayUnbiased = ayRaw - accelBiasRef.current.y;

        // Deadzone
        const deadzone = 0.05;
        const ax = Math.abs(axUnbiased) > deadzone ? axUnbiased : 0;
        const ay = Math.abs(ayUnbiased) > deadzone ? ayUnbiased : 0;

        // Rotate to world frame
        const headingRad = (headingRef.current || 0) * (Math.PI / 180);
        const worldAx = ax * Math.cos(headingRad) + ay * Math.sin(headingRad);
        const worldAy = -ax * Math.sin(headingRad) + ay * Math.cos(headingRad);

        // Integrate velocity with damping
        const damping = 1.0;
        const newVelX =
            (velRef.current.x + worldAx * deltaTime) * Math.exp(-damping * deltaTime);
        const newVelY =
            (velRef.current.y + worldAy * deltaTime) * Math.exp(-damping * deltaTime);

        // Integrate position
        const newPosX = posRef.current.x + newVelX * deltaTime;
        const newPosY = posRef.current.y + newVelY * deltaTime;

        velRef.current = { x: newVelX, y: newVelY };
        posRef.current = { x: newPosX, y: newPosY };

        setVelocity(velRef.current);
        setPosition(posRef.current);

        const newPath = [...pathRef.current, { x: newPosX, y: newPosY }];
        pathRef.current = newPath;
        setPath(newPath);
        if (onTrajectoryUpdate) onTrajectoryUpdate(newPath);
    }, []);

    // Start monitoring
    const startMonitoring = async () => {
        setError(null);
        lastTimestampRef.current = null;
        try {
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
                window.addEventListener("devicemotion", handleDeviceMotion);
                window.addEventListener("deviceorientation", handleDeviceOrientation);
                setIsMonitoring(true);
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
                        {!isMonitoring && !error && (
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
