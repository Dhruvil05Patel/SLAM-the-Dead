import { NativeModules } from 'react-native';

export type Pose = { x: number; y: number; z?: number; timestamp: number } | null;

type NativeORBModule = {
  isAvailable?: () => Promise<boolean> | boolean;
  initialize?: () => Promise<void> | void;
  start?: () => Promise<void> | void;
  stop?: () => Promise<void> | void;
  getCurrentPose?: () => Promise<Pose> | Pose;
};

const ExpoModulesProxy: Record<string, unknown> | undefined = (globalThis as any)?.ExpoModules;
const expoModule = ExpoModulesProxy?.ORBSLAM3 as NativeORBModule | undefined;
const reactNativeModule = NativeModules?.ORBSLAM3Module as NativeORBModule | undefined;

const nativeModule: NativeORBModule | undefined = expoModule ?? reactNativeModule;

const ensurePromise = async <T>(value: Promise<T> | T, fallback: T): Promise<T> => {
  try {
    return await value;
  } catch (error) {
    console.warn('[ORB-SLAM3] Native call failed', error);
    return fallback;
  }
};

const ORBSLAM3 = {
  async isAvailable(): Promise<boolean> {
    if (!nativeModule) {
      return false;
    }
    if (typeof nativeModule.isAvailable === 'function') {
      return ensurePromise(nativeModule.isAvailable(), false);
    }
    return true;
  },
  async initialize(): Promise<void> {
    if (!nativeModule || typeof nativeModule.initialize !== 'function') {
      return;
    }
    await ensurePromise(nativeModule.initialize(), undefined as void);
  },
  async start(): Promise<void> {
    if (!nativeModule || typeof nativeModule.start !== 'function') {
      return;
    }
    await ensurePromise(nativeModule.start(), undefined as void);
  },
  async stop(): Promise<void> {
    if (!nativeModule || typeof nativeModule.stop !== 'function') {
      return;
    }
    await ensurePromise(nativeModule.stop(), undefined as void);
  },
  async getCurrentPose(): Promise<Pose> {
    if (!nativeModule || typeof nativeModule.getCurrentPose !== 'function') {
      return null;
    }
    return ensurePromise<Pose>(nativeModule.getCurrentPose(), null);
  },
};

if (!nativeModule) {
  const linkingHint =
    "[ORB-SLAM3] Native module not found. If you're running inside Expo Go or haven't linked the custom module, you'll need to build a development client (expo run:android / expo run:ios) with the ORB-SLAM3 native bindings installed.";
  if (__DEV__) {
    console.warn(linkingHint);
  }
}

export default ORBSLAM3;
