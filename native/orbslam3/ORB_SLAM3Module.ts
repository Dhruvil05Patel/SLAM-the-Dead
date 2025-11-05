import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export interface SlamPose {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  timestamp: number;
}

interface ORBSLAM3ModuleInterface {
  isAvailable(): Promise<boolean>;
  initialize(vocabularyAssetUri?: string, settingsAssetUri?: string): Promise<string>;
  start(): Promise<string>;
  stop(): Promise<string>;
  getCurrentPose(): Promise<SlamPose>;
}

const { ORB_SLAM3Module: NativeORBModule } = NativeModules as any;

class ORBSLAM3Wrapper {
  private eventEmitter: NativeEventEmitter | null = null;
  private native: ORBSLAM3ModuleInterface | null = null;

  constructor() {
    if (Platform.OS === 'android' && NativeORBModule) {
      this.native = NativeORBModule as ORBSLAM3ModuleInterface;
      this.eventEmitter = new NativeEventEmitter(NativeORBModule);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.native) return false;
    try {
      return await this.native.isAvailable();
    } catch (e) {
      console.warn('ORBSLAM3 availability check failed:', e);
      return false;
    }
  }

  async initialize(vocabularyAssetUri?: string, settingsAssetUri?: string): Promise<boolean> {
    if (!this.native) throw new Error('ORBSLAM3 module not available');
    await this.native.initialize(vocabularyAssetUri, settingsAssetUri);
    return true;
  }

  async start(): Promise<boolean> {
    if (!this.native) throw new Error('ORBSLAM3 module not available');
    await this.native.start();
    return true;
  }

  async stop(): Promise<boolean> {
    if (!this.native) throw new Error('ORBSLAM3 module not available');
    await this.native.stop();
    return true;
  }

  async getCurrentPose(): Promise<SlamPose | null> {
    if (!this.native) return null;
    try {
      return await this.native.getCurrentPose();
    } catch (e) {
      console.warn('ORBSLAM3 getCurrentPose failed:', e);
      return null;
    }
  }

  onPoseUpdate(callback: (pose: SlamPose) => void): { remove: () => void } {
    if (!this.eventEmitter) {
      return { remove: () => {} };
    }
    const sub = this.eventEmitter.addListener('onORBSLAM3PoseUpdate', callback);
    return { remove: () => sub.remove() };
  }
}

export default new ORBSLAM3Wrapper();
