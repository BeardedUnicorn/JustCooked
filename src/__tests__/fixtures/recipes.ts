import { Recipe, Ingredient, PantryItem, IngredientDatabase } from '@app-types';

export const mockIngredient: Ingredient = {
  name: 'flour',
  amount: 2,
  unit: 'cups',
};

export const mockIngredients: Ingredient[] = [
  { name: 'flour', amount: 2, unit: 'cups' },
  { name: 'sugar', amount: 1, unit: 'cup' },
  { name: 'eggs', amount: 3, unit: '' },
  { name: 'milk', amount: 0.5, unit: 'cup' },
  { name: 'butter', amount: 0.25, unit: 'cup' },
];

// Mock ingredients with sections for testing sectioned display
export const mockSectionedIngredients: Ingredient[] = [
  { name: 'all-purpose flour', amount: 3, unit: 'cups', section: 'White Cake Layer' },
  { name: 'milk', amount: 1.5, unit: 'cups', section: 'White Cake Layer' },
  { name: 'white sugar', amount: 1, unit: 'cup', section: 'White Cake Layer' },
  { name: 'eggs', amount: 2, unit: 'large', section: 'White Cake Layer' },
  { name: 'butter, softened', amount: 1, unit: 'cup', section: 'Cinnamon Layer' },
  { name: 'brown sugar', amount: 1, unit: 'cup', section: 'Cinnamon Layer' },
  { name: 'ground cinnamon', amount: 1, unit: 'tablespoon', section: 'Cinnamon Layer' },
  { name: 'confectioners\' sugar', amount: 2, unit: 'cups', section: 'Glaze' },
  { name: 'milk', amount: 5, unit: 'tablespoons', section: 'Glaze' },
  { name: 'vanilla extract', amount: 1, unit: 'teaspoon', section: 'Glaze' },
];

export const mockRecipe: Recipe = {
  id: 'test-recipe-123',
  title: 'Chocolate Chip Cookies',
  description: 'Delicious homemade chocolate chip cookies',
  image: 'https://example.com/cookies.jpg',
  sourceUrl: 'https://allrecipes.com/recipe/123/cookies',
  prepTime: 'PT15M',
  cookTime: 'PT12M',
  totalTime: 'PT27M',
  servings: 24,
  ingredients: mockIngredients,
  instructions: [
    'Preheat oven to 375°F',
    'Mix dry ingredients in a bowl',
    'Add wet ingredients and mix until combined',
    'Drop spoonfuls onto baking sheet',
    'Bake for 10-12 minutes until golden brown',
  ],
  tags: ['dessert', 'cookies', 'baking'],
  dateAdded: '2024-01-15T10:30:00.000Z',
  dateModified: '2024-01-15T10:30:00.000Z',
};

export const mockImportedRecipe = {
  name: 'Chocolate Chip Cookies',
  description: 'Delicious homemade chocolate chip cookies',
  image: 'https://example.com/cookies.jpg',
  prep_time: 'PT15M',
  cook_time: 'PT12M',
  total_time: 'PT27M',
  servings: 24,
  ingredients: [
    '2 cups all-purpose flour',
    '1 cup granulated sugar',
    '3 large eggs',
    '1/2 cup milk',
    '1/4 cup butter',
  ],
  instructions: [
    'Preheat oven to 375°F',
    'Mix dry ingredients in a bowl',
    'Add wet ingredients and mix until combined',
    'Drop spoonfuls onto baking sheet',
    'Bake for 10-12 minutes until golden brown',
  ],
  keywords: 'dessert, cookies, baking',
  source_url: 'https://allrecipes.com/recipe/123/cookies',
};

export const mockIngredientDatabase: IngredientDatabase[] = [
  {
    id: 'ing-1',
    name: 'All-Purpose Flour',
    category: 'baking',
    aliases: ['flour', 'AP flour', 'plain flour'],
    dateAdded: '2024-01-01T00:00:00.000Z',
    dateModified: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'ing-2',
    name: 'Sugar',
    category: 'baking',
    aliases: ['white sugar', 'granulated sugar', 'caster sugar'],
    dateAdded: '2024-01-01T00:00:00.000Z',
    dateModified: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'ing-3',
    name: 'Eggs',
    category: 'dairy',
    aliases: ['egg', 'large eggs', 'chicken eggs'],
    dateAdded: '2024-01-01T00:00:00.000Z',
    dateModified: '2024-01-01T00:00:00.000Z',
  },
];

export const mockPantryItems: PantryItem[] = [
  {
    id: 'pantry-1',
    name: 'Flour',
    amount: 5,
    unit: 'lbs',
    category: 'baking',
    expiryDate: '2024-12-31',
  },
  {
    id: 'pantry-2',
    name: 'Sugar',
    amount: 2,
    unit: 'lbs',
    category: 'baking',
  },
];

export const mockStoredImage = {
  local_path: '/path/to/stored/image.jpg',
  original_url: 'https://example.com/image.jpg',
  file_size: 1024000,
  format: 'JPEG',
  width: 800,
  height: 600,
};
