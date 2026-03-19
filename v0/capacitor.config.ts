import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.runsmart.coach',
  appName: 'RunSmart',
  webDir: 'capacitor-fallback',
  server: {
    url: 'https://runsmart-ai.com',
    allowNavigation: [
      'runsmart-ai.com',
      '*.runsmart-ai.com',
      '*.vercel.app',
      '*.supabase.co',
    ],
  },
  ios: {
    path: '../apps/ios',
    scheme: 'App',
    contentInset: 'automatic',
  },
};

export default config;
