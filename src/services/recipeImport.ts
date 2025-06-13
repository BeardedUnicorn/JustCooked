import { invoke } from '@tauri-apps/api/core';
import { Recipe } from '@app-types';
import { saveRecipe } from '@services/recipeStorage';
import { autoDetectIngredients } from '@services/ingredientStorage';
import { processRecipeImage } from '@services/imageService';
import { createLogger } from '@services/loggingService';
import {
  parseIngredients
} from '@utils/ingredientUtils';
import { isSupportedUrl } from '@utils/urlUtils';
import { parseTags, decodeAllHtmlEntities } from '@utils/stringUtils';
import { getCurrentTimestamp } from '@utils/timeUtils';

const logger = createLogger('RecipeImport');

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
  const startTime = performance.now();

  try {
    await logger.info('Starting recipe import', { url });

    // Check if the URL is from a supported site
    if (!isSupportedUrl(url)) {
      const error = new Error('Unsupported website. Supported sites: AllRecipes, Food Network, BBC Good Food, Serious Eats, Epicurious, Food.com, Taste of Home, Delish, Bon Appétit, Simply Recipes.');
      await logger.error('Unsupported website attempted', { url });
      throw error;
    }

    await logger.debug('URL validation passed, calling backend import', { url });

    // Call the Tauri backend command
    const importedRecipe: ImportedRecipe = await invoke('import_recipe', { url });

    if (!importedRecipe || !importedRecipe.name) {
      const error = new Error('Failed to extract recipe data from the URL');
      await logger.error('Backend returned invalid recipe data', { url, importedRecipe });
      throw error;
    }

    await logger.info('Successfully imported recipe from backend', {
      url,
      recipeName: importedRecipe.name,
      ingredientCount: importedRecipe.ingredients?.length || 0,
      instructionCount: importedRecipe.instructions?.length || 0
    });

    console.log('Imported recipe data:', importedRecipe);

    // Process the image (download and store locally if possible)
    const processedImageUrl = await processRecipeImage(
      importedRecipe.image || 'https://via.placeholder.com/400x300?text=No+Image'
    );

    // Decode HTML entities in all text fields
    const decodedTitle = decodeAllHtmlEntities(importedRecipe.name);
    const decodedDescription = decodeAllHtmlEntities(importedRecipe.description || '');
    const decodedIngredients = (importedRecipe.ingredients || []).map(ingredient => 
      decodeAllHtmlEntities(ingredient)
    );
    const decodedInstructions = (importedRecipe.instructions || []).map(instruction => 
      decodeAllHtmlEntities(instruction)
    );
    const decodedKeywords = decodeAllHtmlEntities(importedRecipe.keywords || '');

    // Parse ingredients after decoding HTML entities
    const parsedIngredients = parseIngredients(decodedIngredients);

    const recipe: Recipe = {
      id: crypto.randomUUID(),
      title: decodedTitle,
      description: decodedDescription,
      image: processedImageUrl,
      sourceUrl: url,
      prepTime: importedRecipe.prep_time || '',
      cookTime: importedRecipe.cook_time || '',
      totalTime: importedRecipe.total_time || '',
      servings: importedRecipe.servings || 0,
      ingredients: parsedIngredients,
      instructions: decodedInstructions,
      tags: parseTags(decodedKeywords),
      dateAdded: getCurrentTimestamp(),
      dateModified: getCurrentTimestamp(),
    };

    // Auto-detect and add new ingredients to the database
    const ingredientNames = parsedIngredients.map(ing => ing.name);
    try {
      await logger.debug('Starting ingredient auto-detection', { ingredientCount: ingredientNames.length });
      await autoDetectIngredients(ingredientNames);
      await logger.debug('Ingredient auto-detection completed successfully');
    } catch (error) {
      await logger.warn('Failed to auto-detect ingredients, continuing with recipe import', { error: error instanceof Error ? error.message : String(error) });
      // Don't fail the entire import if ingredient detection fails
    }

    // Save the recipe
    await logger.debug('Saving recipe to database', { recipeId: recipe.id, recipeName: recipe.title });
    await saveRecipe(recipe);

    const duration = performance.now() - startTime;
    await logger.logPerformance('Recipe import completed', duration, {
      url,
      recipeId: recipe.id,
      recipeName: recipe.title
    });

    return recipe;

  } catch (error) {
    const duration = performance.now() - startTime;
    await logger.logError(error, 'Failed to import recipe', { url, duration });
    throw new Error(`Failed to import recipe: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Re-export utility functions for convenience
export { formatAmountForDisplay } from '@utils/ingredientUtils';
