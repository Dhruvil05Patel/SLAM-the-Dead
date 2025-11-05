import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

/**
 * ARCore Pose data structure
 */
export interface ARCorePose {
  x: number;        // Position X in meters
  y: number;        // Position Y in meters
  z: number;        // Position Z in meters
  qx: number;       // Quaternion X
  qy: number;       // Quaternion Y
  qz: number;       // Quaternion Z
  qw: number;       // Quaternion W
  timestamp: number; // Timestamp in milliseconds
}

/**
 * ARCore Module interface
 */
interface ARCoreModuleInterface {
  initializeARCore(): Promise<string>;
  startTracking(): Promise<string>;
  stopTracking(): Promise<string>;
  getCurrentPose(): Promise<ARCorePose>;
  isARCoreAvailable(): Promise<boolean>;
}

// Get the native module
const { ARCoreModule: NativeARCoreModule } = NativeModules;

/**
 * ARCore Module wrapper with event emitter
 */
class ARCoreModuleWrapper {
  private eventEmitter: NativeEventEmitter | null = null;
  private nativeModule: ARCoreModuleInterface | null = null;

  constructor() {
    if (Platform.OS === 'android' && NativeARCoreModule) {
      this.nativeModule = NativeARCoreModule as ARCoreModuleInterface;
      this.eventEmitter = new NativeEventEmitter(NativeARCoreModule);
    }
  }

  /**
   * Check if ARCore is available on this device
   */
  async isAvailable(): Promise<boolean> {
    if (!this.nativeModule) {
      return false;
    }
    try {
      return await this.nativeModule.isARCoreAvailable();
    } catch (error) {
      console.error('Error checking ARCore availability:', error);
      return false;
    }
  }

  /**
   * Initialize ARCore session
   */
  async initialize(): Promise<boolean> {
    if (!this.nativeModule) {
      throw new Error('ARCore module not available. Make sure you are on Android.');
    }
    try {
      await this.nativeModule.initializeARCore();
      return true;
    } catch (error) {
      console.error('Error initializing ARCore:', error);
      throw error;
    }
  }

  /**
   * Start ARCore tracking
   */
  async startTracking(): Promise<boolean> {
    if (!this.nativeModule) {
      throw new Error('ARCore module not available');
    }
    try {
      await this.nativeModule.startTracking();
      return true;
    } catch (error) {
      console.error('Error starting ARCore tracking:', error);
      throw error;
    }
  }

  /**
   * Stop ARCore tracking
   */
  async stopTracking(): Promise<boolean> {
    if (!this.nativeModule) {
      throw new Error('ARCore module not available');
    }
    try {
      await this.nativeModule.stopTracking();
      return true;
    } catch (error) {
      console.error('Error stopping ARCore tracking:', error);
      throw error;
    }
  }

  /**
   * Get current camera pose
   */
  async getCurrentPose(): Promise<ARCorePose | null> {
    if (!this.nativeModule) {
      return null;
    }
    try {
      return await this.nativeModule.getCurrentPose();
    } catch (error) {
      console.error('Error getting current pose:', error);
      return null;
    }
  }

  /**
   * Subscribe to pose updates
   * 
   * @param callback Function to call when pose updates
   * @returns Subscription object with remove() method
   */
  onPoseUpdate(callback: (pose: ARCorePose) => void): { remove: () => void } {
    if (!this.eventEmitter) {
      console.warn('ARCore event emitter not available');
      return { remove: () => {} };
    }

    const subscription = this.eventEmitter.addListener(
      'onARCorePoseUpdate',
      callback
    );

    return {
      remove: () => {
        subscription.remove();
      },
    };
  }

  /**
   * Convert quaternion to Euler angles (for debugging)
   */
  quaternionToEuler(qx: number, qy: number, qz: number, qw: number): {
    roll: number;
    pitch: number;
    yaw: number;
  } {
    // Roll (x-axis rotation)
    const sinr_cosp = 2 * (qw * qx + qy * qz);
    const cosr_cosp = 1 - 2 * (qx * qx + qy * qy);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    // Pitch (y-axis rotation)
    const sinp = 2 * (qw * qy - qz * qx);
    const pitch = Math.abs(sinp) >= 1
      ? Math.sign(sinp) * Math.PI / 2
      : Math.asin(sinp);

    // Yaw (z-axis rotation)
    const siny_cosp = 2 * (qw * qz + qx * qy);
    const cosy_cosp = 1 - 2 * (qy * qy + qz * qz);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    return {
      roll: roll * 180 / Math.PI,
      pitch: pitch * 180 / Math.PI,
      yaw: yaw * 180 / Math.PI,
    };
  }
}

// Export singleton instance
export default new ARCoreModuleWrapper();

/**
 * Usage Example:
 * 
 * import ARCoreModule from './native/arcore/ARCoreModule';
 * 
 * // Check availability
 * const isAvailable = await ARCoreModule.isAvailable();
 * 
 * if (isAvailable) {
 *   // Initialize
 *   await ARCoreModule.initialize();
 *   
 *   // Start tracking
 *   await ARCoreModule.startTracking();
 *   
 *   // Subscribe to pose updates
 *   const subscription = ARCoreModule.onPoseUpdate((pose) => {
 *     console.log('Pose:', pose.x, pose.y, pose.z);
 *   });
 *   
 *   // Later: stop tracking
 *   await ARCoreModule.stopTracking();
 *   
 *   // Remove subscription
 *   subscription.remove();
 * }
 */
