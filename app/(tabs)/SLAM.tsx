import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import TrajectoryChart from '../components/TrajectoryChart';
import { useTheme } from '../../theme/ThemeContext';
import { SensorData, Position, SENSOR_UPDATE_INTERVAL } from '../../utils/constants';
import ORBSLAM3 from '../../native/orbslam3/ORB_SLAM3Module';
import ARCore from '../../native/arcore/ARCoreModule';

const SLAMScreen = () => {
  const { theme } = useTheme();
  const appOwnership = Constants.appOwnership;
  const [isLogging, setIsLogging] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [slamTrajectory, setSlamTrajectory] = useState<Position[]>([]);
  const [arCoreAvailable, setArCoreAvailable] = useState(false);
  const [slamProvider, setSlamProvider] = useState<'orbslam3' | 'arcore' | 'simulated'>('simulated');
  const [currentAccel, setCurrentAccel] = useState({ x: 0, y: 0, z: 0 });
  const [currentGyro, setCurrentGyro] = useState({ x: 0, y: 0, z: 0 });
  const [currentMag, setCurrentMag] = useState({ x: 0, y: 0, z: 0 });

  const accelSubscription = useRef<any>(null);
  const gyroSubscription = useRef<any>(null);
  const magSubscription = useRef<any>(null);
  const slamIntervalRef = useRef<any>(null);

  useEffect(() => {
    // Check if ARCore is available (Android only)
    if (Platform.OS === 'android') {
      // Prefer ORB_SLAM3 if native module is present
      ORBSLAM3.isAvailable().then((ok) => {
        if (ok) {
          setSlamProvider('orbslam3');
          setArCoreAvailable(false);
          return;
        }
        // Otherwise prefer ARCore if available
        ARCore.isAvailable().then((ar) => {
          if (ar) {
            setSlamProvider('arcore');
            setArCoreAvailable(true);
          } else {
            setSlamProvider('simulated');
            setArCoreAvailable(false);
          }
        }).catch(() => setSlamProvider('simulated'));
      }).catch(() => {
        // fallback
        ARCore.isAvailable().then((ar) => {
          setSlamProvider(ar ? 'arcore' : 'simulated');
          setArCoreAvailable(!!ar);
        }).catch(() => setSlamProvider('simulated'));
      });
    }

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

  console.log('Starting SLAM logging...');

    setSensorData([]);
    setSlamTrajectory([{ x: 0, y: 0, timestamp: Date.now() }]);
    setIsLogging(true);

  // Subscribe to accelerometer
    accelSubscription.current = Accelerometer.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      setCurrentAccel({ x, y, z });

      const data: SensorData = { timestamp, type: 'accelerometer', x, y, z };
      setSensorData(prev => [...prev, data]);
    });

    // Subscribe to gyroscope
    gyroSubscription.current = Gyroscope.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      setCurrentGyro({ x, y, z });

      const data: SensorData = { timestamp, type: 'gyroscope', x, y, z };
      setSensorData(prev => [...prev, data]);
    });

    // Subscribe to magnetometer
    magSubscription.current = Magnetometer.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      setCurrentMag({ x, y, z });

      const data: SensorData = { timestamp, type: 'magnetometer', x, y, z };
      setSensorData(prev => [...prev, data]);
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
        simulateSLAMData();
      }
    } else if (slamProvider === 'arcore' && arCoreAvailable) {
      try {
        await ARCore.initialize();
        await ARCore.startTracking();
        slamIntervalRef.current = setInterval(async () => {
          const pose = await ARCore.getCurrentPose();
          if (!pose) return;
          setSlamTrajectory(prev => [...prev, { x: pose.x, y: pose.y, timestamp: pose.timestamp }]);
        }, SENSOR_UPDATE_INTERVAL);
      } catch (e) {
        console.warn('ARCore failed to start, falling back to simulation', e);
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
    // Stop providers
    if (slamProvider === 'orbslam3') {
      ORBSLAM3.stop().catch(() => {});
    }
  };

  // Simulate SLAM data for demonstration purposes
  // In production, this would be replaced with actual ARCore pose data
  const simulateSLAMData = () => {
    let angle = 0;
    let radius = 0;
    let updateCount = 0;
    
    slamIntervalRef.current = setInterval(() => {
      // Simulate a spiral path (more accurate than DR due to "SLAM correction")
      angle += 0.1;
      radius += 0.01;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      setSlamTrajectory(prev => {
        const updated = [...prev, { x, y, timestamp: Date.now() }];
        // Log every 50 updates to avoid console spam
        updateCount++;
        if (updateCount % 50 === 0) {
          console.log(`SLAM Update: ${updated.length} points, Position: (${x.toFixed(2)}, ${y.toFixed(2)})`);
        }
        return updated;
      });
    }, SENSOR_UPDATE_INTERVAL);
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
            setCurrentAccel({ x: 0, y: 0, z: 0 });
            setCurrentGyro({ x: 0, y: 0, z: 0 });
            setCurrentMag({ x: 0, y: 0, z: 0 });
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.title}>SLAM Tracking</ThemedText>
        <ThemedText style={styles.subtitle}>
          Visual SLAM using ARCore
        </ThemedText>

        {/* ARCore Status */}
        <View style={[
          styles.statusCard,
          { backgroundColor: arCoreAvailable ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)' }
        ]}>
          <ThemedText style={styles.statusLabel}>
            {arCoreAvailable ? '✅ ARCore Available' : '⚠️ ARCore Not Available'}
          </ThemedText>
          {!arCoreAvailable && (
            <ThemedText style={styles.statusSubtext}>
              ARCore is only available on Android devices
            </ThemedText>
          )}
          {arCoreAvailable && (
            <ThemedText style={styles.statusSubtext}>
              Note: This demo uses simulated SLAM data. Full ARCore integration requires native module setup.
            </ThemedText>
          )}
        </View>

        {/* Expo Go / Published notice: explain why ARCore won't be available in Expo Go */}
        {appOwnership === 'expo' && (
          <View style={styles.expoNotice}>
            <ThemedText style={styles.expoNoticeText}>
              Running inside Expo Go (published app). Native ARCore/ORB-SLAM3 modules are not included in Expo Go — build a development client or a production build with EAS and install it on your device to enable full AR functionality.
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
            disabled={!arCoreAvailable}
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

        {/* Status Indicator */}
        {isLogging && (
          <View style={styles.statusBadge}>
            <View style={styles.recordingDot} />
            <ThemedText style={styles.statusText}>Tracking...</ThemedText>
          </View>
        )}

        {/* Trajectory Visualization */}
        <View style={styles.chartContainer}>
          <TrajectoryChart 
            slamPath={slamTrajectory} 
            showDR={false} 
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
