import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sekip.vibefighter',
  appName: 'Vibe Fighter',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
