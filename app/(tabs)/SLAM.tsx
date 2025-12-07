import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import CameraView from 'expo-camera/build/CameraView';
import { useCameraPermissions } from 'expo-camera';
import Constants from 'expo-constants';
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';
import { ThemedText } from '../components/ThemedText';
import ThemedView from '../components/ThemedView';
import TrajectoryChart from '../components/TrajectoryChart';
import { useTheme } from '../../theme/ThemeContext';
import { SensorData, Position, SENSOR_UPDATE_INTERVAL, DEFAULT_STRIDE_LENGTH, PLOT_INTERVAL_MS } from '../../utils/constants';
import { EnhancedDeadReckoningEngine } from '../../utils/imuProcessing';
import ORBSLAM3 from '../../native/orbslam3/ORB_SLAM3Module';

const SLAMScreen = () => {
  const { theme } = useTheme();
  const appOwnership = Constants.appOwnership;
  const [isLogging, setIsLogging] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [slamTrajectory, setSlamTrajectory] = useState<Position[]>([]);
  const [drTrajectory, setDrTrajectory] = useState<Position[]>([]);
  const [orbAvailable, setOrbAvailable] = useState(false);
  const [slamProvider, setSlamProvider] = useState<'orbslam3' | 'simulated'>('orbslam3');
  const [currentAccel, setCurrentAccel] = useState({ x: 0, y: 0, z: 0 });
  const [currentGyro, setCurrentGyro] = useState({ x: 0, y: 0, z: 0 });
  const [currentMag, setCurrentMag] = useState({ x: 0, y: 0, z: 0 });
  const [detectedCodes, setDetectedCodes] = useState<any[]>([]);
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();

  // PDR engine for camera-IMU fallback
  const drEngine = useRef(new EnhancedDeadReckoningEngine(DEFAULT_STRIDE_LENGTH));

  const accelSubscription = useRef<any>(null);
  const gyroSubscription = useRef<any>(null);
  const magSubscription = useRef<any>(null);
  const slamIntervalRef = useRef<any>(null);
  const drPlotThrottleRef = useRef<number>(0);

  useEffect(() => {
    ORBSLAM3.isAvailable()
      .then((ok) => {
        setOrbAvailable(!!ok);
        setSlamProvider(ok ? 'orbslam3' : 'simulated');
      })
      .catch((error) => {
        console.warn('Failed checking ORB-SLAM3 availability', error);
        setOrbAvailable(false);
        setSlamProvider('simulated');
      });

    // Set sensor update intervals
    Accelerometer.setUpdateInterval(SENSOR_UPDATE_INTERVAL);
    Gyroscope.setUpdateInterval(SENSOR_UPDATE_INTERVAL);
    Magnetometer.setUpdateInterval(SENSOR_UPDATE_INTERVAL);

    // Check sensor availability
    const checkSensors = async () => {
      const accelAvailable = await Accelerometer.isAvailableAsync();
      const gyroAvailable = await Gyroscope.isAvailableAsync();
      const magAvailable = await Magnetometer.isAvailableAsync();
      
      if (!accelAvailable) {
        console.warn('Accelerometer not available');
      }
      if (!gyroAvailable) {
        console.warn('Gyroscope not available');
      }
      if (!magAvailable) {
        console.warn('Magnetometer not available');
      }
    };

    checkSensors();

    return () => {
      // Cleanup on unmount
      stopLogging();
    };
  }, []);

  const startLogging = async () => {
    // Check sensor availability first
    const accelAvailable = await Accelerometer.isAvailableAsync();
    const gyroAvailable = await Gyroscope.isAvailableAsync();
    const magAvailable = await Magnetometer.isAvailableAsync();

    if (!accelAvailable || !gyroAvailable || !magAvailable) {
      const missingSensors = [];
      if (!accelAvailable) missingSensors.push('Accelerometer');
      if (!gyroAvailable) missingSensors.push('Gyroscope');
      if (!magAvailable) missingSensors.push('Magnetometer');
      
      Alert.alert(
        'Sensor Error', 
        `The following sensors are not available: ${missingSensors.join(', ')}`
      );
      return;
    }

    const needsCamera = slamProvider === 'orbslam3' || !orbAvailable;
    if (needsCamera) {
      const granted = permission?.granted ?? false;
      if (!granted) {
        const res = await requestPermission();
        if (!res.granted) {
          Alert.alert('Camera Permission', 'Camera access is required for camera-based tracking.');
          return;
        }
      }
    }

    console.log('Starting SLAM logging...');

    const startTimestamp = Date.now();
    drEngine.current.reset();
    drEngine.current.setStrideLength(DEFAULT_STRIDE_LENGTH);
    setSensorData([]);
    setSlamTrajectory([{ x: 0, y: 0, timestamp: startTimestamp }]);
    setDrTrajectory([{ x: 0, y: 0, timestamp: startTimestamp }]);
    drPlotThrottleRef.current = startTimestamp;
    setIsLogging(true);

  // Subscribe to accelerometer
    accelSubscription.current = Accelerometer.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      setCurrentAccel({ x, y, z });

      const data: SensorData = { timestamp, type: 'accelerometer', x, y, z };
      setSensorData(prev => [...prev, data]);

      const result = drEngine.current.updateAccelerometer(x, y, z);
      setDrTrajectory(prev => {
        const timestampedPos = { ...result.position, timestamp };

        if (prev.length === 0) {
          drPlotThrottleRef.current = timestamp;
          return [timestampedPos];
        }

        if (result.stepDetected) {
          drPlotThrottleRef.current = timestamp;
          return [...prev, timestampedPos];
        }

        const sinceLastPlot = timestamp - drPlotThrottleRef.current;
        if (sinceLastPlot >= PLOT_INTERVAL_MS) {
          drPlotThrottleRef.current = timestamp;
          return [...prev, timestampedPos];
        }

        const updated = [...prev];
        updated[updated.length - 1] = timestampedPos;
        return updated;
      });
    });

    // Subscribe to gyroscope
    gyroSubscription.current = Gyroscope.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      setCurrentGyro({ x, y, z });

      const data: SensorData = { timestamp, type: 'gyroscope', x, y, z };
      setSensorData(prev => [...prev, data]);

      drEngine.current.updateGyroscope(x, y, z);
    });

    // Subscribe to magnetometer
    magSubscription.current = Magnetometer.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      setCurrentMag({ x, y, z });

      const data: SensorData = { timestamp, type: 'magnetometer', x, y, z };
      setSensorData(prev => [...prev, data]);

      drEngine.current.updateMagnetometer(x, y, z);
    });

    // Initialize selected SLAM provider
    if (slamProvider === 'orbslam3') {
      try {
        await ORBSLAM3.initialize();
        await ORBSLAM3.start();
        // Poll for pose at sensor interval as a simple baseline
        slamIntervalRef.current = setInterval(async () => {
          const pose = await ORBSLAM3.getCurrentPose();
          if (!pose) return;
          setSlamTrajectory(prev => [...prev, { x: pose.x, y: pose.y, timestamp: pose.timestamp }]);
        }, SENSOR_UPDATE_INTERVAL);
      } catch (e) {
        console.warn('ORB_SLAM3 failed to start, falling back to simulation', e);
        setOrbAvailable(false);
        setSlamProvider('simulated');
        simulateSLAMData();
      }
    } else {
      simulateSLAMData();
    }
  };

  const stopLogging = () => {
    setIsLogging(false);

    if (accelSubscription.current) {
      accelSubscription.current.remove();
      accelSubscription.current = null;
    }
    if (gyroSubscription.current) {
      gyroSubscription.current.remove();
      gyroSubscription.current = null;
    }
    if (magSubscription.current) {
      magSubscription.current.remove();
      magSubscription.current = null;
    }
    if (slamIntervalRef.current) {
      clearInterval(slamIntervalRef.current);
      slamIntervalRef.current = null;
    }
    drEngine.current.reset();
    // Stop providers
    if (slamProvider === 'orbslam3') {
      ORBSLAM3.stop().catch(() => {});
    }
    setDetectedCodes([]);
    setDrTrajectory([]);
  };

  // Simulate SLAM data using DR engine with reduced drift
  // This provides a more realistic SLAM simulation that follows actual movement
  const simulateSLAMData = () => {
    let updateCount = 0;
    let lastDrPosition = { x: 0, y: 0 };
    let slamPosition = { x: 0, y: 0 };
    let driftCorrection = { x: 0, y: 0 };
    
    // Use DR trajectory updates to drive SLAM simulation
    // SLAM should be more accurate (less drift) than DR
    const updateSLAMFromDR = () => {
      setDrTrajectory(currentDr => {
        if (currentDr.length === 0) return currentDr;
        
        const latestDr = currentDr[currentDr.length - 1];
        const dx = latestDr.x - lastDrPosition.x;
        const dy = latestDr.y - lastDrPosition.y;
        
        // Apply drift correction (SLAM reduces drift by ~30-50%)
        const driftReduction = 0.4; // 40% less drift
        const correctedDx = dx * (1 - driftReduction);
        const correctedDy = dy * (1 - driftReduction);
        
        // Accumulate small corrections to prevent runaway drift
        driftCorrection.x += correctedDx;
        driftCorrection.y += correctedDy;
        
        // Apply smoothing to SLAM position (SLAM is typically smoother)
        const smoothing = 0.85;
        slamPosition.x = slamPosition.x * smoothing + (lastDrPosition.x + driftCorrection.x) * (1 - smoothing);
        slamPosition.y = slamPosition.y * smoothing + (lastDrPosition.y + driftCorrection.y) * (1 - smoothing);
        
        lastDrPosition = { x: latestDr.x, y: latestDr.y };
        
        setSlamTrajectory(prev => {
          const newPos = { x: slamPosition.x, y: slamPosition.y, timestamp: latestDr.timestamp };
          const updated = prev.length === 0 ? [newPos] : [...prev, newPos];
          
          updateCount++;
          if (updateCount % 50 === 0) {
            console.log(`SLAM Update: ${updated.length} points, Position: (${slamPosition.x.toFixed(2)}, ${slamPosition.y.toFixed(2)})`);
          }
          return updated;
        });
        
        return currentDr;
      });
    };
    
    slamIntervalRef.current = setInterval(updateSLAMFromDR, SENSOR_UPDATE_INTERVAL);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Data',
      'Are you sure you want to reset all data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            stopLogging();
            setSensorData([]);
            setSlamTrajectory([]);
            setDrTrajectory([]);
            setCurrentAccel({ x: 0, y: 0, z: 0 });
            setCurrentGyro({ x: 0, y: 0, z: 0 });
            setCurrentMag({ x: 0, y: 0, z: 0 });
          },
        },
      ]
    );
  };

  const shouldShowCamera = isLogging && (slamProvider === 'orbslam3' || !orbAvailable);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.title}>SLAM Tracking</ThemedText>
        <ThemedText style={styles.subtitle}>
          Visual tracking using {slamProvider === 'orbslam3' ? 'ORB_SLAM3 (camera only)' : 'Simulated camera path'}
        </ThemedText>

        {/* SLAM Provider Status */}
        <View style={[
          styles.statusCard,
          { backgroundColor: slamProvider === 'orbslam3' ? 'rgba(76, 175, 80, 0.12)' : 'rgba(255, 152, 0, 0.12)' }
        ]}>
          <ThemedText style={styles.statusLabel}>
            Provider: {slamProvider === 'orbslam3' ? 'ORB-SLAM3' : 'Simulated'}
          </ThemedText>
          <ThemedText style={styles.statusSubtext}>
            {slamProvider === 'orbslam3'
              ? 'Camera-only ORB SLAM pipeline active.'
              : orbAvailable
                ? 'ORB-SLAM3 initialization failed at runtime. Using simulated path.'
                : 'ORB-SLAM3 native module not detected. Falling back to simulation.'}
          </ThemedText>
        </View>

        {/* Expo Go / Published notice: explain why ARCore won't be available in Expo Go */}
        {appOwnership === 'expo' && (
          <View style={styles.expoNotice}>
            <ThemedText style={styles.expoNoticeText}>
              Running inside Expo Go (published app). Native ORB-SLAM3 modules are not included in Expo Go — build a development client or a production build with EAS and install it on your device to enable full camera-only ORB tracking.
            </ThemedText>
          </View>
        )}

        {/* Control Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              isLogging ? styles.stopButton : styles.startButton,
            ]}
            onPress={isLogging ? stopLogging : startLogging}
          >
            <ThemedText style={styles.buttonText}>
              {isLogging ? '⏹ Stop Tracking' : '▶ Start Tracking'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={handleReset}
          >
            <ThemedText style={styles.buttonText}>🔄 Reset</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Status Indicator */
        }
        {isLogging && (
          <View style={styles.statusBadge}>
            <View style={styles.recordingDot} />
            <ThemedText style={styles.statusText}>Tracking...</ThemedText>
          </View>
        )}

        {/* Camera Preview with Live Observations */}
        {shouldShowCamera && (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={(r: any) => (cameraRef.current = r)}
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={({ data, type, bounds }: any) => {
                const now = Date.now();
                setDetectedCodes((prev) => [{ data, type, bounds, ts: now }, ...prev].slice(0, 5));
              }}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'code128'] }}
            />
            <View pointerEvents="none" style={styles.overlayContainer}>
              {detectedCodes.map((c, idx) => (
                <View key={idx} style={styles.overlayBadge}>
                  <ThemedText style={styles.overlayText}>{c.type}: {String(c.data).slice(0, 28)}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Trajectory Visualization */}
        <View style={styles.chartContainer}>
          <TrajectoryChart 
            drPath={drTrajectory}
            slamPath={slamTrajectory} 
            showDR={drTrajectory.length > 0} 
            showSLAM={true} 
          />
        </View>

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <ThemedText style={styles.statsTitle}>SLAM Statistics</ThemedText>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>Pose Updates</ThemedText>
              <ThemedText style={styles.statValue}>{slamTrajectory.length}</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>IMU Samples</ThemedText>
              <ThemedText style={styles.statValue}>{sensorData.length}</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>Position X</ThemedText>
              <ThemedText style={styles.statValue}>
                {slamTrajectory.length > 0 
                  ? slamTrajectory[slamTrajectory.length - 1].x.toFixed(3) 
                  : '0.000'} m
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>Position Y</ThemedText>
              <ThemedText style={styles.statValue}>
                {slamTrajectory.length > 0 
                  ? slamTrajectory[slamTrajectory.length - 1].y.toFixed(3) 
                  : '0.000'} m
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Real-time Sensor Readings */}
        <View style={styles.sensorContainer}>
          <ThemedText style={styles.sensorTitle}>Supporting IMU Data</ThemedText>
          
          <View style={styles.sensorCard}>
            <ThemedText style={styles.sensorLabel}>📱 Accelerometer (m/s²)</ThemedText>
            <View style={styles.sensorValues}>
              <ThemedText style={styles.sensorValue}>X: {currentAccel.x.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Y: {currentAccel.y.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Z: {currentAccel.z.toFixed(3)}</ThemedText>
            </View>
          </View>

          <View style={styles.sensorCard}>
            <ThemedText style={styles.sensorLabel}>🔄 Gyroscope (rad/s)</ThemedText>
            <View style={styles.sensorValues}>
              <ThemedText style={styles.sensorValue}>X: {currentGyro.x.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Y: {currentGyro.y.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Z: {currentGyro.z.toFixed(3)}</ThemedText>
            </View>
          </View>

          <View style={styles.sensorCard}>
            <ThemedText style={styles.sensorLabel}>🧭 Magnetometer (μT)</ThemedText>
            <View style={styles.sensorValues}>
              <ThemedText style={styles.sensorValue}>X: {currentMag.x.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Y: {currentMag.y.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Z: {currentMag.z.toFixed(3)}</ThemedText>
            </View>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <ThemedText style={styles.infoTitle}>ℹ️ About SLAM</ThemedText>
          <ThemedText style={styles.infoText}>
            SLAM (Simultaneous Localization and Mapping) uses camera data and visual features 
            to track position more accurately than dead reckoning alone. ARCore provides 
            6DOF tracking with drift correction.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 20,
  },
  statusCard: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  statusSubtext: {
    fontSize: 14,
    opacity: 0.8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  resetButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 205, 196, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 15,
    alignSelf: 'center',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ECDC4',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ECDC4',
  },
  chartContainer: {
    marginVertical: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cameraContainer: {
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 8,
    gap: 6,
  },
  overlayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  overlayText: {
    color: '#fff',
    fontSize: 12,
  },
  statsContainer: {
    marginVertical: 20,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    padding: 15,
    borderRadius: 10,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  sensorContainer: {
    marginTop: 20,
  },
  sensorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  sensorCard: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  sensorLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  sensorValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sensorValue: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
  infoBox: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  expoNotice: {
    backgroundColor: 'rgba(255, 235, 59, 0.08)',
    borderLeftWidth: 4,
    borderLeftColor: '#FFEB3B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  expoNoticeText: {
    fontSize: 13,
    color: '#333',
    opacity: 0.9,
  },
});

export default SLAMScreen;
