import { Ingredient } from '@app-types';

/**
 * Scale ingredient amounts based on serving size ratio
 * @param ingredients - Original ingredients array
 * @param originalServings - Original number of servings
 * @param newServings - New number of servings
 * @returns Scaled ingredients array
 */
export function scaleIngredients(
  ingredients: Ingredient[],
  originalServings: number,
  newServings: number
): Ingredient[] {
  // Handle edge cases
  if (!originalServings || originalServings <= 0 || !newServings || newServings <= 0) {
    return ingredients; // Return original if invalid servings
  }

  const scalingFactor = newServings / originalServings;

  return ingredients.map(ingredient => ({
    ...ingredient,
    amount: scaleAmount(ingredient.amount, scalingFactor)
  }));
}

/**
 * Scale a single ingredient amount with proper precision handling
 * @param originalAmount - Original amount
 * @param scalingFactor - Factor to scale by (newServings / originalServings)
 * @returns Scaled amount with appropriate precision
 */
export function scaleAmount(originalAmount: number, scalingFactor: number): number {
  if (!originalAmount || originalAmount <= 0) {
    return originalAmount; // Return original if invalid amount
  }

  const scaledAmount = originalAmount * scalingFactor;

  // Handle very small amounts - round to reasonable precision
  if (scaledAmount < 0.01) {
    return Math.round(scaledAmount * 1000) / 1000; // 3 decimal places for very small amounts
  }

  // For amounts less than 1, use higher precision
  if (scaledAmount < 1) {
    return Math.round(scaledAmount * 100) / 100; // 2 decimal places
  }

  // For amounts 1-10, use 1 decimal place
  if (scaledAmount < 10) {
    return Math.round(scaledAmount * 10) / 10;
  }

  // For larger amounts, round to nearest 0.25 for practical cooking measurements
  return Math.round(scaledAmount * 4) / 4;
}

/**
 * Get reasonable serving size options for the adjustment controls
 * @param originalServings - Original number of servings
 * @returns Array of reasonable serving size options
 */
export function getServingSizeOptions(originalServings: number): number[] {
  if (!originalServings || originalServings <= 0) {
    return [1, 2, 4, 6, 8, 10, 12];
  }

  const options = new Set<number>();
  
  // Add common multiples and fractions of original
  const multipliers = [0.5, 1, 1.5, 2, 2.5, 3, 4, 6, 8];
  
  multipliers.forEach(multiplier => {
    const value = Math.round(originalServings * multiplier);
    if (value > 0) {
      options.add(value);
    }
  });

  // Add some common serving sizes
  [1, 2, 4, 6, 8, 10, 12, 16, 20].forEach(size => options.add(size));

  // Convert to sorted array
  return Array.from(options).sort((a, b) => a - b);
}

/**
 * Validate if a serving size is reasonable
 * @param servings - Number of servings to validate
 * @returns True if the serving size is reasonable
 */
export function isValidServingSize(servings: number): boolean {
  return servings > 0 && servings <= 100 && Number.isFinite(servings);
}

/**
 * Get a display-friendly scaling factor description
 * @param originalServings - Original number of servings
 * @param newServings - New number of servings
 * @returns Human-readable description of the scaling
 */
export function getScalingDescription(originalServings: number, newServings: number): string {
  if (!originalServings || originalServings <= 0 || !newServings || newServings <= 0) {
    return '';
  }

  const ratio = newServings / originalServings;

  if (ratio === 1) {
    return 'Original recipe';
  } else if (ratio === 0.5) {
    return 'Half recipe';
  } else if (ratio === 2) {
    return 'Double recipe';
  } else if (ratio === 3) {
    return 'Triple recipe';
  } else if (ratio < 1) {
    return `${Math.round(ratio * 100)}% of original`;
  } else {
    return `${ratio.toFixed(1)}x original`;
  }
}
