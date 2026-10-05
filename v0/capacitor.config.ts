import type { CapacitorConfig } from '@capacitor/cli';

const defaultServerUrl = 'https://runsmart-ai.com';
const defaultAllowNavigation = [
  'runsmart-ai.com',
  '*.runsmart-ai.com',
  '*.vercel.app',
  '*.supabase.co',
];

const parseList = (value?: string) =>
  value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];

const serverUrl = process.env.RS_SERVER_URL?.trim() || defaultServerUrl;
const serverHost = (() => {
  try {
    return new URL(serverUrl).hostname;
  } catch {
    return undefined;
  }
})();

const config: CapacitorConfig = {
  appId: 'com.runsmart.coach',
  appName: 'RunSmart',
  webDir: 'capacitor-fallback',
  server: {
    url: serverUrl,
    allowNavigation: Array.from(
      new Set([
        ...defaultAllowNavigation,
        ...(serverHost ? [serverHost] : []),
        ...parseList(process.env.RS_ALLOW_NAV),
      ])
    ),
  },
  ios: {
    path: '../apps/ios',
    scheme: 'App',
    contentInset: 'automatic',
  },
};

export default config;
