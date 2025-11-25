/**
 * Application Version Tracking
 * 
 * This file helps verify which version of the app is deployed.
 * Update BUILD_VERSION on each deployment.
 */

// Update this on each significant deployment
export const APP_VERSION = '1.1.0';
export const BUILD_TIMESTAMP = '2025-11-25T12:00:00Z';
export const BUILD_ID = 'prod-fixes-v2';

/**
 * Get version info for display and debugging
 */
export function getVersionInfo(): {
  version: string;
  buildId: string;
  timestamp: string;
  environment: string;
} {
  return {
    version: APP_VERSION,
    buildId: BUILD_ID,
    timestamp: BUILD_TIMESTAMP,
    environment: process.env.NODE_ENV || 'development'
  };
}

/**
 * Log version info to console on app startup
 */
export function logVersionInfo(): void {
  const info = getVersionInfo();
  console.log('=====================================');
  console.log('🚀 Run-Smart App Version Info');
  console.log(`   Version: ${info.version}`);
  console.log(`   Build ID: ${info.buildId}`);
  console.log(`   Timestamp: ${info.timestamp}`);
  console.log(`   Environment: ${info.environment}`);
  console.log('=====================================');
}

/**
 * Check if app version has changed and clear cache if needed
 */
export function checkVersionAndClearCache(): boolean {
  if (typeof window === 'undefined') return false;
  
  const STORAGE_KEY = 'app-version';
  const storedVersion = localStorage.getItem(STORAGE_KEY);
  
  if (storedVersion !== APP_VERSION) {
    console.log(`[Version] App updated: ${storedVersion} -> ${APP_VERSION}`);
    
    // Clear any cached state that might cause issues
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
    
    // If there was a previous version, we might need to handle migration
    if (storedVersion) {
      console.log('[Version] Clearing potentially stale cache...');
      // Clear service worker cache if present
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('next') || name.includes('workbox')) {
              caches.delete(name);
              console.log(`[Version] Cleared cache: ${name}`);
            }
          });
        });
      }
      return true; // Version changed
    }
  }
  
  return false;
}

/**
 * Get a short version string for display in UI
 */
export function getShortVersion(): string {
  return `v${APP_VERSION}`;
}

