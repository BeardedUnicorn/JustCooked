/// <reference types="vitest/config" />
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Separate Vitest configuration for regular tests (not Storybook)
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
      '@store/slices': path.resolve(__dirname, './src/store/slices')
    }
  },
  // Vitest configuration for regular tests only
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/vitest-setup.ts'],
    include: [
      'src/**/__tests__/**/*.(test|spec).(ts|tsx|js)', 
      'src/**/*.(test|spec).(ts|tsx|js)'
    ],
    exclude: ['node_modules', 'dist', '.storybook', 'src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**/*.{ts,tsx}', 'src/utils/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**', 'src/vitest-setup.ts', 'src/main.tsx', 'src/App.tsx', 'src/vite-env.d.ts', 'src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage'
    },
    globals: true,
    bail: 1,
    watch: false
  }
});
