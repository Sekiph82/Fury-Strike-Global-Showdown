import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sekip.vibefighter',
  appName: 'Fury Strike',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
