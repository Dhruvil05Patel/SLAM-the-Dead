import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import TrajectoryChart from '../components/TrajectoryChart';
import { useTheme } from '../../theme/ThemeContext';
import { EnhancedDeadReckoningEngine } from '../../utils/imuProcessing';
import { saveSensorData, saveTrajectoryData, saveSensorDataAsCSV } from '../../utils/fileUtils';
import { SensorData, Position, SENSOR_UPDATE_INTERVAL, DEFAULT_STRIDE_LENGTH } from '../../utils/constants';

const DeadReckoningScreen = () => {
  const { theme } = useTheme();
  const [isLogging, setIsLogging] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [trajectory, setTrajectory] = useState<Position[]>([]);
  const [currentAccel, setCurrentAccel] = useState({ x: 0, y: 0, z: 0 });
  const [currentGyro, setCurrentGyro] = useState({ x: 0, y: 0, z: 0 });
  const [currentMag, setCurrentMag] = useState({ x: 0, y: 0, z: 0 });
  const [pathLength, setPathLength] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [strideLength, setStrideLength] = useState(DEFAULT_STRIDE_LENGTH);

  const drEngine = useRef(new EnhancedDeadReckoningEngine(DEFAULT_STRIDE_LENGTH));
  const accelSubscription = useRef<any>(null);
  const gyroSubscription = useRef<any>(null);
  const magSubscription = useRef<any>(null);

  useEffect(() => {
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

    // Reset everything
    drEngine.current.reset();
    drEngine.current.setStrideLength(strideLength);
    setSensorData([]);
    setTrajectory([{ x: 0, y: 0, timestamp: Date.now() }]);
    setPathLength(0);
    setStepCount(0);
    setCalibrationProgress(0);
    setIsLogging(true);

    console.log('Starting sensor logging with Enhanced PDR...');

    // Subscribe to accelerometer
    accelSubscription.current = Accelerometer.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      setCurrentAccel({ x, y, z });

      // Log sensor data
      const data: SensorData = { timestamp, type: 'accelerometer', x, y, z };
      setSensorData(prev => [...prev, data]);

      // Update dead reckoning with step detection
      const result = drEngine.current.updateAccelerometer(x, y, z);

      // Always update the last trajectory point with the current engine position so the chart
      // shows a live moving marker — append only when a step is actually detected.
      const currentPos = drEngine.current.getPosition();
      if (result.stepDetected) {
        setTrajectory(prev => {
          const updated = [...prev, result.position];
          // Calculate path length
          if (updated.length > 1) {
            const last = updated[updated.length - 2];
            const dx = result.position.x - last.x;
            const dy = result.position.y - last.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            setPathLength(prevLength => prevLength + distance);
          }
          return updated;
        });
      } else {
        // Replace the last point (preview/current position) so chart moves smoothly
        setTrajectory(prev => {
          if (prev.length === 0) return [{ ...currentPos }];
          const updated = [...prev];
          updated[updated.length - 1] = { ...currentPos };
          return updated;
        });
      }

      // Update state from engine
      const state = drEngine.current.getState();
      setStepCount(state.stepCount);
      setCalibrationProgress(state.calibrationProgress);
    });

    // Subscribe to gyroscope
    gyroSubscription.current = Gyroscope.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      setCurrentGyro({ x, y, z });

      // Log sensor data
      const data: SensorData = { timestamp, type: 'gyroscope', x, y, z };
      setSensorData(prev => [...prev, data]);

      // Update orientation
      drEngine.current.updateGyroscope(x, y, z);

      // Update calibration progress
      const state = drEngine.current.getState();
      setCalibrationProgress(state.calibrationProgress);
    });

    // Subscribe to magnetometer
    magSubscription.current = Magnetometer.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      setCurrentMag({ x, y, z });

      // Log sensor data
      const data: SensorData = { timestamp, type: 'magnetometer', x, y, z };
      setSensorData(prev => [...prev, data]);

      // Update orientation from magnetometer
      drEngine.current.updateMagnetometer(x, y, z);
    });
  };

  const stopLogging = () => {
    setIsLogging(false);

    // Unsubscribe from all sensors
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
  };

  const handleExportData = async () => {
    try {
      if (sensorData.length === 0) {
        Alert.alert('No Data', 'No sensor data to export. Start logging first.');
        return;
      }

      // Save both JSON and CSV formats
      const jsonPath = await saveSensorData(sensorData);
      const csvPath = await saveSensorDataAsCSV(sensorData);
      const trajectoryPath = await saveTrajectoryData(trajectory, 'dr');

      Alert.alert(
        'Export Successful',
        `Data exported successfully!\n\nSensor Data (JSON): ${jsonPath.split('/').pop()}\nSensor Data (CSV): ${csvPath.split('/').pop()}\nTrajectory: ${trajectoryPath.split('/').pop()}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Export Failed', `Error: ${error}`);
    }
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
            drEngine.current.reset();
            drEngine.current.setStrideLength(strideLength);
            setSensorData([]);
            setTrajectory([]);
            setPathLength(0);
            setStepCount(0);
            setCalibrationProgress(0);
            setCurrentAccel({ x: 0, y: 0, z: 0 });
            setCurrentGyro({ x: 0, y: 0, z: 0 });
            setCurrentMag({ x: 0, y: 0, z: 0 });
          },
        },
      ]
    );
  };

  const currentPosition = trajectory.length > 0 ? trajectory[trajectory.length - 1] : { x: 0, y: 0 };
  const state = drEngine.current.getState();
  const isCalibrating = calibrationProgress < 1.0;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.title}>Dead Reckoning</ThemedText>
        <ThemedText style={styles.subtitle}>
          Enhanced Pedestrian Dead Reckoning (PDR)
        </ThemedText>

        {/* Calibration Status */}
        {isCalibrating && isLogging && (
          <View style={styles.calibrationBanner}>
            <ThemedText style={styles.calibrationText}>
              🔄 Calibrating gyroscope... Keep device still
            </ThemedText>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${calibrationProgress * 100}%` }]} />
            </View>
            <ThemedText style={styles.calibrationPercent}>
              {(calibrationProgress * 100).toFixed(0)}%
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
              {isLogging ? '⏹ Stop Logging' : '▶ Start Logging'}
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
            <ThemedText style={styles.statusText}>Recording...</ThemedText>
          </View>
        )}

        {/* Trajectory Visualization */}
        <View style={styles.chartContainer}>
          <TrajectoryChart drPath={trajectory} showDR={true} showSLAM={false} />
        </View>

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <ThemedText style={styles.statsTitle}>Statistics</ThemedText>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>Steps Detected</ThemedText>
              <ThemedText style={styles.statValue}>{stepCount}</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>Path Length</ThemedText>
              <ThemedText style={styles.statValue}>{pathLength.toFixed(2)} m</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>Stride Length</ThemedText>
              <ThemedText style={styles.statValue}>{strideLength.toFixed(2)} m</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>Position X</ThemedText>
              <ThemedText style={styles.statValue}>{currentPosition.x.toFixed(3)} m</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>Position Y</ThemedText>
              <ThemedText style={styles.statValue}>{currentPosition.y.toFixed(3)} m</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statLabel}>Trajectory Points</ThemedText>
              <ThemedText style={styles.statValue}>{trajectory.length}</ThemedText>
            </View>
          </View>
        </View>

        {/* Real-time Sensor Readings */}
        <View style={styles.sensorContainer}>
          <ThemedText style={styles.sensorTitle}>Live Sensor Data</ThemedText>
          
          {/* Accelerometer */}
          <View style={styles.sensorCard}>
            <ThemedText style={styles.sensorLabel}>📱 Accelerometer (m/s²)</ThemedText>
            <View style={styles.sensorValues}>
              <ThemedText style={styles.sensorValue}>X: {currentAccel.x.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Y: {currentAccel.y.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Z: {currentAccel.z.toFixed(3)}</ThemedText>
            </View>
          </View>

          {/* Gyroscope */}
          <View style={styles.sensorCard}>
            <ThemedText style={styles.sensorLabel}>🔄 Gyroscope (rad/s)</ThemedText>
            <View style={styles.sensorValues}>
              <ThemedText style={styles.sensorValue}>X: {currentGyro.x.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Y: {currentGyro.y.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Z: {currentGyro.z.toFixed(3)}</ThemedText>
            </View>
          </View>

          {/* Magnetometer */}
          <View style={styles.sensorCard}>
            <ThemedText style={styles.sensorLabel}>🧭 Magnetometer (μT)</ThemedText>
            <View style={styles.sensorValues}>
              <ThemedText style={styles.sensorValue}>X: {currentMag.x.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Y: {currentMag.y.toFixed(3)}</ThemedText>
              <ThemedText style={styles.sensorValue}>Z: {currentMag.z.toFixed(3)}</ThemedText>
            </View>
          </View>

          {/* Orientation */}
          <View style={styles.sensorCard}>
            <ThemedText style={styles.sensorLabel}>🧭 Heading (Fused)</ThemedText>
            <ThemedText style={styles.sensorValue}>
              {((state.orientation * 180) / Math.PI).toFixed(1)}°
            </ThemedText>
            {!isCalibrating && (
              <ThemedText style={[styles.sensorValue, { fontSize: 12, opacity: 0.7 }]}>
                ✓ Calibrated
              </ThemedText>
            )}
          </View>
        </View>

        {/* Export Button */}
        <TouchableOpacity
          style={[styles.button, styles.exportButton]}
          onPress={handleExportData}
          disabled={sensorData.length === 0}
        >
          <ThemedText style={styles.buttonText}>
            💾 Export Session Data
          </ThemedText>
        </TouchableOpacity>
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
  exportButton: {
    backgroundColor: '#2196F3',
    marginTop: 20,
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
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
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
    backgroundColor: '#f44336',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f44336',
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
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
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
  calibrationBanner: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  calibrationText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 4,
  },
  calibrationPercent: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default DeadReckoningScreen;
