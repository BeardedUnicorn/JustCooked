import { describe, test, expect } from '@jest/globals';
import {
  parseIngredients,
  parseAmount,
  normalizeUnit,
  formatIngredientForDisplay,
  formatAmountForDisplay,
  shouldUseEmptyUnit,
  cleanIngredientName,
  detectIngredientCategory
} from '@utils/ingredientUtils';
import { Ingredient } from '@app-types';

describe('ingredientUtils', () => {
  describe('shouldUseEmptyUnit', () => {
    test('should return true for count-based ingredients', () => {
      expect(shouldUseEmptyUnit('eggs')).toBe(true);
      expect(shouldUseEmptyUnit('onion')).toBe(true);
      expect(shouldUseEmptyUnit('apple')).toBe(true);
      expect(shouldUseEmptyUnit('chicken breast')).toBe(true);
    });

    test('should return false for non-count-based ingredients', () => {
      expect(shouldUseEmptyUnit('flour')).toBe(false);
      expect(shouldUseEmptyUnit('milk')).toBe(false);
      expect(shouldUseEmptyUnit('olive oil')).toBe(false);
    });
  });

  describe('parseAmount', () => {
    test('should parse whole numbers', () => {
      expect(parseAmount('2')).toBe(2);
      expect(parseAmount('10')).toBe(10);
    });

    test('should parse decimal numbers', () => {
      expect(parseAmount('1.5')).toBe(1.5);
      expect(parseAmount('0.25')).toBe(0.25);
    });

    test('should parse fractions', () => {
      expect(parseAmount('1/2')).toBe(0.5);
      expect(parseAmount('3/4')).toBe(0.75);
      expect(parseAmount('1/3')).toBeCloseTo(0.333, 2);
    });

    test('should parse mixed numbers', () => {
      expect(parseAmount('1 1/2')).toBe(1.5);
      expect(parseAmount('2 3/4')).toBe(2.75);
    });

    test('should parse unicode fractions', () => {
      expect(parseAmount('½')).toBe(0.5);
      expect(parseAmount('¼')).toBe(0.25);
      expect(parseAmount('¾')).toBe(0.75);
      expect(parseAmount('1½')).toBe(1.5);
    });

    test('should parse ranges', () => {
      expect(parseAmount('2-3')).toBe(2.5);
      expect(parseAmount('1 to 2')).toBe(1.5);
    });

    test('should handle invalid input', () => {
      expect(parseAmount('')).toBe(1);
      expect(parseAmount('invalid')).toBe(1);
    });
  });

  describe('normalizeUnit', () => {
    test('should normalize volume units', () => {
      expect(normalizeUnit('cups')).toBe('cup');
      expect(normalizeUnit('tablespoons')).toBe('tbsp');
      expect(normalizeUnit('teaspoons')).toBe('tsp');
      expect(normalizeUnit('fluid ounces')).toBe('fl oz');
    });

    test('should normalize weight units', () => {
      expect(normalizeUnit('pounds')).toBe('lb');
      expect(normalizeUnit('ounces')).toBe('oz');
      expect(normalizeUnit('grams')).toBe('g');
      expect(normalizeUnit('kilograms')).toBe('kg');
    });

    test('should handle unknown units', () => {
      expect(normalizeUnit('unknown')).toBe('unknown');
      expect(normalizeUnit('custom-unit')).toBe('custom-unit');
    });

    test('should be case insensitive', () => {
      expect(normalizeUnit('CUPS')).toBe('cup');
      expect(normalizeUnit('Tablespoons')).toBe('tbsp');
    });
  });

  describe('formatAmountForDisplay', () => {
    test('should format whole numbers', () => {
      expect(formatAmountForDisplay(1)).toBe('1');
      expect(formatAmountForDisplay(2)).toBe('2');
      expect(formatAmountForDisplay(10)).toBe('10');
    });

    test('should format common fractions', () => {
      expect(formatAmountForDisplay(0.5)).toBe('1/2');
      expect(formatAmountForDisplay(0.25)).toBe('1/4');
      expect(formatAmountForDisplay(0.75)).toBe('3/4');
      expect(formatAmountForDisplay(0.125)).toBe('1/8');
    });

    test('should format mixed numbers', () => {
      expect(formatAmountForDisplay(1.5)).toBe('1 1/2');
      expect(formatAmountForDisplay(2.25)).toBe('2 1/4');
      expect(formatAmountForDisplay(3.75)).toBe('3 3/4');
    });

    test('should handle floating point precision issues', () => {
      expect(formatAmountForDisplay(0.1 + 0.2)).toBe('0.3');
      expect(formatAmountForDisplay(1/3)).toBe('1/3');
      expect(formatAmountForDisplay(2/3)).toBe('2/3');
    });

    test('should fallback to decimal for complex fractions', () => {
      expect(formatAmountForDisplay(0.123)).toBe('1/8'); // 0.123 is close to 1/8 (0.125)
      expect(formatAmountForDisplay(1.789)).toBe('1 11/14'); // 1.789 is close to 1 11/14
    });
  });

  describe('formatIngredientForDisplay', () => {
    test('should format ingredients with units correctly', () => {
      const ingredient: Ingredient = { amount: 2, unit: 'cups', name: 'flour' };
      expect(formatIngredientForDisplay(ingredient)).toBe('2 cups flour');
    });

    test('should format ingredients without units correctly (no extra space)', () => {
      const ingredient: Ingredient = { amount: 3, unit: '', name: 'eggs' };
      expect(formatIngredientForDisplay(ingredient)).toBe('3 eggs');
    });

    test('should format ingredients with empty unit string correctly', () => {
      const ingredient: Ingredient = { amount: 1, unit: '   ', name: 'onion' };
      expect(formatIngredientForDisplay(ingredient)).toBe('1 onion');
    });

    test('should format fractional amounts correctly', () => {
      const ingredient: Ingredient = { amount: 0.5, unit: 'cup', name: 'milk' };
      expect(formatIngredientForDisplay(ingredient)).toBe('1/2 cup milk');
    });

    test('should format fractional amounts without units correctly', () => {
      const ingredient: Ingredient = { amount: 2.5, unit: '', name: 'apples' };
      expect(formatIngredientForDisplay(ingredient)).toBe('2 1/2 apples');
    });

    test('should handle mixed numbers with units', () => {
      const ingredient: Ingredient = { amount: 1.25, unit: 'tbsp', name: 'olive oil' };
      expect(formatIngredientForDisplay(ingredient)).toBe('1 1/4 tbsp olive oil');
    });

    test('should handle zero amounts', () => {
      const ingredient: Ingredient = { amount: 0, unit: 'tsp', name: 'salt' };
      expect(formatIngredientForDisplay(ingredient)).toBe('salt');
    });

    test('should handle negative amounts', () => {
      const ingredient: Ingredient = { amount: -1, unit: 'cup', name: 'water' };
      expect(formatIngredientForDisplay(ingredient)).toBe('water');
    });

    test('should handle very small fractions', () => {
      const ingredient: Ingredient = { amount: 0.125, unit: 'tsp', name: 'vanilla extract' };
      expect(formatIngredientForDisplay(ingredient)).toBe('1/8 tsp vanilla extract');
    });

    test('should handle common fractions', () => {
      const testCases = [
        { amount: 0.25, expected: '1/4' },
        { amount: 0.33, expected: '1/3' },
        { amount: 0.67, expected: '2/3' },
        { amount: 0.75, expected: '3/4' },
        { amount: 1.5, expected: '1 1/2' },
        { amount: 2.25, expected: '2 1/4' },
        { amount: 3.33, expected: '3 1/3' },
      ];

      testCases.forEach(({ amount, expected }) => {
        const ingredient: Ingredient = { amount, unit: 'cups', name: 'flour' };
        expect(formatIngredientForDisplay(ingredient)).toBe(`${expected} cups flour`);
      });
    });

    test('should handle ingredients with special characters', () => {
      const ingredient: Ingredient = { amount: 1, unit: 'cup', name: 'café au lait' };
      expect(formatIngredientForDisplay(ingredient)).toBe('1 cup café au lait');
    });

    test('should handle ingredients with parentheses', () => {
      const ingredient: Ingredient = { amount: 1, unit: 'can', name: 'tomatoes (diced)' };
      expect(formatIngredientForDisplay(ingredient)).toBe('1 can tomatoes (diced)');
    });

    test('should trim whitespace from names and units', () => {
      const ingredient: Ingredient = { amount: 2, unit: '  cups  ', name: '  flour  ' };
      expect(formatIngredientForDisplay(ingredient)).toBe('2 cups flour');
    });

    test('should handle empty ingredient names', () => {
      const ingredient: Ingredient = { amount: 1, unit: 'cup', name: '' };
      expect(formatIngredientForDisplay(ingredient)).toBe('1 cup');
    });

    test('should handle large amounts', () => {
      const ingredient: Ingredient = { amount: 1000, unit: 'ml', name: 'water' };
      expect(formatIngredientForDisplay(ingredient)).toBe('1000 ml water');
    });

    test('should handle floating point precision issues', () => {
      const ingredient: Ingredient = { amount: 0.1 + 0.2, unit: 'tsp', name: 'vanilla' };
      expect(formatIngredientForDisplay(ingredient)).toBe('0.3 tsp vanilla');
    });

    test('should handle unicode characters', () => {
      const ingredient: Ingredient = { amount: 2, unit: 'whole', name: 'jalapeño peppers' };
      expect(formatIngredientForDisplay(ingredient)).toBe('2 whole jalapeño peppers');
    });
  });

  describe('cleanIngredientName', () => {
    test('should remove preparation instructions', () => {
      expect(cleanIngredientName('onion, diced')).toBe('onion');
      expect(cleanIngredientName('garlic, minced')).toBe('garlic');
      expect(cleanIngredientName('tomatoes, chopped and seeded')).toBe('tomatoes');
    });

    test('should remove parenthetical content', () => {
      expect(cleanIngredientName('tomatoes (14.5 oz can)')).toBe('tomatoes');
      expect(cleanIngredientName('cheese (shredded)')).toBe('cheese');
    });

    test('should handle empty results', () => {
      expect(cleanIngredientName('(just parentheses)')).toBe('(just parentheses)');
      expect(cleanIngredientName('')).toBe('');
    });

    test('should preserve original if cleaning results in empty string', () => {
      const original = ', diced';
      expect(cleanIngredientName(original)).toBe(original);
    });
  });

  describe('detectIngredientCategory', () => {
    test('should detect vegetable category', () => {
      const result = detectIngredientCategory('onion');
      expect(result.id).toBe('vegetables');
    });

    test('should detect fruit category', () => {
      const result = detectIngredientCategory('apple');
      expect(result.id).toBe('fruits');
    });

    test('should detect meat category', () => {
      const result = detectIngredientCategory('chicken');
      expect(result.id).toBe('meat');
    });

    test('should detect dairy category', () => {
      const result = detectIngredientCategory('milk');
      expect(result.id).toBe('dairy');
    });

    test('should default to other category for unknown ingredients', () => {
      const result = detectIngredientCategory('unknown-ingredient');
      expect(result.id).toBe('other');
    });

    test('should be case insensitive', () => {
      const result = detectIngredientCategory('CHICKEN');
      expect(result.id).toBe('meat');
    });
  });

  describe('parseIngredients', () => {
    test('should parse simple ingredients', () => {
      const result = parseIngredients(['2 cups flour', '1 tsp salt']);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'flour', amount: 2, unit: 'cup' });
      expect(result[1]).toEqual({ name: 'salt', amount: 1, unit: 'tsp' });
    });

    test('should handle complex ingredient formats', () => {
      const result = parseIngredients([
        '1 1/2 tablespoons olive oil',
        '¼ cup milk',
        '2-3 cloves garlic',
        '1 (15 oz) can tomatoes'
      ]);
      
      expect(result[0]).toEqual({ name: 'olive oil', amount: 1.5, unit: 'tbsp' });
      expect(result[1]).toEqual({ name: 'milk', amount: 0.25, unit: 'cup' });
      expect(result[2]).toEqual({ name: 'garlic', amount: 2.5, unit: 'clove' });
      expect(result[3]).toEqual({ name: 'tomatoes', amount: 1, unit: 'can' });
    });

    test('should handle ingredients with preparation instructions', () => {
      const result = parseIngredients(['2 cups flour, sifted', '1 onion, diced']);
      expect(result[0]).toEqual({ name: 'flour, sifted', amount: 2, unit: 'cup' });
      expect(result[1]).toEqual({ name: 'onion, diced', amount: 1, unit: '' });
    });

    test('should handle count-based ingredients without units', () => {
      const result = parseIngredients(['3 eggs', '2 apples']);
      expect(result[0]).toEqual({ name: 'eggs', amount: 3, unit: '' });
      expect(result[1]).toEqual({ name: 'apples', amount: 2, unit: '' });
    });

    test('should handle malformed input gracefully', () => {
      const result = parseIngredients(['just text', '', '   ']);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ name: 'just text', amount: 1, unit: 'unit' });
      expect(result[1]).toEqual({ name: '', amount: 1, unit: 'unit' });
      expect(result[2]).toEqual({ name: '', amount: 1, unit: 'unit' });
    });
  });
});
