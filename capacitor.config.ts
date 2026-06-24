import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.zova.chat',
  appName: 'Zova',
  webDir: 'public',
  server: {
    url: 'https://zova-chat.vercel.app',
    cleartext: true,
  },
};

export default config;