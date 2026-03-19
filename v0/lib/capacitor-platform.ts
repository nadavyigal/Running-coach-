import { Capacitor } from '@capacitor/core';

export function getCapacitorPlatform(): string {
  return Capacitor.getPlatform();
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isIOSNativeApp(): boolean {
  return isNativePlatform() && getCapacitorPlatform() === 'ios';
}
