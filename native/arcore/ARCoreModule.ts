// Stub ARCore module for Expo Go / development without native bindings
// Provides the API surface used by SLAM screen but always returns unavailable

export type Pose = { x: number; y: number; z?: number; timestamp: number } | null;

const ARCore = {
  async isAvailable(): Promise<boolean> {
    return false;
  },
  async initialize(): Promise<void> {
    // no-op in stub
  },
  async startTracking(): Promise<void> {
    // no-op in stub
  },
  async stopTracking(): Promise<void> {
    // no-op in stub
  },
  async getCurrentPose(): Promise<Pose> {
    return null;
  },
};

export default ARCore;
