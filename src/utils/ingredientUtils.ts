import { Ingredient, INGREDIENT_CATEGORIES } from '@app-types';

/**
 * Utility functions for ingredient parsing, formatting, and processing
 */

// Helper function to determine if an ingredient should use an empty unit (for count-based items)
export function shouldUseEmptyUnit(ingredientName: string): boolean {
  const countBasedIngredients = [
    'egg', 'eggs', 'onion', 'onions', 'apple', 'apples', 'banana', 'bananas',
    'lemon', 'lemons', 'lime', 'limes', 'orange', 'oranges', 'tomato', 'tomatoes',
    'potato', 'potatoes', 'carrot', 'carrots', 'bell pepper', 'bell peppers',
    'avocado', 'avocados', 'cucumber', 'cucumbers', 'zucchini', 'zucchinis',
    'eggplant', 'eggplants', 'mushroom', 'mushrooms', 'clove', 'cloves',
    'garlic', 'bay leaf', 'bay leaves', 'chicken breast', 'chicken breasts',
    'chicken thigh', 'chicken thighs', 'pork chop', 'pork chops',
    'steak', 'steaks', 'fillet', 'fillets', 'shrimp', 'prawns'
  ];

  const normalizedName = ingredientName.toLowerCase().trim();
  return countBasedIngredients.some(item =>
    normalizedName.includes(item) || normalizedName.startsWith(item)
  );
}

// Parse ingredients from array of strings
export function parseIngredients(ingredientStrings: string[]): Ingredient[] {
  return ingredientStrings.map(item => parseIngredient(item));
}

// Parse a single ingredient string into structured format
export function parseIngredient(item: string): Ingredient {
  if (!item || typeof item !== 'string') {
    return { name: '', amount: 1, unit: 'unit' };
  }

  const cleanedItem = item.trim();
  if (!cleanedItem) {
    return { name: '', amount: 1, unit: 'unit' };
  }

  // Check if ingredient has section information (format: [Section Name] ingredient text)
  let section: string | undefined;
  let ingredientText = cleanedItem;

  const sectionMatch = cleanedItem.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (sectionMatch) {
    section = sectionMatch[1].trim();
    ingredientText = sectionMatch[2].trim();
  }

  // Enhanced regex patterns to handle complex ingredient formats
  const patterns = [
    // Pattern 0: Fix malformed "ounce) package cream cheese, softened" -> extract missing opening parenthesis
    /^([a-zA-Z]+\))\s+(.+?)(?:,\s*(.+))?$/,
    // Pattern 1: Parenthetical amounts like "1 (15 oz) can tomatoes" or "(15 oz) can tomatoes"
    /^(?:(\d+(?:\s+\d+\/\d+|\.\d+|[¼½¾⅓⅔⅛⅜⅝⅞])?)\s+)?\(([^)]+)\)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
    // Pattern 2: Mixed numbers like "1 1/2 tablespoons olive oil"
    /^(\d+\s+\d+\/\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
    // Pattern 3: Simple fractions like "1/2 cup flour"
    /^(\d+\/\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
    // Pattern 4: Ranges like "2-3 cups flour"
    /^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞]+-[\d\s\/¼½¾⅓⅔⅛⅜⅝⅞]+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(.+?)(?:,\s*(.+))?$/,
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
    const match = ingredientText.match(patterns[i]);
    if (match) {
      let amount: number;
      let unit: string;
      let name: string;
      let preparation: string = '';

      if (i === 0) {
        // Handle malformed "ounce) package..." pattern
        // const malformedUnit = match[1]; // e.g., "ounce)" - not used
        const restOfIngredient = match[2]; // e.g., "package cream cheese"
        preparation = match[3] || ''; // e.g., "softened"

        // Extract the unit from the malformed pattern
        // const unitName = malformedUnit.replace(')', ''); // e.g., "ounce" - not used

        // Parse the rest to find container type and ingredient
        const restParts = restOfIngredient.split(' ');
        if (restParts.length >= 2) {
          const containerType = restParts[0]; // e.g., "package"
          name = restParts.slice(1).join(' '); // e.g., "cream cheese"

          // Use the container type as the unit
          unit = normalizeUnit(containerType);
          amount = 1; // Default amount for malformed patterns
        } else {
          // Fallback
          amount = 1;
          unit = 'unit';
          name = restOfIngredient;
        }
      } else if (i === 1) {
        // Handle parenthetical amounts like "1 (15 oz) can tomatoes"
        const leadingAmount = match[1]; // Could be undefined for "(15 oz) can tomatoes"
        const parentheticalContent = match[2]; // e.g., "15 oz"
        const containerType = match[3]; // e.g., "can"
        const ingredientName = match[4]; // e.g., "tomatoes" or "diced tomatoes"
        preparation = match[5] || '';

        // Use leading amount if present, otherwise extract from parenthetical
        if (leadingAmount) {
          amount = parseAmount(leadingAmount);
        } else {
          const amountMatch = parentheticalContent.match(/^(\d+(?:\.\d+)?)/);
          amount = amountMatch ? parseFloat(amountMatch[1]) : 1;
        }

        // Extract unit from parenthetical content, fallback to container type
        const unitMatch = parentheticalContent.match(/([a-zA-Z]+)/);
        if (unitMatch) {
          unit = normalizeUnit(unitMatch[1]);
        } else {
          unit = normalizeUnit(containerType);
        }

        // For the name, preserve the full ingredient name including any descriptors
        // Don't separate preparation methods for canned/packaged goods
        name = ingredientName;
      } else {
        // Handle normal patterns (2-8)
        const amountStr = match[1];
        const detectedUnit = match[2] ? match[2].trim() : '';
        name = match[3] ? match[3].trim() : cleanedItem;
        preparation = match[4] ? match[4].trim() : '';

        amount = parseAmount(amountStr);

        // Determine the appropriate unit
        if (detectedUnit) {
          unit = normalizeUnit(detectedUnit);
        } else {
          // Use empty unit for count-based ingredients, otherwise use 'unit'
          unit = shouldUseEmptyUnit(name) ? '' : 'unit';
        }
      }

      // Clean the ingredient name and separate preparation methods
      // For parenthetical amounts (canned goods), preserve the full name
      if (i === 1) {
        // Don't separate preparation methods for canned/packaged goods
        const finalName = preparation ? `${name}, ${preparation}` : name;
        return { name: finalName, amount, unit, section };
      } else {
        const { ingredient: cleanedName, preparation: extractedPrep } = separatePreparationFromName(name);
        const finalPreparation = preparation || extractedPrep;

        // Only include preparation in name if it's essential to the ingredient identity
        const finalName = shouldIncludePreparation(cleanedName, finalPreparation)
          ? `${cleanedName}, ${finalPreparation}`
          : cleanedName;

        return { name: finalName, amount, unit, section };
      }
    }
  }

  // Fallback: try to extract just a number at the beginning
  const simpleMatch = ingredientText.match(/^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\.]+)\s+(.+)$/);
  if (simpleMatch) {
    const amount = parseAmount(simpleMatch[1]);
    const rawName = simpleMatch[2].trim();
    const { ingredient: cleanedName } = separatePreparationFromName(rawName);
    const unit = shouldUseEmptyUnit(cleanedName) ? '' : 'unit';
    return { name: cleanedName, amount, unit, section };
  }

  // Final fallback: treat the entire string as the ingredient name
  const { ingredient: cleanedName } = separatePreparationFromName(ingredientText);
  const unit = shouldUseEmptyUnit(cleanedName) ? '' : 'unit';
  return { name: cleanedName, amount: 1, unit, section };
}

// Parse amount from string (handles fractions, ranges, unicode fractions)
export function parseAmount(amountStr: string): number {
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
export function normalizeUnit(unit: string): string {
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

// Parse ingredient name to separate base ingredient from preparation method
export function parseIngredientNameAndPreparation(name: string): { ingredient: string; preparation: string } {
  const trimmedName = name.trim();

  // Common preparation method patterns
  const preparationPatterns = [
    // Comma-separated preparations
    /^(.+?),\s*(finely\s+)?(diced|chopped|sliced|minced|grated|shredded|crushed|ground)(.*)$/i,
    /^(.+?),\s*(melted|softened|cooked|raw|fresh|dried|frozen)(.*)$/i,
    /^(.+?),\s*(peeled|seeded|stemmed|trimmed|halved|quartered|split)(.*)$/i,
    /^(.+?),\s*(room\s+temperature|at\s+room\s+temperature)(.*)$/i,
    /^(.+?),\s*(divided)(.*)$/i,
    /^(.+?),\s*(to\s+taste)(.*)$/i,

    // Standalone preparation words at the beginning (but preserve "ground beef", "ground turkey", etc.)
    /^(finely\s+)?(diced|chopped|sliced|minced|grated|shredded|crushed)\s+(.+)$/i,
    /^(melted|softened|cooked|raw|dried|frozen)\s+(.+)$/i,
    /^(fresh)\s+(.+)$/i
  ];

  for (const pattern of preparationPatterns) {
    const match = trimmedName.match(pattern);
    if (match) {
      if (pattern.source.includes('^(.+?),')) {
        // Comma-separated pattern
        const ingredient = match[1].trim();
        const prep1 = match[2] || '';
        const prep2 = match[3] || '';
        const prep3 = match[4] || '';
        const preparation = (prep1 + prep2 + prep3).trim();
        return { ingredient, preparation };
      } else {
        // Standalone preparation at beginning
        const prep1 = match[1] || '';
        const prep2 = match[2] || '';
        const ingredient = match[3] || match[2] || '';

        // Don't separate "ground" from "ground beef", "ground turkey", etc.
        if (prep2 === 'ground' && /^(beef|turkey|chicken|pork|lamb)$/i.test(ingredient)) {
          return { ingredient: trimmedName, preparation: '' };
        }

        const preparation = (prep1 + prep2).trim();
        return { ingredient: ingredient.trim(), preparation };
      }
    }
  }

  // No preparation method found
  return { ingredient: trimmedName, preparation: '' };
}

// Enhanced function to separate preparation methods from ingredient names
export function separatePreparationFromName(name: string): { ingredient: string; preparation: string } {
  const trimmedName = name.trim();

  // Enhanced preparation method patterns
  const preparationPatterns = [
    // Comma-separated preparations with more comprehensive patterns
    /^(.+?),\s*(finely\s+)?(diced|chopped|sliced|minced|grated|shredded|crushed|ground|julienned)(.*)$/i,
    /^(.+?),\s*(melted|softened|cooked|raw|fresh|dried|frozen|thawed|drained)(.*)$/i,
    /^(.+?),\s*(peeled|seeded|stemmed|trimmed|halved|quartered|split|cored|pitted)(.*)$/i,
    /^(.+?),\s*(room\s+temperature|at\s+room\s+temperature|softened|cubed|cut\s+into\s+pieces)(.*)$/i,
    /^(.+?),\s*(divided|separated|beaten|whipped|sifted)(.*)$/i,
    /^(.+?),\s*(to\s+taste|or\s+to\s+taste|or\s+more\s+to\s+taste)(.*)$/i,
    /^(.+?),\s*(undrained|drained|rinsed|rinsed\s+and\s+drained)(.*)$/i,

    // Standalone preparation words at the beginning
    /^(finely\s+)?(diced|chopped|sliced|minced|grated|shredded|crushed|julienned)\s+(.+)$/i,
    /^(melted|softened|cooked|raw|dried|frozen|thawed)\s+(.+)$/i,
    /^(fresh|dried)\s+(.+)$/i
  ];

  for (const pattern of preparationPatterns) {
    const match = trimmedName.match(pattern);
    if (match) {
      if (pattern.source.includes('^(.+?),')) {
        // Comma-separated pattern
        const ingredient = match[1].trim();
        const prep1 = match[2] || '';
        const prep2 = match[3] || '';
        const prep3 = match[4] || '';
        const preparation = (prep1 + prep2 + prep3).trim();
        return { ingredient, preparation };
      } else {
        // Standalone preparation at beginning
        let prep1 = match[1] || '';
        let prep2 = match[2] || '';
        let ingredient = match[3] || '';

        // Handle different pattern structures
        if (!ingredient && prep2) {
          // Pattern like /^(fresh|dried)\s+(.+)$/i where match[2] is the ingredient
          ingredient = prep2;
          prep2 = prep1;
          prep1 = '';
        }

        // Don't separate "ground" from "ground beef", "ground turkey", etc.
        if (prep2 === 'ground' && /^(beef|turkey|chicken|pork|lamb)$/i.test(ingredient)) {
          return { ingredient: trimmedName, preparation: '' };
        }

        // Don't separate "fresh" from certain ingredients where it's part of the name
        if (prep2 === 'fresh' && /^(herbs|basil|parsley|cilantro|dill|mint|thyme|rosemary|oregano)$/i.test(ingredient)) {
          return { ingredient: trimmedName, preparation: '' };
        }

        const preparation = (prep1 + prep2).trim();
        return { ingredient: ingredient.trim(), preparation };
      }
    }
  }

  // No preparation method found
  return { ingredient: trimmedName, preparation: '' };
}

// Determine if preparation should be included in the final ingredient name
export function shouldIncludePreparation(_ingredient: string, preparation: string): boolean {
  if (!preparation) return false;

  // Essential preparations that affect the ingredient identity
  const essentialPreparations = [
    'ground', 'whole', 'crushed', 'powder', 'paste', 'extract', 'concentrate',
    'smoked', 'cured', 'aged', 'roasted', 'toasted'
  ];

  const normalizedPrep = preparation.toLowerCase().trim();
  return essentialPreparations.some(essential => normalizedPrep.includes(essential));
}

// Format ingredient for display (handles empty units properly)
export function formatIngredientForDisplay(ingredient: { amount: number; unit: string; name: string }): string {
  // Handle zero or negative amounts - return just the ingredient name
  if (ingredient.amount <= 0) {
    return ingredient.name.trim();
  }

  const formattedAmount = formatAmountForDisplay(ingredient.amount);
  const trimmedUnit = ingredient.unit.trim();
  const trimmedName = ingredient.name.trim();

  if (trimmedUnit !== '') {
    // Handle empty ingredient names
    if (trimmedName === '') {
      return `${formattedAmount} ${trimmedUnit}`;
    }
    return `${formattedAmount} ${trimmedUnit} ${trimmedName}`;
  } else {
    // Handle empty ingredient names
    if (trimmedName === '') {
      return formattedAmount;
    }
    return `${formattedAmount} ${trimmedName}`;
  }
}

// Convert decimal to fraction for display
export function formatAmountForDisplay(amount: number): string {
  // Handle floating point precision issues first - round to 3 decimal places
  const roundedAmount = Math.round(amount * 1000) / 1000;

  // Special handling for common floating point precision issues
  if (Math.abs(roundedAmount - 0.3) < 0.001) {
    return '0.3';
  }
  if (Math.abs(roundedAmount - 0.1) < 0.001) {
    return '0.1';
  }
  if (Math.abs(roundedAmount - 0.2) < 0.001) {
    return '0.2';
  }

  // Handle whole numbers
  if (roundedAmount === Math.floor(roundedAmount)) {
    return roundedAmount.toString();
  }

  // Common fraction mappings with better precision handling
  const fractionMap: { [key: string]: string } = {
    '0.125': '1/8',
    '0.25': '1/4',
    '0.33': '1/3',
    '0.333': '1/3',
    '0.3333333333333333': '1/3',  // More precise 1/3
    '0.375': '3/8',
    '0.5': '1/2',
    '0.625': '5/8',
    '0.67': '2/3',
    '0.666': '2/3',
    '0.6666666666666666': '2/3',  // More precise 2/3
    '0.75': '3/4',
    '0.875': '7/8'
  };

  // Check for exact matches (with small tolerance for floating point precision)
  for (const [decimalStr, fraction] of Object.entries(fractionMap)) {
    const decimal = parseFloat(decimalStr);
    if (Math.abs(roundedAmount - decimal) < 0.01) {
      return fraction;
    }
  }

  // Handle mixed numbers (e.g., 1.25 -> 1 1/4)
  const wholePart = Math.floor(roundedAmount);
  const fractionalPart = roundedAmount - wholePart;

  if (wholePart > 0) {
    for (const [decimalStr, fraction] of Object.entries(fractionMap)) {
      const decimal = parseFloat(decimalStr);
      if (Math.abs(fractionalPart - decimal) < 0.01) {
        return `${wholePart} ${fraction}`;
      }
    }
  }

  // For other fractions, try to find a simple fraction representation
  const tolerance = 0.01;
  for (let denominator = 2; denominator <= 16; denominator++) {
    for (let numerator = 1; numerator < denominator; numerator++) {
      const fractionValue = numerator / denominator;
      if (Math.abs(roundedAmount - fractionValue) < tolerance) {
        return `${numerator}/${denominator}`;
      }

      // Check mixed numbers
      if (wholePart > 0 && Math.abs(fractionalPart - fractionValue) < tolerance) {
        return `${wholePart} ${numerator}/${denominator}`;
      }
    }
  }

  // Fallback to decimal with reasonable precision
  return roundedAmount.toFixed(2).replace(/\.?0+$/, '');
}

// Clean ingredient name (remove preparation instructions, etc.)
export function cleanIngredientName(name: string): string {
  let cleanedName = name.trim();

  // Remove "divided" indicators first
  // Examples: "salt, divided" -> "salt"
  cleanedName = cleanedName.replace(/,\s*divided\s*$/i, '');

  // Handle "or" alternatives - take the first option
  // Examples: "ground beef or turkey" -> "ground beef", "yellow mustard, or to taste" -> "yellow mustard"
  cleanedName = cleanedName.replace(/,?\s+or\s+.*/i, '');

  // Remove "to taste" indicators
  // Examples: "salt to taste" -> "salt", "pepper, to taste" -> "pepper"
  cleanedName = cleanedName.replace(/,?\s*to\s+taste\s*$/i, '');

  // Handle "and" combinations for seasoning - take the first item
  // Examples: "salt and ground black pepper to taste" -> "salt"
  if (/\s+and\s+.*\s+to\s+taste/i.test(name)) {
    cleanedName = cleanedName.replace(/\s+and\s+.*/i, '');
  }

  // Remove preparation methods and cooking states
  // Examples: "onion, finely chopped" -> "onion", "butter, melted" -> "butter", "butter, softened" -> "butter"
  const preparationPatterns = [
    /,\s*(finely\s+)?(diced|chopped|sliced|minced|grated|shredded|crushed|ground).*$/i,
    /,\s*(melted|softened|cooked|raw|fresh|dried|frozen).*$/i,
    /,\s*(peeled|seeded|stemmed|trimmed|halved|quartered|split).*$/i,
    /,\s*(room\s+temperature|at\s+room\s+temperature).*$/i
  ];
  
  for (const pattern of preparationPatterns) {
    cleanedName = cleanedName.replace(pattern, '');
  }

  // Remove "Optional" prefix
  // Examples: "Optional chopped dill pickles and lettuce" -> "chopped dill pickles and lettuce"
  cleanedName = cleanedName.replace(/^optional\s+/i, '');

  // Remove standalone preparation words at the beginning
  // Examples: "chopped onion" -> "onion", "ground beef" -> keep as "ground beef" (it's a type)
  const standalonePreparationPatterns = [
    /^(finely\s+)?(diced|chopped|sliced|minced|grated|shredded|crushed)\s+/i,
    /^(melted|softened|cooked|raw|dried|frozen)\s+/i
  ];
  
  for (const pattern of standalonePreparationPatterns) {
    // Don't remove "ground" from "ground beef" or "ground turkey" as it's part of the ingredient type
    if (pattern.source.includes('ground') && /ground\s+(beef|turkey|chicken|pork|lamb)/i.test(cleanedName)) {
      continue;
    }
    cleanedName = cleanedName.replace(pattern, '');
  }

  // Special handling for "fresh" - only remove if not part of ingredient name like "fresh herbs"
  // But keep "fresh basil" -> "basil", "fresh herbs" -> "herbs"
  if (/^fresh\s+/i.test(cleanedName)) {
    cleanedName = cleanedName.replace(/^fresh\s+/i, '');
  }

  // Handle complex "and" combinations after other cleaning
  // Examples: "chopped dill pickles and lettuce" -> "dill pickles" (take first item)
  if (cleanedName.includes(' and ')) {
    const parts = cleanedName.split(' and ');
    if (parts.length === 2) {
      // Take the first part, but clean it further
      cleanedName = parts[0].trim();
      // Remove any remaining preparation words from the first part
      cleanedName = cleanedName.replace(/^(chopped|diced|sliced|minced)\s+/i, '');
    }
  }

  // Remove parenthetical content
  // Examples: "tomatoes (14.5 oz can)" -> "tomatoes", "cheese (shredded)" -> "cheese"
  cleanedName = cleanedName.replace(/\s*\([^)]*\)\s*/g, '');

  // Remove trailing commas that might be left over
  cleanedName = cleanedName.replace(/,\s*$/, '');

  // Remove extra whitespace and trim
  cleanedName = cleanedName.replace(/\s+/g, ' ').trim();

  // Return original if cleaning results in empty string or just punctuation
  if (!cleanedName || /^[^a-zA-Z0-9]*$/.test(cleanedName)) {
    return name.trim();
  }

  return cleanedName;
}

// Detect ingredient category based on name
export function detectIngredientCategory(name: string): { id: string; name: string } {
  const normalizedName = name.toLowerCase();

  // Simple keyword-based categorization
  const categoryKeywords = {
    vegetables: ['onion', 'garlic', 'carrot', 'celery', 'potato', 'tomato', 'pepper', 'mushroom', 'spinach', 'lettuce', 'cucumber', 'broccoli', 'cauliflower', 'zucchini', 'eggplant', 'cabbage', 'kale', 'asparagus', 'artichoke', 'beet', 'radish', 'turnip', 'parsnip', 'leek', 'shallot', 'scallion', 'chive'],
    fruits: ['apple', 'banana', 'orange', 'lemon', 'lime', 'grape', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cherry', 'peach', 'pear', 'plum', 'apricot', 'mango', 'pineapple', 'kiwi', 'avocado', 'coconut', 'cranberry', 'pomegranate', 'fig', 'date', 'raisin'],
    meat: ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'bacon', 'ham', 'sausage', 'ground beef', 'ground turkey', 'ground chicken', 'steak', 'roast', 'chop', 'breast', 'thigh', 'wing'],
    seafood: ['salmon', 'tuna', 'cod', 'halibut', 'shrimp', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster', 'fish', 'anchovy', 'sardine', 'mackerel', 'trout', 'bass', 'snapper'],
    dairy: ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'sour cream', 'cottage cheese', 'ricotta', 'mozzarella', 'cheddar', 'parmesan', 'feta', 'goat cheese', 'cream cheese', 'egg', 'eggs'],
    grains: ['rice', 'pasta', 'bread', 'flour', 'oats', 'quinoa', 'barley', 'wheat', 'corn', 'cornmeal', 'couscous', 'bulgur', 'farro', 'millet', 'buckwheat', 'rye', 'spelt'],
    legumes: ['bean', 'beans', 'lentil', 'lentils', 'chickpea', 'chickpeas', 'pea', 'peas', 'peanut', 'peanuts', 'almond', 'almonds', 'walnut', 'walnuts', 'cashew', 'cashews', 'pistachio', 'pistachios', 'pecan', 'pecans', 'hazelnut', 'hazelnuts'],
    herbs: ['basil', 'oregano', 'thyme', 'rosemary', 'sage', 'parsley', 'cilantro', 'dill', 'mint', 'chives', 'tarragon', 'bay leaf', 'bay leaves', 'paprika', 'cumin', 'coriander', 'turmeric', 'ginger', 'cinnamon', 'nutmeg', 'clove', 'cloves', 'cardamom', 'fennel', 'anise', 'saffron', 'vanilla', 'pepper', 'salt', 'garlic powder', 'onion powder'],
    oils: ['oil', 'olive oil', 'vegetable oil', 'canola oil', 'coconut oil', 'sesame oil', 'avocado oil', 'sunflower oil', 'safflower oil', 'grapeseed oil', 'peanut oil', 'corn oil', 'butter', 'margarine', 'shortening', 'lard'],
    condiments: ['sauce', 'ketchup', 'mustard', 'mayonnaise', 'vinegar', 'soy sauce', 'worcestershire', 'hot sauce', 'barbecue sauce', 'teriyaki', 'salsa', 'pesto', 'tahini', 'hummus', 'pickle', 'pickles', 'relish', 'capers', 'olives'],
    baking: ['sugar', 'brown sugar', 'honey', 'maple syrup', 'molasses', 'baking powder', 'baking soda', 'yeast', 'vanilla extract', 'almond extract', 'cocoa powder', 'chocolate', 'chocolate chips', 'cornstarch', 'gelatin', 'agar'],
    beverages: ['water', 'broth', 'stock', 'wine', 'beer', 'juice', 'coffee', 'tea', 'soda', 'milk', 'coconut milk', 'almond milk', 'soy milk', 'oat milk'],
  };

  for (const [categoryId, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => normalizedName.includes(keyword))) {
      const category = INGREDIENT_CATEGORIES.find(cat => cat.id === categoryId);
      return category || INGREDIENT_CATEGORIES.find(cat => cat.id === 'other')!;
    }
  }

  return INGREDIENT_CATEGORIES.find(cat => cat.id === 'other')!;
}
