import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    target: 'esnext',
    outDir: './out/webview',
    rollupOptions: {
      input: {
        sessionManagement: path.resolve(__dirname, 'webview/sessionManagementView.tsx'),
        sessionPanel: path.resolve(__dirname, 'webview/sessionPanel.tsx')
      },
      output: {
        // We want a constant name so the extension can find it easily
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`,
      },
    },
  },
});