import {
  TEST_BARCODES,
  validateBarcodeFormat,
  generateRandomTestBarcode,
  createBarcodeDebugReport,
} from '../barcodeTestUtils';

describe('Barcode Test Utils', () => {
  describe('TEST_BARCODES', () => {
    it('should contain valid test barcodes', () => {
      expect(TEST_BARCODES).toBeDefined();
      expect(TEST_BARCODES.length).toBeGreaterThan(0);
      
      const validBarcodes = TEST_BARCODES.filter(b => b.isValid);
      expect(validBarcodes.length).toBeGreaterThan(0);
    });

    it('should have proper structure for each test barcode', () => {
      TEST_BARCODES.forEach(barcode => {
        expect(barcode).toHaveProperty('code');
        expect(barcode).toHaveProperty('format');
        expect(barcode).toHaveProperty('description');
        expect(barcode).toHaveProperty('isValid');
        expect(typeof barcode.code).toBe('string');
        expect(typeof barcode.format).toBe('string');
        expect(typeof barcode.description).toBe('string');
        expect(typeof barcode.isValid).toBe('boolean');
      });
    });
  });

  describe('validateBarcodeFormat', () => {
    it('should validate UPC-A format (12 digits) - food product', () => {
      const result = validateBarcodeFormat('041196912586'); // Coca-Cola
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('UPC-A');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate EAN-13 format (13 digits) - food product', () => {
      const result = validateBarcodeFormat('8901030865354'); // Maggi Noodles
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('EAN-13');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate EAN-8 format (8 digits)', () => {
      const result = validateBarcodeFormat('12345670');
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('EAN-8');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate UPC-E format (6 digits)', () => {
      const result = validateBarcodeFormat('123456');
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('UPC-E');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Code 39/128 format (alphanumeric)', () => {
      const result = validateBarcodeFormat('ABC123');
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('Code 39/128');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty barcode', () => {
      const result = validateBarcodeFormat('');
      expect(result.isValid).toBe(false);
      expect(result.format).toBe(null);
      expect(result.errors).toContain('Barcode cannot be empty');
    });

    it('should reject invalid format', () => {
      const result = validateBarcodeFormat('invalid@#$');
      expect(result.isValid).toBe(false);
      expect(result.format).toBe(null);
      expect(result.errors).toContain('Barcode format not recognized');
    });

    it('should handle whitespace trimming', () => {
      const result = validateBarcodeFormat('  041196912586  ');
      expect(result.isValid).toBe(true);
      expect(result.format).toBe('UPC-A');
    });

    it('should validate real food product barcodes', () => {
      // Test multiple real food product barcodes
      const foodBarcodes = [
        { code: '041196912586', format: 'UPC-A' }, // Coca-Cola
        { code: '028400064057', format: 'UPC-A' }, // Pepsi
        { code: '8901030865354', format: 'EAN-13' }, // Maggi Noodles
      ];

      foodBarcodes.forEach(({ code, format }) => {
        const result = validateBarcodeFormat(code);
        expect(result.isValid).toBe(true);
        expect(result.format).toBe(format);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('generateRandomTestBarcode', () => {
    it('should return a valid test barcode', () => {
      const barcode = generateRandomTestBarcode();
      expect(barcode).toBeDefined();
      expect(barcode.isValid).toBe(true);
      expect(typeof barcode.code).toBe('string');
      expect(typeof barcode.format).toBe('string');
      expect(typeof barcode.description).toBe('string');
    });

    it('should return different barcodes on multiple calls', () => {
      const barcodes = Array.from({ length: 10 }, () => generateRandomTestBarcode());
      const uniqueCodes = new Set(barcodes.map(b => b.code));
      
      // Should have some variety (not all the same)
      // Note: This could theoretically fail due to randomness, but very unlikely
      expect(uniqueCodes.size).toBeGreaterThan(1);
    });
  });

  describe('createBarcodeDebugReport', () => {
    it('should create a debug report with required fields', () => {
      const report = createBarcodeDebugReport();
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('userAgent');
      expect(report).toHaveProperty('platform');
      expect(report).toHaveProperty('mediaDevicesSupported');
      expect(report).toHaveProperty('cameraPermissionStatus');
      expect(report).toHaveProperty('testBarcodes');
      
      expect(typeof report.timestamp).toBe('string');
      expect(typeof report.userAgent).toBe('string');
      expect(typeof report.platform).toBe('string');
      expect(typeof report.mediaDevicesSupported).toBe('boolean');
      expect(typeof report.cameraPermissionStatus).toBe('string');
      expect(Array.isArray(report.testBarcodes)).toBe(true);
    });

    it('should include valid timestamp in ISO format', () => {
      const report = createBarcodeDebugReport();
      const timestamp = new Date(report.timestamp);
      
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should include test barcodes', () => {
      const report = createBarcodeDebugReport();
      
      expect(report.testBarcodes).toEqual(TEST_BARCODES);
    });
  });
});
