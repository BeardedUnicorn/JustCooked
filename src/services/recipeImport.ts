import { invoke } from '@tauri-apps/api/core';
import { Recipe, Ingredient } from '@app-types/recipe';
import { saveRecipe } from '@services/recipeStorage';
import { autoDetectIngredients } from '@services/ingredientStorage';
import { processRecipeImage } from '@services/imageService';

// Interface matching the Rust ImportedRecipe struct
interface ImportedRecipe {
  name: string;
  description: string;
  image: string;
  prep_time: string;
  cook_time: string;
  total_time: string;
  servings: number;
  ingredients: string[];
  instructions: string[];
  keywords: string;
  source_url: string;
}

export async function importRecipeFromUrl(url: string): Promise<Recipe> {
  try {
    console.log('Importing recipe from URL:', url);

    // Check if the URL is from a supported site
    if (!isSupportedUrl(url)) {
      throw new Error('Unsupported website. Supported sites: AllRecipes, Food Network, BBC Good Food, Serious Eats, Epicurious, Food.com, Taste of Home, Delish, Bon Appétit, Simply Recipes.');
    }

    // Call the Tauri backend command
    const importedRecipe: ImportedRecipe = await invoke('import_recipe', { url });

    if (!importedRecipe || !importedRecipe.name) {
      throw new Error('Failed to extract recipe data from the URL');
    }

    console.log('Imported recipe data:', importedRecipe);

    // Transform the data to match our Recipe type
    const parsedIngredients = parseIngredients(importedRecipe.ingredients || []);

    // Process the image (download and store locally if possible)
    const processedImageUrl = await processRecipeImage(
      importedRecipe.image || 'https://via.placeholder.com/400x300?text=No+Image'
    );

    const recipe: Recipe = {
      id: crypto.randomUUID(),
      title: importedRecipe.name,
      description: importedRecipe.description || '',
      image: processedImageUrl,
      sourceUrl: url,
      prepTime: importedRecipe.prep_time || '',
      cookTime: importedRecipe.cook_time || '',
      totalTime: importedRecipe.total_time || '',
      servings: importedRecipe.servings || 0,
      ingredients: parsedIngredients,
      instructions: importedRecipe.instructions || [],
      tags: parseTags(importedRecipe.keywords || ''),
      dateAdded: new Date().toISOString(),
      dateModified: new Date().toISOString(),
    };

    // Auto-detect and add new ingredients to the database
    const ingredientNames = parsedIngredients.map(ing => ing.name);
    autoDetectIngredients(ingredientNames);

    // Save the recipe
    await saveRecipe(recipe);

    return recipe;

  } catch (error) {
    console.error('Failed to import recipe:', error);
    throw new Error(`Failed to import recipe: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isSupportedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return hostname.includes('allrecipes.com') ||
           hostname.includes('foodnetwork.com') ||
           hostname.includes('bbcgoodfood.com') ||
           hostname.includes('seriouseats.com') ||
           hostname.includes('epicurious.com') ||
           hostname.includes('food.com') ||
           hostname.includes('tasteofhome.com') ||
           hostname.includes('delish.com') ||
           hostname.includes('bonappetit.com') ||
           hostname.includes('simplyrecipes.com');
  } catch {
    return false;
  }
}

// Helper function to determine if an ingredient should use an empty unit (for count-based items)
function shouldUseEmptyUnit(ingredientName: string): boolean {
  const countBasedIngredients = [
    'egg', 'eggs', 'onion', 'onions', 'apple', 'apples', 'banana', 'bananas',
    'lemon', 'lemons', 'lime', 'limes', 'orange', 'oranges', 'tomato', 'tomatoes',
    'potato', 'potatoes', 'carrot', 'carrots', 'bell pepper', 'bell peppers',
    'avocado', 'avocados', 'cucumber', 'cucumbers', 'zucchini', 'zucchinis',
    'eggplant', 'eggplants', 'mushroom', 'mushrooms', 'clove', 'cloves',
    'bay leaf', 'bay leaves', 'chicken breast', 'chicken breasts',
    'chicken thigh', 'chicken thighs', 'pork chop', 'pork chops',
    'steak', 'steaks', 'fillet', 'fillets', 'shrimp', 'prawns'
  ];

  const normalizedName = ingredientName.toLowerCase().trim();
  return countBasedIngredients.some(item =>
    normalizedName.includes(item) || normalizedName.startsWith(item)
  );
}

// Parse ingredients from array of strings
function parseIngredients(ingredientStrings: string[]): Ingredient[] {
  return ingredientStrings.map(item => {
    const cleanedItem = item.trim();

    // Enhanced regex to handle more complex ingredient formats
    // Matches: amount, unit, name (with optional preparation instructions)
    const patterns = [
      // Pattern 0: Fix malformed "1 unit .5 cups milk" -> extract the real amount and unit
      /^(\d+)\s+unit\s+(\d*\.?\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
      // Pattern 1: Mixed numbers like "1 1/2 tablespoons olive oil"
      /^(\d+\s+\d+\/\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
      // Pattern 2: Simple fractions like "1/2 cup flour"
      /^(\d+\/\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
      // Pattern 3: Ranges like "2-3 cups flour"
      /^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞]+-[\d\s\/¼½¾⅓⅔⅛⅜⅝⅞]+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
      // Pattern 4: Parenthetical amounts like "1 (15 oz) can tomatoes"
      /^(\d+)\s*\([^)]+\)\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
      // Pattern 5: Unicode fractions like "¼ cup flour"
      /^([¼½¾⅓⅔⅛⅜⅝⅞]+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
      // Pattern 6: Mixed numbers with unicode like "1½ cups flour"
      /^(\d+[¼½¾⅓⅔⅛⅜⅝⅞]+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
      // Pattern 7: Decimal numbers like "1.5 cups flour"
      /^(\d+\.?\d*)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
      // Pattern 8: Simple whole numbers like "2 cups flour"
      /^(\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
    ];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = cleanedItem.match(pattern);
      if (match) {
        let amountStr, unit, name, preparation;

        if (i === 0) {
          // Special handling for malformed "1 unit .5 cups milk" pattern
          const wholeAmount = parseFloat(match[1]);
          const decimalAmount = parseFloat(match[2]);
          const combinedAmount = wholeAmount + decimalAmount;
          unit = normalizeUnit(match[3].trim());
          name = match[4] ? match[4].trim() : cleanedItem;
          preparation = match[5] ? match[5].trim() : '';

          const finalName = preparation ? `${name}, ${preparation}` : name;
          return { name: finalName, amount: combinedAmount, unit };
        } else {
          // Normal pattern handling
          amountStr = match[1];
          const detectedUnit = match[2] ? match[2].trim() : '';
          name = match[3] ? match[3].trim() : cleanedItem;
          preparation = match[4] ? match[4].trim() : '';

          // Determine the appropriate unit
          if (detectedUnit) {
            unit = normalizeUnit(detectedUnit);
          } else {
            // Use empty unit for count-based ingredients, otherwise use 'unit'
            unit = shouldUseEmptyUnit(name) ? '' : 'unit';
          }

          const amount = parseAmount(amountStr);
          const finalName = preparation ? `${name}, ${preparation}` : name;

          return { name: finalName, amount, unit };
        }
      }
    }

    // Fallback: try to extract just a number at the beginning
    const simpleMatch = cleanedItem.match(/^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\.]+)\s+(.+)$/);
    if (simpleMatch) {
      const amount = parseAmount(simpleMatch[1]);
      const name = simpleMatch[2].trim();
      // Use empty unit for count-based ingredients, otherwise use 'unit'
      const unit = shouldUseEmptyUnit(name) ? '' : 'unit';
      return { name, amount, unit };
    }

    // Final fallback: treat as ingredient name with amount 1
    const unit = shouldUseEmptyUnit(cleanedItem) ? '' : 'unit';
    return {
      name: cleanedItem,
      amount: 1,
      unit,
    };
  });
}

// Parse amount from string (handles fractions, ranges, unicode fractions)
function parseAmount(amountStr: string): number {
  const trimmed = amountStr.trim();

  // Handle ranges like "2-3" or "1 to 2" - take the average
  const rangeMatch = trimmed.match(/^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞]+)(?:\s*[-–—]\s*|\s+to\s+)([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞]+)$/);
  if (rangeMatch) {
    const start = parseAmount(rangeMatch[1]);
    const end = parseAmount(rangeMatch[2]);
    return (start + end) / 2;
  }

  // Handle Unicode fractions
  const unicodeFractions: { [key: string]: number } = {
    '¼': 0.25, '½': 0.5, '¾': 0.75,
    '⅓': 1/3, '⅔': 2/3,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
  };

  // Replace Unicode fractions with decimal equivalents
  let processedStr = trimmed;
  for (const [unicode, decimal] of Object.entries(unicodeFractions)) {
    if (processedStr.includes(unicode)) {
      // Handle mixed numbers with Unicode fractions like "1½"
      const mixedUnicodeMatch = processedStr.match(new RegExp(`(\\d+)\\s*${unicode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      if (mixedUnicodeMatch) {
        const whole = parseFloat(mixedUnicodeMatch[1]);
        return whole + decimal;
      }
      // Handle standalone Unicode fractions
      processedStr = processedStr.replace(unicode, decimal.toString());
    }
  }

  // Handle mixed numbers like "1 1/2" BEFORE simple fractions
  const mixedMatch = processedStr.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const numerator = parseFloat(mixedMatch[2]);
    const denominator = parseFloat(mixedMatch[3]);
    if (!isNaN(whole) && !isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
      return whole + (numerator / denominator);
    }
  }

  // Handle regular fractions like "1/2", "3/4", etc.
  if (processedStr.includes('/')) {
    const parts = processedStr.split('/');
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }
  }

  // Handle regular numbers
  const parsed = parseFloat(processedStr);
  return isNaN(parsed) ? 1 : parsed;
}

// Normalize unit names to standard forms
function normalizeUnit(unit: string): string {
  const unitMap: { [key: string]: string } = {
    // Volume
    'cup': 'cup', 'cups': 'cup', 'c': 'cup',
    'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbsp': 'tbsp', 'tbs': 'tbsp', 'T': 'tbsp',
    'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tsp': 'tsp', 't': 'tsp',
    'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz', 'fl oz': 'fl oz', 'floz': 'fl oz',
    'pint': 'pint', 'pints': 'pint', 'pt': 'pint',
    'quart': 'quart', 'quarts': 'quart', 'qt': 'quart',
    'gallon': 'gallon', 'gallons': 'gallon', 'gal': 'gallon',
    'liter': 'liter', 'liters': 'liter', 'l': 'liter', 'litre': 'liter', 'litres': 'liter',
    'milliliter': 'ml', 'milliliters': 'ml', 'ml': 'ml', 'millilitre': 'ml', 'millilitres': 'ml',

    // Weight
    'pound': 'lb', 'pounds': 'lb', 'lb': 'lb', 'lbs': 'lb',
    'ounce': 'oz', 'ounces': 'oz', 'oz': 'oz',
    'gram': 'g', 'grams': 'g', 'g': 'g',
    'kilogram': 'kg', 'kilograms': 'kg', 'kg': 'kg',

    // Count
    'piece': 'piece', 'pieces': 'piece',
    'slice': 'slice', 'slices': 'slice',
    'clove': 'clove', 'cloves': 'clove',
    'can': 'can', 'cans': 'can',
    'package': 'package', 'packages': 'package', 'pkg': 'package',
    'bunch': 'bunch', 'bunches': 'bunch',
    'head': 'head', 'heads': 'head',
  };

  const normalized = unit.toLowerCase().trim();
  return unitMap[normalized] || unit;
}

// Format ingredient for display (handles empty units properly)
export function formatIngredientForDisplay(ingredient: { amount: number; unit: string; name: string }): string {
  const formattedAmount = formatAmountForDisplay(ingredient.amount);

  if (ingredient.unit && ingredient.unit.trim() !== '') {
    return `${formattedAmount} ${ingredient.unit} ${ingredient.name}`;
  } else {
    return `${formattedAmount} ${ingredient.name}`;
  }
}

// Convert decimal to fraction for display
export function formatAmountForDisplay(amount: number): string {
  // Handle whole numbers
  if (amount === Math.floor(amount)) {
    return amount.toString();
  }

  // Common fraction mappings
  const fractionMap: { [key: number]: string } = {
    0.125: '1/8',
    0.25: '1/4',
    0.333: '1/3',
    0.3333333333333333: '1/3',  // More precise 1/3
    0.375: '3/8',
    0.5: '1/2',
    0.625: '5/8',
    0.666: '2/3',
    0.6666666666666666: '2/3',  // More precise 2/3
    0.75: '3/4',
    0.875: '7/8'
  };

  // Check for exact matches (with small tolerance for floating point precision)
  for (const [decimal, fraction] of Object.entries(fractionMap)) {
    if (Math.abs(amount - parseFloat(decimal)) < 0.001) {
      return fraction;
    }
  }

  // Handle mixed numbers (e.g., 1.25 -> 1 1/4)
  const wholePart = Math.floor(amount);
  const fractionalPart = amount - wholePart;

  if (wholePart > 0) {
    for (const [decimal, fraction] of Object.entries(fractionMap)) {
      if (Math.abs(fractionalPart - parseFloat(decimal)) < 0.001) {
        return `${wholePart} ${fraction}`;
      }
    }
  }

  // For other fractions, try to find a simple fraction representation
  const tolerance = 0.001;
  for (let denominator = 2; denominator <= 16; denominator++) {
    for (let numerator = 1; numerator < denominator; numerator++) {
      const fractionValue = numerator / denominator;
      if (Math.abs(amount - fractionValue) < tolerance) {
        return `${numerator}/${denominator}`;
      }

      // Check mixed numbers
      if (wholePart > 0 && Math.abs(fractionalPart - fractionValue) < tolerance) {
        return `${wholePart} ${numerator}/${denominator}`;
      }
    }
  }

  // Fallback to decimal with reasonable precision
  return amount.toFixed(2).replace(/\.?0+$/, '');
}

// Parse tags from keywords string
function parseTags(keywords: string): string[] {
  if (!keywords) return [];

  return keywords
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .slice(0, 10); // Limit to 10 tags
}
