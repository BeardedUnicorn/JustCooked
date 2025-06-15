/**
 * Barcode Scanner Testing and Debugging Utilities
 * 
 * This module provides utilities for testing and debugging the barcode scanner functionality.
 * It includes test barcodes, validation functions, and debugging helpers.
 */

export interface BarcodeTestCase {
  code: string;
  format: string;
  description: string;
  isValid: boolean;
}

/**
 * Common test barcodes for food products and other formats
 */
export const TEST_BARCODES: BarcodeTestCase[] = [
  // Real Food Product UPC-A codes (12 digits)
  {
    code: '041196912586',
    format: 'UPC-A',
    description: 'Coca-Cola 12oz Can',
    isValid: true,
  },
  {
    code: '028400064057',
    format: 'UPC-A',
    description: 'Pepsi 12oz Can',
    isValid: true,
  },
  {
    code: '016000275270',
    format: 'UPC-A',
    description: 'Cheerios Cereal',
    isValid: true,
  },
  {
    code: '072250011501',
    format: 'UPC-A',
    description: 'Heinz Ketchup',
    isValid: true,
  },

  // Real Food Product EAN-13 codes (13 digits)
  {
    code: '8901030865354',
    format: 'EAN-13',
    description: 'Maggi Noodles (International)',
    isValid: true,
  },
  {
    code: '7622210951965',
    format: 'EAN-13',
    description: 'Oreo Cookies (International)',
    isValid: true,
  },
  
  // Food Product EAN-8 codes (8 digits) - used on small packages
  {
    code: '20123457',
    format: 'EAN-8',
    description: 'Small food package EAN-8',
    isValid: true,
  },

  // Food Product UPC-E codes (6 digits) - compressed UPC for small items
  {
    code: '012345',
    format: 'UPC-E',
    description: 'Small food item UPC-E',
    isValid: true,
  },
  
  // Code 128
  {
    code: 'ABC123',
    format: 'Code 128',
    description: 'Alphanumeric Code 128',
    isValid: true,
  },
  
  // Code 39
  {
    code: 'TEST123',
    format: 'Code 39',
    description: 'Alphanumeric Code 39',
    isValid: true,
  },
  
  // Invalid barcodes for testing error handling
  {
    code: '123',
    format: 'Invalid',
    description: 'Too short to be valid',
    isValid: false,
  },
  {
    code: 'abc',
    format: 'Invalid',
    description: 'Non-numeric for UPC/EAN',
    isValid: false,
  },
];

/**
 * Validates if a barcode string is potentially valid
 */
export function validateBarcodeFormat(code: string): {
  isValid: boolean;
  format: string | null;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!code || code.trim().length === 0) {
    errors.push('Barcode cannot be empty');
    return { isValid: false, format: null, errors };
  }
  
  const trimmedCode = code.trim();
  
  // Check for common formats
  if (/^\d{12}$/.test(trimmedCode)) {
    return { isValid: true, format: 'UPC-A', errors: [] };
  }
  
  if (/^\d{13}$/.test(trimmedCode)) {
    return { isValid: true, format: 'EAN-13', errors: [] };
  }
  
  if (/^\d{8}$/.test(trimmedCode)) {
    return { isValid: true, format: 'EAN-8', errors: [] };
  }
  
  if (/^\d{6}$/.test(trimmedCode)) {
    return { isValid: true, format: 'UPC-E', errors: [] };
  }
  
  if (/^[A-Z0-9\-\.\s\$\/\+\%]+$/i.test(trimmedCode)) {
    return { isValid: true, format: 'Code 39/128', errors: [] };
  }
  
  errors.push('Barcode format not recognized');
  return { isValid: false, format: null, errors };
}

/**
 * Generates a random valid test barcode
 */
export function generateRandomTestBarcode(): BarcodeTestCase {
  const validBarcodes = TEST_BARCODES.filter(b => b.isValid);
  const randomIndex = Math.floor(Math.random() * validBarcodes.length);
  return validBarcodes[randomIndex];
}

/**
 * Food product barcode scanning tips
 */
export const FOOD_BARCODE_SCANNING_TIPS = [
  'Hold the product steady and ensure the barcode is flat',
  'Use good lighting - avoid shadows on the barcode',
  'Keep the camera 4-8 inches away from the barcode',
  'Make sure the entire barcode is visible in the camera view',
  'Clean the camera lens if scanning is poor',
  'Try different angles if the barcode is on a curved surface',
  'For shiny packages, tilt slightly to reduce glare',
  'Most food products use UPC-A (12 digits) or EAN-13 (13 digits)',
];

/**
 * Creates a debug report for barcode scanner issues
 */
export function createBarcodeDebugReport(): {
  timestamp: string;
  userAgent: string;
  platform: string;
  mediaDevicesSupported: boolean;
  cameraPermissionStatus: string;
  testBarcodes: BarcodeTestCase[];
  scanningTips: string[];
} {
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    mediaDevicesSupported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    cameraPermissionStatus: 'unknown', // Would need to be checked separately
    testBarcodes: TEST_BARCODES,
    scanningTips: FOOD_BARCODE_SCANNING_TIPS,
  };
}

/**
 * Logs barcode scanner performance metrics
 */
export function logScannerPerformance(metrics: {
  scanAttempts: number;
  scanDuration: number;
  successfulScans: number;
  errors: string[];
}): void {
  console.group('🔍 Barcode Scanner Performance');
  console.log('Scan Attempts:', metrics.scanAttempts);
  console.log('Scan Duration:', `${metrics.scanDuration}ms`);
  console.log('Success Rate:', `${((metrics.successfulScans / metrics.scanAttempts) * 100).toFixed(1)}%`);
  console.log('Errors:', metrics.errors);
  console.groupEnd();
}

/**
 * Tests camera access and reports issues
 */
export async function testCameraAccess(): Promise<{
  success: boolean;
  error?: string;
  deviceCount: number;
  devices: MediaDeviceInfo[];
}> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        success: false,
        error: 'MediaDevices API not supported',
        deviceCount: 0,
        devices: [],
      };
    }
    
    // Get available devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    // Test camera access
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    
    // Clean up
    stream.getTracks().forEach(track => track.stop());
    
    return {
      success: true,
      deviceCount: videoDevices.length,
      devices: videoDevices,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      deviceCount: 0,
      devices: [],
    };
  }
}
