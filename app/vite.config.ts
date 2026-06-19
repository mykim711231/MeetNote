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
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      manifest: {
        id: '/MeetNote/',
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
        // Web Share Target: iOS 음성 메모 → 공유 → MeetNote
        share_target: {
          action: 'share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'file',
                accept: ['audio/*', '.m4a', '.mp3', '.aac', '.wav', '.mp4', '.ogg', '.opus'],
              },
            ],
          },
        },
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/transformers*', '**/whisper*', '**/ort*', '**/*.wasm'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  // transformers.js는 prebundle하지 않음(onnxruntime-web 호환)
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2020', // transformers.js의 BigInt 리터럴 지원 (모던 브라우저·iOS14+)
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
