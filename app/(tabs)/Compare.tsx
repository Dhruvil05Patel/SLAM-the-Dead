import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import TrajectoryChart from '../components/TrajectoryChart';
import { useTheme } from '../../theme/ThemeContext';
import { EnhancedDeadReckoningEngine, calculatePathLength, calculateDrift } from '../../utils/imuProcessing';
import { exportSessionData } from '../../utils/fileUtils';
import { SensorData, Position, SENSOR_UPDATE_INTERVAL, DEFAULT_STRIDE_LENGTH } from '../../utils/constants';
import ARCore from '../../native/arcore/ARCoreModule';
import ORBSLAM3 from '../../native/orbslam3/ORB_SLAM3Module';

type SlamProvider = 'orbslam3' | 'arcore' | 'simulated';

const CompareScreen = () => {
  const { theme } = useTheme();
  const [isTracking, setIsTracking] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [drTrajectory, setDrTrajectory] = useState<Position[]>([]);
  const [slamTrajectory, setSlamTrajectory] = useState<Position[]>([]);
  const [showDR, setShowDR] = useState(true);
  const [showSLAM, setShowSLAM] = useState(true);
  const [drPathLength, setDrPathLength] = useState(0);
  const [slamPathLength, setSlamPathLength] = useState(0);
  const [currentDrift, setCurrentDrift] = useState(0);
  const [slamProvider, setSlamProvider] = useState<SlamProvider>('simulated');
  const [stepCount, setStepCount] = useState(0);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [strideLength, setStrideLength] = useState(DEFAULT_STRIDE_LENGTH);

  const drEngine = useRef(new EnhancedDeadReckoningEngine(DEFAULT_STRIDE_LENGTH));
  const accelSubscription = useRef<any>(null);
  const gyroSubscription = useRef<any>(null);
  const magSubscription = useRef<any>(null);
  const slamIntervalRef = useRef<any>(null);

  useEffect(() => {
    Accelerometer.setUpdateInterval(SENSOR_UPDATE_INTERVAL);
    Gyroscope.setUpdateInterval(SENSOR_UPDATE_INTERVAL);
    Magnetometer.setUpdateInterval(SENSOR_UPDATE_INTERVAL);

    // Check sensor and SLAM availability
    const checkAvailability = async () => {
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

      // Check SLAM provider availability
      try {
        const orbslam3Available = await ORBSLAM3.isAvailable();
        if (orbslam3Available) {
          setSlamProvider('orbslam3');
          console.log('Using ORB-SLAM3 as SLAM provider');
          return;
        }
      } catch (error) {
        console.log('ORB-SLAM3 not available:', error);
      }

      try {
        const arcoreAvailable = await ARCore.isAvailable();
        if (arcoreAvailable) {
          setSlamProvider('arcore');
          console.log('Using ARCore as SLAM provider');
          return;
        }
      } catch (error) {
        console.log('ARCore not available:', error);
      }

      setSlamProvider('simulated');
      console.log('Using simulated SLAM (no native providers available)');
    };

    checkAvailability();

    return () => {
      // Cleanup on unmount
      stopTracking();
    };
  }, []);

  const startTracking = async () => {
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

    console.log('Starting tracking with SLAM provider:', slamProvider);

    // Reset everything
    drEngine.current.reset();
    drEngine.current.setStrideLength(strideLength);
    setSensorData([]);
    setDrTrajectory([{ x: 0, y: 0, timestamp: Date.now() }]);
    setSlamTrajectory([{ x: 0, y: 0, timestamp: Date.now() }]);
    setDrPathLength(0);
    setSlamPathLength(0);
    setCurrentDrift(0);
    setStepCount(0);
    setCalibrationProgress(0);
    setIsTracking(true);

    // Subscribe to accelerometer for DR
    accelSubscription.current = Accelerometer.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      
      // Log sensor data
      const data: SensorData = { timestamp, type: 'accelerometer', x, y, z };
      setSensorData(prev => [...prev, data]);

      // Update dead reckoning with step detection
      const result = drEngine.current.updateAccelerometer(x, y, z);
      
      if (result.stepDetected) {
        setDrTrajectory(prev => {
          const updated = [...prev, result.position];
          if (updated.length > 1) {
            const last = updated[updated.length - 2];
            const dx = result.position.x - last.x;
            const dy = result.position.y - last.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            setDrPathLength(prevLength => prevLength + distance);
          }
          return updated;
        });
      }

      // Update state from engine
      const state = drEngine.current.getState();
      setStepCount(state.stepCount);
      setCalibrationProgress(state.calibrationProgress);
    });

    // Subscribe to gyroscope for DR
    gyroSubscription.current = Gyroscope.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      const data: SensorData = { timestamp, type: 'gyroscope', x, y, z };
      setSensorData(prev => [...prev, data]);
      
      drEngine.current.updateGyroscope(x, y, z);
      
      const state = drEngine.current.getState();
      setCalibrationProgress(state.calibrationProgress);
    });

    // Subscribe to magnetometer for DR
    magSubscription.current = Magnetometer.addListener(({ x, y, z }) => {
      const timestamp = Date.now();
      const data: SensorData = { timestamp, type: 'magnetometer', x, y, z };
      setSensorData(prev => [...prev, data]);
      
      drEngine.current.updateMagnetometer(x, y, z);
    });

    // Initialize SLAM based on provider
    if (slamProvider === 'orbslam3') {
      try {
        await ORBSLAM3.initialize();
        await ORBSLAM3.start();
        console.log('ORB-SLAM3 initialized and started');
        
        // Poll for SLAM pose updates
        slamIntervalRef.current = setInterval(async () => {
          try {
            const pose = await ORBSLAM3.getCurrentPose();
            
            if (!pose) {
              console.warn('No pose data from ORB-SLAM3');
              return;
            }
            
            const slamPosition: Position = {
              x: pose.x,
              y: pose.y,
              timestamp: pose.timestamp || Date.now(),
            };
            
            setSlamTrajectory(prev => {
              const updated = [...prev, slamPosition];
              if (updated.length > 1) {
                const last = updated[updated.length - 2];
                const dx = slamPosition.x - last.x;
                const dy = slamPosition.y - last.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                setSlamPathLength(prevLength => prevLength + distance);
              }
              
              // Calculate drift between latest positions
              if (drTrajectory.length > 0) {
                const latestDr = drTrajectory[drTrajectory.length - 1];
                const drift = calculateDrift(latestDr, slamPosition);
                setCurrentDrift(drift);
              }
              
              return updated;
            });
          } catch (error) {
            console.error('Error getting ORB-SLAM3 pose:', error);
          }
        }, SENSOR_UPDATE_INTERVAL);
      } catch (error) {
        console.error('Failed to initialize ORB-SLAM3:', error);
        Alert.alert('SLAM Error', 'Failed to initialize ORB-SLAM3');
      }
    } else if (slamProvider === 'arcore') {
      try {
        await ARCore.initialize();
        await ARCore.startTracking();
        console.log('ARCore initialized and tracking started');
        
        // Poll for SLAM pose updates
        slamIntervalRef.current = setInterval(async () => {
          try {
            const pose = await ARCore.getCurrentPose();
            
            if (!pose) {
              console.warn('No pose data from ARCore');
              return;
            }
            
            const slamPosition: Position = {
              x: pose.x,
              y: pose.y,
              timestamp: pose.timestamp || Date.now(),
            };
            
            setSlamTrajectory(prev => {
              const updated = [...prev, slamPosition];
              if (updated.length > 1) {
                const last = updated[updated.length - 2];
                const dx = slamPosition.x - last.x;
                const dy = slamPosition.y - last.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                setSlamPathLength(prevLength => prevLength + distance);
              }
              
              // Calculate drift between latest positions
              if (drTrajectory.length > 0) {
                const latestDr = drTrajectory[drTrajectory.length - 1];
                const drift = calculateDrift(latestDr, slamPosition);
                setCurrentDrift(drift);
              }
              
              return updated;
            });
          } catch (error) {
            console.error('Error getting ARCore pose:', error);
          }
        }, SENSOR_UPDATE_INTERVAL);
      } catch (error) {
        console.error('Failed to initialize ARCore:', error);
        Alert.alert('SLAM Error', 'Failed to initialize ARCore');
      }
    } else {
      // Fallback to simulated SLAM
      console.log('Using simulated SLAM data');
      simulateSLAMTracking();
    }
  };

  const stopTracking = async () => {
    setIsTracking(false);

    // Stop sensors
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
    
    // Stop SLAM polling
    if (slamIntervalRef.current) {
      clearInterval(slamIntervalRef.current);
      slamIntervalRef.current = null;
    }
    
    // Stop SLAM providers
    try {
      if (slamProvider === 'orbslam3') {
        await ORBSLAM3.stop();
        console.log('ORB-SLAM3 stopped');
      } else if (slamProvider === 'arcore') {
        await ARCore.stopTracking();
        console.log('ARCore tracking stopped');
      }
    } catch (error) {
      console.error('Error stopping SLAM provider:', error);
    }
  };

  // Simulate SLAM tracking (more accurate than DR)
  const simulateSLAMTracking = () => {
    let angle = 0;
    let radius = 0;
    let updateCount = 0;
    
    slamIntervalRef.current = setInterval(() => {
      // Simulate a more accurate path with less drift
      angle += 0.08;
      radius += 0.008;
      const x = radius * Math.cos(angle) * 0.95; // Slightly more accurate
      const y = radius * Math.sin(angle) * 0.95;
      const newPos = { x, y, timestamp: Date.now() };

      setSlamTrajectory(prev => {
        const updated = [...prev, newPos];
        
        if (updated.length > 1) {
          const last = updated[updated.length - 2];
          const dx = newPos.x - last.x;
          const dy = newPos.y - last.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          setSlamPathLength(prevLength => prevLength + distance);
        }

        // Log every 50 updates
        updateCount++;
        if (updateCount % 50 === 0) {
          console.log(`Compare SLAM Update: ${updated.length} points, DR vs SLAM drift calculation`);
        }
        
        return updated;
      });

      // Calculate drift using latest positions
      // This runs after both trajectories are updated
      setDrTrajectory(currentDrTraj => {
        if (currentDrTraj.length > 0) {
          const drLast = currentDrTraj[currentDrTraj.length - 1];
          const drift = calculateDrift(drLast, newPos);
          setCurrentDrift(drift);
        }
        return currentDrTraj;
      });
    }, SENSOR_UPDATE_INTERVAL);
  };

  const handleExport = async () => {
    try {
      if (sensorData.length === 0) {
        Alert.alert('No Data', 'No data to export. Start tracking first.');
        return;
      }

      const result = await exportSessionData(sensorData, drTrajectory, slamTrajectory);
      
      Alert.alert(
        'Export Successful',
        `Session data exported successfully!\n\nSensor Data: ${result.sensorFile.split('/').pop()}\nDR Trajectory: ${result.drFile.split('/').pop()}\nSLAM Trajectory: ${result.slamFile?.split('/').pop() || 'N/A'}`,
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
            stopTracking();
            drEngine.current.reset();
            drEngine.current.setStrideLength(strideLength);
            setSensorData([]);
            setDrTrajectory([]);
            setSlamTrajectory([]);
            setDrPathLength(0);
            setSlamPathLength(0);
            setCurrentDrift(0);
            setStepCount(0);
            setCalibrationProgress(0);
          },
        },
      ]
    );
  };

  const driftPercentage = slamPathLength > 0 
    ? ((currentDrift / slamPathLength) * 100).toFixed(2) 
    : '0.00';

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.title}>Compare Trajectories</ThemedText>
        <ThemedText style={styles.subtitle}>
          Enhanced PDR vs SLAM Comparison
        </ThemedText>
        
        {/* SLAM Provider Info */}
        <View style={styles.providerBadge}>
          <ThemedText style={styles.providerText}>
            SLAM Provider: {slamProvider === 'orbslam3' ? '🎯 ORB-SLAM3' : slamProvider === 'arcore' ? '📱 ARCore' : '🔧 Simulated'}
          </ThemedText>
        </View>

        {/* Calibration Status */}
        {calibrationProgress < 1.0 && isTracking && (
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
              isTracking ? styles.stopButton : styles.startButton,
            ]}
            onPress={isTracking ? stopTracking : startTracking}
          >
            <ThemedText style={styles.buttonText}>
              {isTracking ? '⏹ Stop Tracking' : '▶ Start Tracking'}
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
        {isTracking && (
          <View style={styles.statusBadge}>
            <View style={styles.recordingDot} />
            <ThemedText style={styles.statusText}>Tracking Both Methods...</ThemedText>
          </View>
        )}

        {/* Display Toggles */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <View style={[styles.colorDot, { backgroundColor: '#FF6B6B' }]} />
              <ThemedText style={styles.toggleText}>Show Dead Reckoning</ThemedText>
            </View>
            <Switch
              value={showDR}
              onValueChange={setShowDR}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <View style={[styles.colorDot, { backgroundColor: '#4ECDC4' }]} />
              <ThemedText style={styles.toggleText}>Show SLAM</ThemedText>
            </View>
            <Switch
              value={showSLAM}
              onValueChange={setShowSLAM}
            />
          </View>
        </View>

        {/* Trajectory Visualization */}
        <View style={styles.chartContainer}>
          <TrajectoryChart 
            drPath={drTrajectory}
            slamPath={slamTrajectory}
            showDR={showDR}
            showSLAM={showSLAM}
          />
        </View>

        {/* Comparison Statistics */}
        <View style={styles.comparisonContainer}>
          <ThemedText style={styles.comparisonTitle}>Comparison Metrics</ThemedText>
          
          {/* Drift Analysis */}
          <View style={styles.driftCard}>
            <ThemedText style={styles.driftLabel}>Current Drift</ThemedText>
            <ThemedText style={styles.driftValue}>{currentDrift.toFixed(3)} m</ThemedText>
            <ThemedText style={styles.driftPercentage}>
              {driftPercentage}% of SLAM path length
            </ThemedText>
          </View>

          {/* Side-by-side comparison */}
          <View style={styles.comparisonGrid}>
            <View style={styles.comparisonColumn}>
              <ThemedText style={styles.columnTitle}>Dead Reckoning (PDR)</ThemedText>
              
              <View style={styles.metricCard}>
                <ThemedText style={styles.metricLabel}>Steps Detected</ThemedText>
                <ThemedText style={styles.metricValue}>{stepCount}</ThemedText>
              </View>

              <View style={styles.metricCard}>
                <ThemedText style={styles.metricLabel}>Path Length</ThemedText>
                <ThemedText style={styles.metricValue}>{drPathLength.toFixed(2)} m</ThemedText>
              </View>

              <View style={styles.metricCard}>
                <ThemedText style={styles.metricLabel}>Data Points</ThemedText>
                <ThemedText style={styles.metricValue}>{drTrajectory.length}</ThemedText>
              </View>

              <View style={styles.metricCard}>
                <ThemedText style={styles.metricLabel}>Final Position</ThemedText>
                <ThemedText style={styles.metricValue}>
                  {drTrajectory.length > 0 
                    ? `(${drTrajectory[drTrajectory.length - 1].x.toFixed(2)}, ${drTrajectory[drTrajectory.length - 1].y.toFixed(2)})` 
                    : '(0.00, 0.00)'}
                </ThemedText>
              </View>
            </View>

            <View style={styles.comparisonColumn}>
              <ThemedText style={styles.columnTitle}>SLAM ({slamProvider})</ThemedText>
              
              <View style={styles.metricCard}>
                <ThemedText style={styles.metricLabel}>Path Length</ThemedText>
                <ThemedText style={styles.metricValue}>{slamPathLength.toFixed(2)} m</ThemedText>
              </View>

              <View style={styles.metricCard}>
                <ThemedText style={styles.metricLabel}>Pose Updates</ThemedText>
                <ThemedText style={styles.metricValue}>{slamTrajectory.length}</ThemedText>
              </View>

              <View style={styles.metricCard}>
                <ThemedText style={styles.metricLabel}>Final Position</ThemedText>
                <ThemedText style={styles.metricValue}>
                  {slamTrajectory.length > 0 
                    ? `(${slamTrajectory[slamTrajectory.length - 1].x.toFixed(2)}, ${slamTrajectory[slamTrajectory.length - 1].y.toFixed(2)})` 
                    : '(0.00, 0.00)'}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Analysis */}
        <View style={styles.analysisBox}>
          <ThemedText style={styles.analysisTitle}>📊 Analysis</ThemedText>
          <ThemedText style={styles.analysisText}>
            Dead Reckoning accumulates drift over time due to sensor noise and integration errors. 
            SLAM uses visual features to correct position estimates, resulting in more accurate 
            long-term tracking.
          </ThemedText>
          {currentDrift > 0.5 && (
            <ThemedText style={[styles.analysisText, { marginTop: 10, color: '#FF9800' }]}>
              ⚠️ Significant drift detected ({currentDrift.toFixed(2)}m). This demonstrates why 
              SLAM is preferred for accurate localization.
            </ThemedText>
          )}
        </View>

        {/* Export Button */}
        <TouchableOpacity
          style={[styles.button, styles.exportButton]}
          onPress={handleExport}
          disabled={sensorData.length === 0}
        >
          <ThemedText style={styles.buttonText}>
            💾 Export Comparison Data
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
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
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
    backgroundColor: '#9C27B0',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9C27B0',
  },
  toggleContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '500',
  },
  chartContainer: {
    marginVertical: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  comparisonContainer: {
    marginVertical: 20,
  },
  comparisonTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 15,
  },
  driftCard: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  driftLabel: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 8,
  },
  driftValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  driftPercentage: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  providerBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  providerText: {
    fontSize: 14,
    fontWeight: '600',
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
  comparisonColumn: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  metricCard: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  analysisBox: {
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  analysisText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
});

export default CompareScreen;
