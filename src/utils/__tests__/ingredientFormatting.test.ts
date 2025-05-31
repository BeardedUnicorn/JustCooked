import { formatIngredientForDisplay } from '../../services/recipeImport';

describe('formatIngredientForDisplay', () => {
  test('should format ingredients with units correctly', () => {
    const ingredient = { amount: 2, unit: 'cups', name: 'flour' };
    expect(formatIngredientForDisplay(ingredient)).toBe('2 cups flour');
  });

  test('should format ingredients without units correctly (no extra space)', () => {
    const ingredient = { amount: 3, unit: '', name: 'eggs' };
    expect(formatIngredientForDisplay(ingredient)).toBe('3 eggs');
  });

  test('should format ingredients with empty unit string correctly', () => {
    const ingredient = { amount: 1, unit: '   ', name: 'onion' };
    expect(formatIngredientForDisplay(ingredient)).toBe('1 onion');
  });

  test('should format fractional amounts correctly', () => {
    const ingredient = { amount: 0.5, unit: 'cup', name: 'milk' };
    expect(formatIngredientForDisplay(ingredient)).toBe('1/2 cup milk');
  });

  test('should format fractional amounts without units correctly', () => {
    const ingredient = { amount: 2.5, unit: '', name: 'apples' };
    expect(formatIngredientForDisplay(ingredient)).toBe('2 1/2 apples');
  });

  test('should handle mixed numbers with units', () => {
    const ingredient = { amount: 1.25, unit: 'tbsp', name: 'olive oil' };
    expect(formatIngredientForDisplay(ingredient)).toBe('1 1/4 tbsp olive oil');
  });
});
