import { HeartRateZone } from './db';

export interface HeartRateZoneConfig {
  zone1: { min: number; max: number };
  zone2: { min: number; max: number };
  zone3: { min: number; max: number };
  zone4: { min: number; max: number };
  zone5: { min: number; max: number };
}

export interface HeartRateZoneSettings {
  id: string;
  userId: number;
  calculationMethod: 'max_hr' | 'lactate_threshold' | 'hrr' | 'manual';
  maxHeartRate?: number;
  restingHeartRate?: number;
  lactateThresholdHR?: number;
  zoneSystem: 'five_zone' | 'three_zone' | 'custom';
  customZones?: CustomZone[];
  autoUpdate: boolean;
  lastCalculated: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomZone {
  zoneNumber: number;
  name: string;
  minBpm: number;
  maxBpm: number;
  color: string;
}

export interface ZoneDistribution {
  id: string;
  runId: number;
  zone1Time: number;
  zone2Time: number;
  zone3Time: number;
  zone4Time: number;
  zone5Time: number;
  zone1Percentage: number;
  zone2Percentage: number;
  zone3Percentage: number;
  zone4Percentage: number;
  zone5Percentage: number;
  totalTime: number;
  createdAt: Date;
}

export interface HeartRateAnalysis {
  currentZone: number;
  zoneName: string;
  zoneDescription: string;
  timeInZones: { [key: number]: number };
  averageHR: number;
  maxHR: number;
  hrr: number;
}

export function calculateMaxHeartRate(age: number): number {
  return 220 - age;
}

export function calculateHeartRateZones(maxHR: number, restingHR?: number): HeartRateZoneConfig {
  const hrReserve = restingHR ? maxHR - restingHR : maxHR;
  const baseHR = restingHR || 0;

  return {
    zone1: {
      min: Math.round((hrReserve * 0.5) + baseHR),
      max: Math.round((hrReserve * 0.6) + baseHR)
    },
    zone2: {
      min: Math.round((hrReserve * 0.6) + baseHR),
      max: Math.round((hrReserve * 0.7) + baseHR)
    },
    zone3: {
      min: Math.round((hrReserve * 0.7) + baseHR),
      max: Math.round((hrReserve * 0.8) + baseHR)
    },
    zone4: {
      min: Math.round((hrReserve * 0.8) + baseHR),
      max: Math.round((hrReserve * 0.9) + baseHR)
    },
    zone5: {
      min: Math.round((hrReserve * 0.9) + baseHR),
      max: maxHR
    }
  };
}

export function getHeartRateZone(heartRate: number, zones: HeartRateZoneConfig): number {
  if (heartRate <= zones.zone1.max) return 1;
  if (heartRate <= zones.zone2.max) return 2;
  if (heartRate <= zones.zone3.max) return 3;
  if (heartRate <= zones.zone4.max) return 4;
  return 5;
}

export function getZoneInfo(zone: number) {
  const zoneData = {
    1: { name: 'Recovery', description: 'Active recovery and warm-up', color: '#10B981' },
    2: { name: 'Aerobic Base', description: 'Base training and fat burning', color: '#3B82F6' },
    3: { name: 'Aerobic', description: 'Steady state and endurance', color: '#F59E0B' },
    4: { name: 'Lactate Threshold', description: 'Tempo and threshold training', color: '#EF4444' },
    5: { name: 'VO2 Max', description: 'High intensity and maximum effort', color: '#7C3AED' }
  };

  return zoneData[zone as keyof typeof zoneData] || zoneData[1];
}

export function analyzeHeartRateData(
  heartRateData: Array<{ timestamp: Date; heartRate: number }>,
  zones: HeartRateZoneConfig
): HeartRateAnalysis {
  if (heartRateData.length === 0) {
    return {
      currentZone: 1,
      zoneName: 'Recovery',
      zoneDescription: 'Active recovery and warm-up',
      timeInZones: {},
      averageHR: 0,
      maxHR: 0,
      hrr: 0
    };
  }

  const timeInZones: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const heartRates = heartRateData.map(d => d.heartRate);
  
  for (let i = 1; i < heartRateData.length; i++) {
    const timeDiff = heartRateData[i].timestamp.getTime() - heartRateData[i - 1].timestamp.getTime();
    const zone = getHeartRateZone(heartRateData[i].heartRate, zones);
    timeInZones[zone] += timeDiff;
  }

  const averageHR = Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length);
  const maxHR = Math.max(...heartRates);
  const minHR = Math.min(...heartRates);
  const currentZone = getHeartRateZone(averageHR, zones);
  const zoneInfo = getZoneInfo(currentZone);

  return {
    currentZone,
    zoneName: zoneInfo.name,
    zoneDescription: zoneInfo.description,
    timeInZones,
    averageHR,
    maxHR,
    hrr: maxHR - minHR
  };
}

export function formatTimeInZone(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export function getZonePercentage(timeInZone: number, totalTime: number): number {
  return totalTime > 0 ? Math.round((timeInZone / totalTime) * 100) : 0;
}

export function calculateMaxHRZones(maxHR: number, userId: number): Omit<HeartRateZone, 'id'>[] {
  return [
    {
      userId,
      zoneNumber: 1,
      name: 'Recovery',
      description: 'Active recovery and easy runs',
      minBpm: 0,
      maxBpm: Math.round(maxHR * 0.60),
      color: '#3B82F6',
      trainingBenefit: 'Promotes recovery and builds aerobic base',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 2,
      name: 'Aerobic Base',
      description: 'Base building and long runs',
      minBpm: Math.round(maxHR * 0.60),
      maxBpm: Math.round(maxHR * 0.70),
      color: '#10B981',
      trainingBenefit: 'Develops aerobic capacity and fat burning',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 3,
      name: 'Aerobic',
      description: 'Moderate efforts and tempo runs',
      minBpm: Math.round(maxHR * 0.70),
      maxBpm: Math.round(maxHR * 0.80),
      color: '#F59E0B',
      trainingBenefit: 'Improves aerobic power and running efficiency',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 4,
      name: 'Threshold',
      description: 'Lactate threshold and tempo runs',
      minBpm: Math.round(maxHR * 0.80),
      maxBpm: Math.round(maxHR * 0.90),
      color: '#F97316',
      trainingBenefit: 'Increases lactate threshold and race pace',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 5,
      name: 'VO2 Max',
      description: 'High intensity intervals',
      minBpm: Math.round(maxHR * 0.90),
      maxBpm: maxHR,
      color: '#EF4444',
      trainingBenefit: 'Develops maximum oxygen uptake and power',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
}

export function calculateLTZones(lactateThresholdHR: number, userId: number): Omit<HeartRateZone, 'id'>[] {
  return [
    {
      userId,
      zoneNumber: 1,
      name: 'Recovery',
      description: 'Active recovery and easy runs',
      minBpm: 0,
      maxBpm: Math.round(lactateThresholdHR * 0.75),
      color: '#3B82F6',
      trainingBenefit: 'Promotes recovery and builds aerobic base',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 2,
      name: 'Aerobic',
      description: 'Aerobic base building',
      minBpm: Math.round(lactateThresholdHR * 0.75),
      maxBpm: Math.round(lactateThresholdHR * 0.85),
      color: '#10B981',
      trainingBenefit: 'Develops aerobic capacity and endurance',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 3,
      name: 'Tempo',
      description: 'Tempo and steady-state runs',
      minBpm: Math.round(lactateThresholdHR * 0.85),
      maxBpm: Math.round(lactateThresholdHR * 0.95),
      color: '#F59E0B',
      trainingBenefit: 'Improves aerobic power and running economy',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 4,
      name: 'Threshold',
      description: 'Lactate threshold efforts',
      minBpm: Math.round(lactateThresholdHR * 0.95),
      maxBpm: Math.round(lactateThresholdHR * 1.05),
      color: '#F97316',
      trainingBenefit: 'Increases lactate threshold and race pace',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 5,
      name: 'Anaerobic',
      description: 'High intensity anaerobic efforts',
      minBpm: Math.round(lactateThresholdHR * 1.05),
      maxBpm: 220,
      color: '#EF4444',
      trainingBenefit: 'Develops anaerobic power and speed',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
}

export function calculateHRRZones(maxHR: number, restingHR: number, userId: number): Omit<HeartRateZone, 'id'>[] {
  const hrReserve = maxHR - restingHR;
  
  return [
    {
      userId,
      zoneNumber: 1,
      name: 'Recovery',
      description: 'Active recovery and easy runs',
      minBpm: restingHR,
      maxBpm: Math.round(restingHR + (hrReserve * 0.60)),
      color: '#3B82F6',
      trainingBenefit: 'Promotes recovery and builds aerobic base',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 2,
      name: 'Aerobic Base',
      description: 'Base building and long runs',
      minBpm: Math.round(restingHR + (hrReserve * 0.60)),
      maxBpm: Math.round(restingHR + (hrReserve * 0.70)),
      color: '#10B981',
      trainingBenefit: 'Develops aerobic capacity and fat burning',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 3,
      name: 'Aerobic',
      description: 'Moderate efforts and tempo runs',
      minBpm: Math.round(restingHR + (hrReserve * 0.70)),
      maxBpm: Math.round(restingHR + (hrReserve * 0.80)),
      color: '#F59E0B',
      trainingBenefit: 'Improves aerobic power and running efficiency',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 4,
      name: 'Threshold',
      description: 'Lactate threshold and tempo runs',
      minBpm: Math.round(restingHR + (hrReserve * 0.80)),
      maxBpm: Math.round(restingHR + (hrReserve * 0.90)),
      color: '#F97316',
      trainingBenefit: 'Increases lactate threshold and race pace',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userId,
      zoneNumber: 5,
      name: 'VO2 Max',
      description: 'High intensity intervals',
      minBpm: Math.round(restingHR + (hrReserve * 0.90)),
      maxBpm: maxHR,
      color: '#EF4444',
      trainingBenefit: 'Develops maximum oxygen uptake and power',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
}

export function getHeartRateZoneFromBpm(heartRate: number, zones: HeartRateZone[]): HeartRateZone | null {
  return zones.find(zone => heartRate >= zone.minBpm && heartRate <= zone.maxBpm) || null;
}

export function calculateZoneDistribution(
  heartRateData: { timestamp: Date; heartRate: number }[],
  zones: HeartRateZone[]
): Omit<ZoneDistribution, 'id' | 'runId' | 'createdAt'> {
  const zoneTimes = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalTime = 0;

  for (let i = 1; i < heartRateData.length; i++) {
    const timeDiff = (heartRateData[i].timestamp.getTime() - heartRateData[i - 1].timestamp.getTime()) / 1000;
    totalTime += timeDiff;

    const currentZone = getHeartRateZoneFromBpm(heartRateData[i].heartRate, zones);
    if (currentZone) {
      zoneTimes[currentZone.zoneNumber as keyof typeof zoneTimes] += timeDiff;
    }
  }

  const zone1Percentage = totalTime > 0 ? (zoneTimes[1] / totalTime) * 100 : 0;
  const zone2Percentage = totalTime > 0 ? (zoneTimes[2] / totalTime) * 100 : 0;
  const zone3Percentage = totalTime > 0 ? (zoneTimes[3] / totalTime) * 100 : 0;
  const zone4Percentage = totalTime > 0 ? (zoneTimes[4] / totalTime) * 100 : 0;
  const zone5Percentage = totalTime > 0 ? (zoneTimes[5] / totalTime) * 100 : 0;

  return {
    zone1Time: Math.round(zoneTimes[1]),
    zone2Time: Math.round(zoneTimes[2]),
    zone3Time: Math.round(zoneTimes[3]),
    zone4Time: Math.round(zoneTimes[4]),
    zone5Time: Math.round(zoneTimes[5]),
    zone1Percentage: Math.round(zone1Percentage * 10) / 10,
    zone2Percentage: Math.round(zone2Percentage * 10) / 10,
    zone3Percentage: Math.round(zone3Percentage * 10) / 10,
    zone4Percentage: Math.round(zone4Percentage * 10) / 10,
    zone5Percentage: Math.round(zone5Percentage * 10) / 10,
    totalTime: Math.round(totalTime)
  };
}

export function estimateMaxHeartRate(age: number): number {
  return 220 - age;
}

export function validateHeartRateZones(zones: HeartRateZone[]): string[] {
  const errors: string[] = [];
  
  if (zones.length !== 5) {
    errors.push('Must have exactly 5 heart rate zones');
  }
  
  for (let i = 0; i < zones.length - 1; i++) {
    if (zones[i].maxBpm !== zones[i + 1].minBpm) {
      errors.push(`Zone ${zones[i].zoneNumber} max BPM must equal Zone ${zones[i + 1].zoneNumber} min BPM`);
    }
  }
  
  zones.forEach(zone => {
    if (zone.minBpm >= zone.maxBpm) {
      errors.push(`Zone ${zone.zoneNumber} min BPM must be less than max BPM`);
    }
    if (zone.minBpm < 30 || zone.maxBpm > 220) {
      errors.push(`Zone ${zone.zoneNumber} BPM values must be between 30 and 220`);
    }
  });
  
  return errors;
}
