/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Path aliases matching TypeScript configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@app-types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@styles': path.resolve(__dirname, './src'),
      '@store': path.resolve(__dirname, './src/store'),
      '@store/slices': path.resolve(__dirname, './src/store/slices'),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,

  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
  },

  // To make use of `TAURI_DEBUG` and other env variables
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri supports es2021
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  // Vitest configuration
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/vitest-setup.ts'],
    include: [
      'src/**/__tests__/**/*.(test|spec).(ts|tsx|js)',
      'src/**/*.(test|spec).(ts|tsx|js)',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/services/**/*.{ts,tsx}',
        'src/utils/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
        'src/pages/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/vitest-setup.ts',
        'src/main.tsx',
        'src/App.tsx',
        'src/vite-env.d.ts',
      ],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
    },
    globals: true,
    bail: 1,
    watch: false,
  },
});
