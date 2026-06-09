import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ashbi.pootparty',
  appName: 'Poot Party',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    url: undefined,
    cleartext: false,
  },
};

export default config;
