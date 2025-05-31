import { describe, test, expect } from '@jest/globals';
import {
  scaleIngredients,
  scaleAmount,
  getServingSizeOptions,
  isValidServingSize,
  getScalingDescription,
} from '@utils/servingUtils';
import { mockIngredients } from '@/__tests__/fixtures/recipes';

describe('servingUtils', () => {
  describe('scaleAmount', () => {
    test('should scale amounts correctly', () => {
      expect(scaleAmount(2, 2)).toBe(4); // Double recipe
      expect(scaleAmount(4, 0.5)).toBe(2); // Half recipe
      expect(scaleAmount(1, 1.5)).toBe(1.5); // 1.5x recipe
    });

    test('should handle precision for small amounts', () => {
      expect(scaleAmount(0.125, 2)).toBe(0.25); // 1/8 cup doubled
      expect(scaleAmount(0.25, 0.5)).toBe(0.13); // 1/4 cup halved (rounded to 2 decimals)
      expect(scaleAmount(0.001, 2)).toBe(0.002); // Very small amounts (3 decimals)
    });

    test('should handle precision for medium amounts', () => {
      expect(scaleAmount(1.5, 2)).toBe(3); // 1.5 doubled
      expect(scaleAmount(2.3, 1.5)).toBe(3.5); // Rounded to 1 decimal
    });

    test('should handle precision for large amounts', () => {
      expect(scaleAmount(12, 1.3)).toBe(15.5); // Rounded to nearest 0.25
      expect(scaleAmount(8, 1.6)).toBe(12.75); // Rounded to nearest 0.25
    });

    test('should handle edge cases', () => {
      expect(scaleAmount(0, 2)).toBe(0); // Zero amount
      expect(scaleAmount(-1, 2)).toBe(-1); // Negative amount (return original)
      expect(scaleAmount(2, 0)).toBe(0); // Zero scaling factor (2 * 0 = 0)
    });
  });

  describe('scaleIngredients', () => {
    test('should scale all ingredients correctly', () => {
      const scaled = scaleIngredients(mockIngredients, 4, 8); // Double recipe
      
      expect(scaled).toHaveLength(mockIngredients.length);
      expect(scaled[0]).toEqual({ name: 'flour', amount: 4, unit: 'cups' }); // 2 * 2 = 4
      expect(scaled[1]).toEqual({ name: 'sugar', amount: 2, unit: 'cup' }); // 1 * 2 = 2
      expect(scaled[2]).toEqual({ name: 'eggs', amount: 6, unit: '' }); // 3 * 2 = 6
    });

    test('should handle half recipe scaling', () => {
      const scaled = scaleIngredients(mockIngredients, 4, 2); // Half recipe
      
      expect(scaled[0]).toEqual({ name: 'flour', amount: 1, unit: 'cups' }); // 2 * 0.5 = 1
      expect(scaled[1]).toEqual({ name: 'sugar', amount: 0.5, unit: 'cup' }); // 1 * 0.5 = 0.5
      expect(scaled[2]).toEqual({ name: 'eggs', amount: 1.5, unit: '' }); // 3 * 0.5 = 1.5
    });

    test('should handle edge cases', () => {
      // Invalid servings - should return original
      expect(scaleIngredients(mockIngredients, 0, 4)).toEqual(mockIngredients);
      expect(scaleIngredients(mockIngredients, 4, 0)).toEqual(mockIngredients);
      expect(scaleIngredients(mockIngredients, -1, 4)).toEqual(mockIngredients);
    });

    test('should preserve ingredient properties except amount', () => {
      const scaled = scaleIngredients(mockIngredients, 2, 4);
      
      scaled.forEach((ingredient, index) => {
        expect(ingredient.name).toBe(mockIngredients[index].name);
        expect(ingredient.unit).toBe(mockIngredients[index].unit);
        // Amount should be different (scaled)
        expect(ingredient.amount).not.toBe(mockIngredients[index].amount);
      });
    });
  });

  describe('getServingSizeOptions', () => {
    test('should generate reasonable options for typical serving sizes', () => {
      const options = getServingSizeOptions(4);
      
      expect(options).toContain(1); // Common sizes
      expect(options).toContain(2);
      expect(options).toContain(4); // Original
      expect(options).toContain(6);
      expect(options).toContain(8);
      expect(options).toContain(12);
      
      // Should include multiples of original
      expect(options).toContain(2); // 0.5x
      expect(options).toContain(6); // 1.5x
      expect(options).toContain(8); // 2x
    });

    test('should handle edge cases', () => {
      expect(getServingSizeOptions(0)).toEqual([1, 2, 4, 6, 8, 10, 12]);
      expect(getServingSizeOptions(-1)).toEqual([1, 2, 4, 6, 8, 10, 12]);
    });

    test('should return sorted unique values', () => {
      const options = getServingSizeOptions(6);
      
      // Check if sorted
      for (let i = 1; i < options.length; i++) {
        expect(options[i]).toBeGreaterThan(options[i - 1]);
      }
      
      // Check for uniqueness
      const uniqueOptions = [...new Set(options)];
      expect(options).toEqual(uniqueOptions);
    });
  });

  describe('isValidServingSize', () => {
    test('should validate reasonable serving sizes', () => {
      expect(isValidServingSize(1)).toBe(true);
      expect(isValidServingSize(4)).toBe(true);
      expect(isValidServingSize(12)).toBe(true);
      expect(isValidServingSize(50)).toBe(true);
      expect(isValidServingSize(100)).toBe(true);
    });

    test('should reject invalid serving sizes', () => {
      expect(isValidServingSize(0)).toBe(false);
      expect(isValidServingSize(-1)).toBe(false);
      expect(isValidServingSize(101)).toBe(false);
      expect(isValidServingSize(Infinity)).toBe(false);
      expect(isValidServingSize(NaN)).toBe(false);
    });

    test('should handle decimal serving sizes', () => {
      expect(isValidServingSize(2.5)).toBe(true);
      expect(isValidServingSize(0.5)).toBe(true);
    });
  });

  describe('getScalingDescription', () => {
    test('should provide descriptive scaling messages', () => {
      expect(getScalingDescription(4, 4)).toBe('Original recipe');
      expect(getScalingDescription(4, 2)).toBe('Half recipe');
      expect(getScalingDescription(4, 8)).toBe('Double recipe');
      expect(getScalingDescription(4, 12)).toBe('Triple recipe');
    });

    test('should handle fractional scaling', () => {
      expect(getScalingDescription(4, 3)).toBe('75% of original');
      expect(getScalingDescription(8, 6)).toBe('75% of original');
      expect(getScalingDescription(4, 1)).toBe('25% of original');
    });

    test('should handle larger scaling factors', () => {
      expect(getScalingDescription(2, 7)).toBe('3.5x original');
      expect(getScalingDescription(3, 15)).toBe('5.0x original');
    });

    test('should handle edge cases', () => {
      expect(getScalingDescription(0, 4)).toBe('');
      expect(getScalingDescription(4, 0)).toBe('');
      expect(getScalingDescription(-1, 4)).toBe('');
    });
  });
});
