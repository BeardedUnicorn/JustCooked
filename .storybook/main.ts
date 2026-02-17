import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook', // includes essentials, links, interactions
    '@storybook/addon-docs',
    '@storybook/addon-a11y', // Add accessibility addon
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
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
  },
};
export default config;