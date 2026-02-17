// .storybook/preview.ts
import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import darkTheme from '../src/theme';
import type { Preview, Decorator } from '@storybook/react-vite';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider as ReduxProvider } from 'react-redux';
import { store as appStore } from '../src/store';
import '../src/styles.css';

// Mock Tauri APIs globally for Storybook
// Note: These mocks are for Storybook preview only, not for Vitest tests
const mockInvoke = async (command: string, args?: any) => {
  console.log('[Storybook Mock Invoke]', command, args);
  // Add default mock responses as needed
  if (command === 'get_import_queue_status') return Promise.resolve({ tasks: [], currentTaskId: null, isProcessing: false, totalPending: 0, totalCompleted: 0, totalFailed: 0 });
  if (command === 'db_get_all_recipes') return Promise.resolve([]);
  // ... other common mocks
  return Promise.resolve(undefined);
};

// Mock Tauri modules for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__TAURI__ = {
    core: { invoke: mockInvoke },
    fs: {},
    dialog: {},
  };
}

// Mock crypto.randomUUID if not available in Storybook's environment
if (typeof globalThis.crypto === 'undefined') {
  // @ts-ignore
  globalThis.crypto = { randomUUID: () => 'storybook-mock-uuid-' + Math.random().toString(36).substring(2, 15) };
} else if (typeof globalThis.crypto.randomUUID === 'undefined') {
  // @ts-ignore
  globalThis.crypto.randomUUID = () => 'storybook-mock-uuid-' + Math.random().toString(36).substring(2, 15);
}


const muiDecorator: Decorator = (Story) => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <Story />
  </ThemeProvider>
);

const localizationDecorator: Decorator = (Story) => (
  <LocalizationProvider dateAdapter={AdapterDateFns}>
    <Story />
  </LocalizationProvider>
);

const routerDecorator: Decorator = (Story, context) => {
  const { initialEntries = ['/'], initialIndex = 0 } = context.parameters.router || {};
  return (
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <Routes>
        <Route path="/*" element={<Story />} />
      </Routes>
    </MemoryRouter>
  );
};

const reduxDecorator: Decorator = (Story, context) => {
  const store = context.parameters.redux?.store || appStore;
  return (
    <ReduxProvider store={store}>
      <Story />
    </ReduxProvider>
  );
};

export const decorators = [
  muiDecorator,
  localizationDecorator,
  routerDecorator,
  reduxDecorator,
];

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
  // decorators defined above
};
export default preview;