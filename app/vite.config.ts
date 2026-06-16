import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

const isCloudflare = process.env.DEPLOY_TARGET === 'cf';

export default defineConfig(({ command }) => {
  // 배포(GitHub Pages) 빌드만 '/MeetNote/'. 로컬 dev 서버는 루트('/')로 동작.
  const base = command === 'build' && !isCloudflare ? '/MeetNote/' : '/';
  return {
  base,
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        id: '/MeetNote/', // 배포 타깃(base)과 무관하게 고정 — 동일 앱으로 인식
        name: 'MeetNote 회의록',
        short_name: 'MeetNote',
        description: '개인용 무료 로컬 회의록 녹음기',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FAFAFA',
        theme_color: '#4f46e5',
        lang: 'ko',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/(api|_)\//],
      },
    }),
  ],
  build: {
    target: 'es2017',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          state: ['zustand'],
        },
      },
    },
  },
  };
});
