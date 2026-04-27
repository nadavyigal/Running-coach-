import { Capacitor } from '@capacitor/core'

export interface NativeCapabilities {
  isNative: boolean
  platform: string
  plugins: {
    app: boolean
    geolocation: boolean
    backgroundGeolocation: boolean
    share: boolean
  }
}

export function getNativeCapabilities(): NativeCapabilities {
  return {
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    plugins: {
      app: Capacitor.isPluginAvailable('App'),
      geolocation: Capacitor.isPluginAvailable('Geolocation'),
      backgroundGeolocation: Capacitor.isPluginAvailable('BackgroundGeolocation'),
      share: Capacitor.isPluginAvailable('Share'),
    },
  }
}
