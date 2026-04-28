import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import manifest from './manifest.json' with { type: 'json' };

// Cast: TS infers `background.type` as `string`, but @crxjs requires the literal `"module"`.
const typedManifest = manifest as unknown as Parameters<typeof crx>[0]['manifest'];

export default defineConfig({
  plugins: [react(), crx({ manifest: typedManifest })],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        sidepanel: path.resolve(__dirname, 'sidepanel.html'),
        popup: path.resolve(__dirname, 'popup.html'),
        options: path.resolve(__dirname, 'options.html'),
      },
    },
  },
  server: { port: 5173, strictPort: true, hmr: { port: 5173 } },
});
