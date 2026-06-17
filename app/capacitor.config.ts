import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.meetnote.hybrid',
  appName: 'MeetNote',
  webDir: 'dist',
  ios: {
    // WKWebView 상단/하단 safe-area 처리
    contentInset: 'always',
  },
};

export default config;
