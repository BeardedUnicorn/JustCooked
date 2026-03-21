import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import BarcodeScanner from './BarcodeScanner';

// Browser-compatible mock implementation variables
let mockResetImplementation = fn();
let mockDecodeFromVideoDeviceImplementation = fn();
let mockDecodeFromVideoElementImplementation = fn();
let mockListVideoInputDevicesImplementation = fn().mockResolvedValue([
  { deviceId: 'camera1', label: 'Camera 1', kind: 'videoinput' }
]);
let mockGetUserMediaImplementation = fn();

// Mock stream object
const mockStream = {
  getTracks: fn().mockReturnValue([
    { stop: fn() }
  ])
};

// Mock the logging service for Storybook environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__STORYBOOK_LOGGING_MOCKS__ = {
    createLogger: fn().mockReturnValue({
      info: fn().mockResolvedValue(undefined),
      debug: fn().mockResolvedValue(undefined),
      warn: fn().mockResolvedValue(undefined),
      error: fn().mockResolvedValue(undefined),
      logError: fn().mockResolvedValue(undefined),
      logUserAction: fn().mockResolvedValue(undefined),
    }),
  };
}

// Mock ZXing browser library for Storybook environment
if (typeof window !== 'undefined') {
  class BrowserMultiFormatReaderMock {
    static listVideoInputDevices = mockListVideoInputDevicesImplementation;
    decodeFromVideoDevice = mockDecodeFromVideoDeviceImplementation;
    decodeFromVideoElement = mockDecodeFromVideoElementImplementation;
    reset = mockResetImplementation;
    hints = new Map();
  }

  // @ts-ignore
  window.__STORYBOOK_ZXING_MOCKS__ = {
    BrowserMultiFormatReader: BrowserMultiFormatReaderMock,
    NotFoundException: class NotFoundException extends Error {
      constructor(message?: string) {
        super(message);
        this.name = 'NotFoundException';
      }
    },
    DecodeHintType: {
      TRY_HARDER: 'TRY_HARDER',
      POSSIBLE_FORMATS: 'POSSIBLE_FORMATS',
      ASSUME_GS1: 'ASSUME_GS1',
    },
    BarcodeFormat: {
      UPC_A: 'UPC_A',
      UPC_E: 'UPC_E',
      EAN_13: 'EAN_13',
      EAN_8: 'EAN_8',
      CODE_128: 'CODE_128',
      CODE_39: 'CODE_39',
      ITF: 'ITF',
      RSS_14: 'RSS_14',
      RSS_EXPANDED: 'RSS_EXPANDED',
    },
  };
}

// Mock navigator.mediaDevices for Storybook environment
if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: mockGetUserMediaImplementation,
    },
  });
}

const meta: Meta<typeof BarcodeScanner> = {
  title: 'Input/BarcodeScanner',
  component: BarcodeScanner,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'closed' },
    onScan: { action: 'scanned' },
    open: { control: 'boolean' },
  },
  args: {
    onClose: fn(),
    onScan: fn(),
    open: true,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// DefaultOpen: Initial state when opened
export const DefaultOpen: Story = {
  beforeEach: () => {
    mockGetUserMediaImplementation = fn().mockResolvedValue(mockStream);
    mockDecodeFromVideoElementImplementation = fn().mockImplementation(() => new Promise(() => {})); // Never resolves

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: mockGetUserMediaImplementation,
        },
      });
    }
  },
};

// RequestingPermission: Simulate delay in permission
export const RequestingPermission: Story = {
  beforeEach: () => {
    // Create a promise that takes a long time to resolve
    mockGetUserMediaImplementation = fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve(mockStream), 5000))
    );
    mockDecodeFromVideoElementImplementation = fn().mockImplementation(() => new Promise(() => {}));

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: mockGetUserMediaImplementation,
        },
      });
    }
  },
};

// PermissionDenied: getUserMedia rejects with NotAllowedError
export const PermissionDenied: Story = {
  beforeEach: () => {
    const permissionError = new Error('Permission denied');
    permissionError.name = 'NotAllowedError';
    mockGetUserMediaImplementation = fn().mockRejectedValue(permissionError);

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: mockGetUserMediaImplementation,
        },
      });
    }
  },
};

// NoCameraFound: listVideoInputDevices returns empty
export const NoCameraFound: Story = {
  beforeEach: () => {
    mockGetUserMediaImplementation = fn().mockResolvedValue(mockStream);
    mockListVideoInputDevicesImplementation = fn().mockResolvedValue([]); // No cameras
    mockDecodeFromVideoElementImplementation = fn().mockImplementation(() => new Promise(() => {}));

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: mockGetUserMediaImplementation,
        },
      });
    }
  },
};

// Scanning: Simulate active scanning state
export const Scanning: Story = {
  beforeEach: () => {
    mockGetUserMediaImplementation = fn().mockResolvedValue(mockStream);
    mockDecodeFromVideoElementImplementation = fn().mockImplementation(() => new Promise(() => {}));

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: mockGetUserMediaImplementation,
        },
      });
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for the video element to appear
    await canvas.findByTestId('barcodeScanner-video-main');

    // The component should be in scanning state
    expect(canvas.queryByTestId('barcodeScanner-indicator-loading')).not.toBeInTheDocument();
  },
};

// ManualInput: Focus on manual input section
export const ManualInput: Story = {
  beforeEach: () => {
    // Simulate no camera available to force manual input
    const noCameraError = new Error('No camera devices found');
    mockGetUserMediaImplementation = fn().mockRejectedValue(noCameraError);
    mockListVideoInputDevicesImplementation = fn().mockResolvedValue([]);

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: mockGetUserMediaImplementation,
        },
      });
    }
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for error to appear and manual input to be available
    await canvas.findByText(/No camera devices found/);

    // Find manual input field
    const manualInput = canvas.getByTestId('barcodeScanner-input-manual');
    expect(manualInput).toBeInTheDocument();

    // Type a barcode
    await userEvent.type(manualInput, '123456789012');

    // Click submit button
    const submitButton = canvas.getByTestId('barcodeScanner-button-submitManual');
    await userEvent.click(submitButton);

    // Verify onScan was called
    await expect(args.onScan).toHaveBeenCalledWith('123456789012');
  },
};

// Test Barcode Interaction
export const TestBarcodeInteraction: Story = {
  beforeEach: () => {
    mockGetUserMediaImplementation = fn().mockResolvedValue(mockStream);
    mockDecodeFromVideoElementImplementation = fn().mockImplementation(() => new Promise(() => {}));

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: mockGetUserMediaImplementation,
        },
      });
    }
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for the test barcode button to appear
    const testButton = await canvas.findByTestId('barcodeScanner-button-testBarcode');
    expect(testButton).toHaveTextContent('Use Test Food Product (041196912586)');

    // Click the test barcode button
    await userEvent.click(testButton);

    // Verify onScan was called with the test barcode
    await expect(args.onScan).toHaveBeenCalledWith('041196912586');
    await expect(args.onClose).toHaveBeenCalled();
  },
};

// Close Dialog Interaction
export const CloseDialogInteraction: Story = {
  beforeEach: () => {
    mockGetUserMediaImplementation = fn().mockResolvedValue(mockStream);
    mockDecodeFromVideoElementImplementation = fn().mockImplementation(() => new Promise(() => {}));

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: mockGetUserMediaImplementation,
        },
      });
    }
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Wait for the close button to appear
    const closeButton = await canvas.findByTestId('barcodeScanner-button-close');

    // Click the close button
    await userEvent.click(closeButton);

    // Verify onClose was called
    await expect(args.onClose).toHaveBeenCalled();
  },
};
