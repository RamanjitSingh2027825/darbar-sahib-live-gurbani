import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ramanjitsingh.darbarlive',
  appName: 'Darbar Sahib Live',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;