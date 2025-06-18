import { describe, test, expect } from 'vitest';
import {
  parseIngredients,
  parseIngredient,
  parseAmount,
  normalizeUnit,
  formatIngredientForDisplay,
  formatAmountForDisplay,
  shouldUseEmptyUnit,
  cleanIngredientName,
  detectIngredientCategory,
  separatePreparationFromName,
  shouldIncludePreparation
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
      expect(cleanIngredientName('onion, finely chopped')).toBe('onion');
      expect(cleanIngredientName('butter, melted')).toBe('butter');
      expect(cleanIngredientName('butter, softened')).toBe('butter');
    });

    test('should handle "divided" indicators', () => {
      expect(cleanIngredientName('salt, divided')).toBe('salt');
      expect(cleanIngredientName('Sugar, divided')).toBe('Sugar');
      expect(cleanIngredientName('olive oil, divided')).toBe('olive oil');
    });

    test('should handle "or" alternatives', () => {
      expect(cleanIngredientName('ground beef or turkey')).toBe('ground beef');
      expect(cleanIngredientName('yellow mustard, or to taste')).toBe('yellow mustard');
      expect(cleanIngredientName('chicken or beef broth')).toBe('chicken');
    });

    test('should handle "to taste" indicators', () => {
      expect(cleanIngredientName('salt to taste')).toBe('salt');
      expect(cleanIngredientName('pepper, to taste')).toBe('pepper');
      expect(cleanIngredientName('yellow mustard, or to taste')).toBe('yellow mustard');
    });

    test('should handle "and" combinations with "to taste"', () => {
      expect(cleanIngredientName('salt and ground black pepper to taste')).toBe('salt');
      expect(cleanIngredientName('salt and pepper to taste')).toBe('salt');
    });

    test('should handle standalone preparation words', () => {
      expect(cleanIngredientName('chopped onion')).toBe('onion');
      expect(cleanIngredientName('diced tomatoes')).toBe('tomatoes');
      expect(cleanIngredientName('melted butter')).toBe('butter');
      expect(cleanIngredientName('softened cream cheese')).toBe('cream cheese');
      expect(cleanIngredientName('fresh basil')).toBe('basil');
      expect(cleanIngredientName('dried oregano')).toBe('oregano');
    });

    test('should preserve "ground" in meat types', () => {
      expect(cleanIngredientName('ground beef')).toBe('ground beef');
      expect(cleanIngredientName('ground turkey')).toBe('ground turkey');
      expect(cleanIngredientName('ground chicken')).toBe('ground chicken');
      expect(cleanIngredientName('ground pork')).toBe('ground pork');
      expect(cleanIngredientName('ground lamb')).toBe('ground lamb');
    });

    test('should handle "Optional" prefix', () => {
      expect(cleanIngredientName('Optional chopped dill pickles and lettuce')).toBe('dill pickles');
      expect(cleanIngredientName('optional fresh herbs')).toBe('herbs');
    });

    test('should handle complex "and" combinations', () => {
      expect(cleanIngredientName('chopped dill pickles and lettuce')).toBe('dill pickles');
      expect(cleanIngredientName('diced onions and peppers')).toBe('onions');
      expect(cleanIngredientName('sliced mushrooms and zucchini')).toBe('mushrooms');
    });

    test('should handle "split" preparation', () => {
      expect(cleanIngredientName('buns, split')).toBe('buns');
      expect(cleanIngredientName('rolls, split and toasted')).toBe('rolls');
    });

    test('should remove parenthetical content', () => {
      expect(cleanIngredientName('tomatoes (14.5 oz can)')).toBe('tomatoes');
      expect(cleanIngredientName('cheese (shredded)')).toBe('cheese');
      expect(cleanIngredientName('butter (room temperature)')).toBe('butter');
    });

    test('should handle complex real-world examples', () => {
      expect(cleanIngredientName('salt, divided')).toBe('salt');
      expect(cleanIngredientName('ground beef or turkey')).toBe('ground beef');
      expect(cleanIngredientName('onion, finely chopped')).toBe('onion');
      expect(cleanIngredientName('butter, melted')).toBe('butter');
      expect(cleanIngredientName('butter, softened')).toBe('butter');
      expect(cleanIngredientName('chopped onion')).toBe('onion');
      expect(cleanIngredientName('yellow mustard, or to taste')).toBe('yellow mustard');
      expect(cleanIngredientName('salt and ground black pepper to taste')).toBe('salt');
      expect(cleanIngredientName('buns, split')).toBe('buns');
      expect(cleanIngredientName('Optional chopped dill pickles and lettuce')).toBe('dill pickles');
    });

    test('should handle edge cases', () => {
      expect(cleanIngredientName('(just parentheses)')).toBe('(just parentheses)');
      expect(cleanIngredientName('')).toBe('');
      expect(cleanIngredientName('   ')).toBe('');
    });

    test('should preserve original if cleaning results in empty string', () => {
      const original = ', diced';
      expect(cleanIngredientName(original)).toBe(original);
    });

    test('should handle multiple spaces and trim properly', () => {
      expect(cleanIngredientName('  onion,   finely   chopped  ')).toBe('onion');
      expect(cleanIngredientName('ground   beef   or   turkey')).toBe('ground beef');
    });

    test('should be case insensitive for keywords', () => {
      expect(cleanIngredientName('SALT, DIVIDED')).toBe('SALT');
      expect(cleanIngredientName('Onion, Finely Chopped')).toBe('Onion');
      expect(cleanIngredientName('GROUND BEEF OR TURKEY')).toBe('GROUND BEEF');
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
      expect(result[3]).toEqual({ name: 'tomatoes', amount: 1, unit: 'oz' });
    });

    test('should handle ingredients with preparation instructions', () => {
      const result = parseIngredients(['2 cups flour, sifted', '1 onion, diced']);
      expect(result[0]).toEqual({ name: 'flour', amount: 2, unit: 'cup' });
      expect(result[1]).toEqual({ name: 'onion', amount: 1, unit: '' });
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

    test('should handle malformed "ounce) package" patterns', () => {
      const result = parseIngredients([
        'ounce) package cream cheese, softened',
        'ounce) can tomato sauce',
        'ounce) packages cream cheese, softened'
      ]);

      expect(result[0]).toEqual({ name: 'cream cheese', amount: 1, unit: 'package' });
      expect(result[1]).toEqual({ name: 'tomato sauce', amount: 1, unit: 'can' });
      expect(result[2]).toEqual({ name: 'cream cheese', amount: 1, unit: 'package' });
    });

    test('should handle parenthetical amounts without leading numbers', () => {
      const result = parseIngredients([
        '(15 oz) can black beans',
        '(8 oz) package cream cheese',
        '(14.5 oz) can diced tomatoes'
      ]);

      expect(result[0]).toEqual({ name: 'black beans', amount: 15, unit: 'oz' });
      expect(result[1]).toEqual({ name: 'cream cheese', amount: 8, unit: 'oz' });
      expect(result[2]).toEqual({ name: 'diced tomatoes', amount: 14.5, unit: 'oz' });
    });

    test('should separate preparation methods correctly', () => {
      const result = parseIngredients([
        'garlic, minced',
        'butter, melted',
        'onion, chopped',
        'tomatoes, diced',
        'cheese, shredded'
      ]);

      expect(result[0]).toEqual({ name: 'garlic', amount: 1, unit: '' });
      expect(result[1]).toEqual({ name: 'butter', amount: 1, unit: 'unit' });
      expect(result[2]).toEqual({ name: 'onion', amount: 1, unit: '' });
      expect(result[3]).toEqual({ name: 'tomatoes', amount: 1, unit: '' });
      expect(result[4]).toEqual({ name: 'cheese', amount: 1, unit: 'unit' });
    });

    test('should preserve essential preparations', () => {
      const result = parseIngredients([
        'ground beef',
        'ground turkey',
        'smoked salmon',
        'roasted peppers'
      ]);

      expect(result[0]).toEqual({ name: 'ground beef', amount: 1, unit: 'unit' });
      expect(result[1]).toEqual({ name: 'ground turkey', amount: 1, unit: 'unit' });
      expect(result[2]).toEqual({ name: 'smoked salmon', amount: 1, unit: 'unit' });
      expect(result[3]).toEqual({ name: 'roasted peppers', amount: 1, unit: 'unit' });
    });
  });

  describe('parseIngredient', () => {
    test('should handle complex malformed patterns from CSV data', () => {
      // Test cases based on actual problematic entries from ingredient_counts.csv
      const testCases = [
        {
          input: 'ounce) package cream cheese, softened',
          expected: { name: 'cream cheese', amount: 1, unit: 'package' }
        },
        {
          input: 'garlic, minced',
          expected: { name: 'garlic', amount: 1, unit: '' }
        },
        {
          input: 'butter, melted',
          expected: { name: 'butter', amount: 1, unit: 'unit' }
        },
        {
          input: '1 (15 oz) can tomatoes',
          expected: { name: 'tomatoes', amount: 1, unit: 'oz' }
        },
        {
          input: '(8 oz) package cream cheese',
          expected: { name: 'cream cheese', amount: 8, unit: 'oz' }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parseIngredient(input);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('separatePreparationFromName', () => {
    test('should separate comma-separated preparations', () => {
      const testCases = [
        { input: 'garlic, minced', expected: { ingredient: 'garlic', preparation: 'minced' } },
        { input: 'butter, melted', expected: { ingredient: 'butter', preparation: 'melted' } },
        { input: 'onion, finely chopped', expected: { ingredient: 'onion', preparation: 'finely chopped' } },
        { input: 'tomatoes, diced and drained', expected: { ingredient: 'tomatoes', preparation: 'diced and drained' } },
        { input: 'cheese, shredded', expected: { ingredient: 'cheese', preparation: 'shredded' } }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = separatePreparationFromName(input);
        expect(result).toEqual(expected);
      });
    });

    test('should handle standalone preparation words', () => {
      const testCases = [
        { input: 'chopped onion', expected: { ingredient: 'onion', preparation: 'chopped' } },
        { input: 'melted butter', expected: { ingredient: 'butter', preparation: 'melted' } },
        { input: 'fresh basil', expected: { ingredient: 'fresh basil', preparation: '' } }, // Keep fresh with herbs
        { input: 'dried oregano', expected: { ingredient: 'oregano', preparation: 'dried' } }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = separatePreparationFromName(input);
        expect(result).toEqual(expected);
      });
    });

    test('should preserve ground meat types', () => {
      const testCases = [
        { input: 'ground beef', expected: { ingredient: 'ground beef', preparation: '' } },
        { input: 'ground turkey', expected: { ingredient: 'ground turkey', preparation: '' } },
        { input: 'ground chicken', expected: { ingredient: 'ground chicken', preparation: '' } }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = separatePreparationFromName(input);
        expect(result).toEqual(expected);
      });
    });

    test('should handle complex preparation patterns', () => {
      const testCases = [
        { input: 'cream cheese, softened', expected: { ingredient: 'cream cheese', preparation: 'softened' } },
        { input: 'black beans, rinsed and drained', expected: { ingredient: 'black beans', preparation: 'rinsed and drained' } },
        { input: 'butter, at room temperature', expected: { ingredient: 'butter', preparation: 'at room temperature' } }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = separatePreparationFromName(input);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('shouldIncludePreparation', () => {
    test('should include essential preparations', () => {
      expect(shouldIncludePreparation('beef', 'ground')).toBe(true);
      expect(shouldIncludePreparation('salmon', 'smoked')).toBe(true);
      expect(shouldIncludePreparation('peppers', 'roasted')).toBe(true);
      expect(shouldIncludePreparation('vanilla', 'extract')).toBe(true);
    });

    test('should exclude non-essential preparations', () => {
      expect(shouldIncludePreparation('onion', 'chopped')).toBe(false);
      expect(shouldIncludePreparation('butter', 'melted')).toBe(false);
      expect(shouldIncludePreparation('garlic', 'minced')).toBe(false);
      expect(shouldIncludePreparation('cheese', 'shredded')).toBe(false);
    });

    test('should handle empty preparation', () => {
      expect(shouldIncludePreparation('onion', '')).toBe(false);
      expect(shouldIncludePreparation('garlic', undefined as any)).toBe(false);
    });
  });

  describe('Edge cases and regression tests', () => {
    test('should handle problematic CSV entries', () => {
      // Test cases based on actual problematic entries from ingredient_counts.csv
      const problematicEntries = [
        'ounce) package cream cheese, softened',
        'ounce) packages cream cheese, softened',
        'ounce) can tomato sauce',
        'ounce) container frozen whipped topping, thawed',
        'garlic, minced',
        'butter, melted',
        'onion, chopped',
        'eggs, beaten',
        'tomatoes, diced'
      ];

      problematicEntries.forEach(entry => {
        const result = parseIngredient(entry);

        // Should not have empty name
        expect(result.name).toBeTruthy();
        expect(result.name.trim()).not.toBe('');

        // Should have valid amount
        expect(result.amount).toBeGreaterThan(0);
        expect(typeof result.amount).toBe('number');

        // Should have valid unit (can be empty string)
        expect(typeof result.unit).toBe('string');

        // Name should not contain preparation methods unless essential
        if (result.name.includes(',')) {
          // If comma is present, it should be an essential preparation
          const parts = result.name.split(',');
          const preparation = parts[1]?.trim();
          expect(shouldIncludePreparation(parts[0].trim(), preparation)).toBe(true);
        }
      });
    });

    test('should handle empty and invalid inputs', () => {
      const invalidInputs = ['', '   ', null, undefined];

      invalidInputs.forEach(input => {
        const result = parseIngredient(input as any);
        expect(result).toEqual({ name: '', amount: 1, unit: 'unit' });
      });
    });

    test('should handle numeric-only inputs', () => {
      const numericInputs = ['1', '2.5', '1/2', '1 1/2'];

      numericInputs.forEach(input => {
        const result = parseIngredient(input);
        expect(result.amount).toBeGreaterThan(0);
        expect(result.name).toBeTruthy();
      });
    });
  });
});
