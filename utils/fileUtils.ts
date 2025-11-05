import * as FileSystem from 'expo-file-system';
import type { Position, SensorData } from './constants';

const baseDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || null;
const DATA_DIR = baseDir ? `${baseDir}sessions` : undefined;

async function ensureDir(): Promise<string> {
  if (!DATA_DIR) throw new Error('File system not available');
  const info = await FileSystem.getInfoAsync(DATA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
  }
  return DATA_DIR;
}

export async function saveSensorData(data: SensorData[], filename?: string): Promise<string> {
  const dir = await ensureDir();
  const name = filename || `sensor_${Date.now()}.json`;
  const path = `${dir}/${name}`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data), { encoding: 'utf8' as any });
  return path;
}

export async function saveSensorDataAsCSV(data: SensorData[], filename?: string): Promise<string> {
  const dir = await ensureDir();
  const name = filename || `sensor_${Date.now()}.csv`;
  const path = `${dir}/${name}`;
  const header = 'timestamp,type,x,y,z\n';
  const rows = data.map(d => `${d.timestamp},${d.type},${d.x},${d.y},${d.z}`).join('\n');
  await FileSystem.writeAsStringAsync(path, header + rows, { encoding: 'utf8' as any });
  return path;
}

export async function saveTrajectoryData(traj: Position[], prefix: 'dr' | 'slam' = 'dr'): Promise<string> {
  const dir = await ensureDir();
  const name = `${prefix}_trajectory_${Date.now()}.json`;
  const path = `${dir}/${name}`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(traj), { encoding: 'utf8' as any });
  return path;
}

export async function exportSessionData(
  sensors: SensorData[],
  drTrajectory: Position[],
  slamTrajectory?: Position[]
): Promise<{ sensorFile: string; drFile: string; slamFile?: string }> {
  const sensorFile = await saveSensorData(sensors);
  const drFile = await saveTrajectoryData(drTrajectory, 'dr');
  let slamFile: string | undefined;
  if (slamTrajectory) {
    slamFile = await saveTrajectoryData(slamTrajectory, 'slam');
  }
  return { sensorFile, drFile, slamFile };
}
