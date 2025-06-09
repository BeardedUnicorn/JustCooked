// Mock TextEncoder/TextDecoder for Node.js environment FIRST
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Mock crypto.randomUUID for consistent test results
const mockRandomUUID = jest.fn(() => 'test-uuid-123');
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: mockRandomUUID,
  },
  writable: true,
});

// Mock localStorage with actual storage behavior
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    // Helper method to reset storage between tests
    _reset: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Tauri APIs
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: jest.fn(),
  writeTextFile: jest.fn(),
  mkdir: jest.fn(),
  remove: jest.fn(),
  exists: jest.fn(),
  BaseDirectory: {
    AppLocalData: 'AppLocalData',
  },
}));

jest.mock('@tauri-apps/plugin-http', () => ({
  fetch: jest.fn(),
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  (localStorageMock as any)._reset();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});
