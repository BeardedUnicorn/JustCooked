// This file has been automatically migrated to valid ESM format by Storybook.
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  addons: [
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-a11y"),
  ],

  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },

  async viteFinal(config, { configType }) {
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '../src'),
          '@components': path.resolve(__dirname, '../src/components'),
          '@pages': path.resolve(__dirname, '../src/pages'),
          '@services': path.resolve(__dirname, '../src/services'),
          '@app-types': path.resolve(__dirname, '../src/types'),
          '@app-types/*': path.resolve(__dirname, '../src/types/*'),
          '@utils': path.resolve(__dirname, '../src/utils'),
          '@hooks': path.resolve(__dirname, '../src/hooks'),
          '@styles': path.resolve(__dirname, '../src'),
          '@store': path.resolve(__dirname, '../src/store'),
          '@store/slices': path.resolve(__dirname, '../src/store/slices'),
          '@store/slices/*': path.resolve(__dirname, '../src/store/slices/*'),
        },
      },
      define: {
        // Fix browser compatibility issues
        global: 'globalThis',
      },
      optimizeDeps: {
        include: ['storybook/test'],
      },
    });
  }
};
export default config;

function getAbsolutePath(value: string): any {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}