import { invoke } from '@tauri-apps/api/core';
import { Recipe } from '@app-types';
import { saveRecipe } from '@services/recipeStorage';
import { autoDetectIngredients } from '@services/ingredientStorage';
import { processRecipeImage } from '@services/imageService';
import {
  parseIngredients
} from '@utils/ingredientUtils';
import { isSupportedUrl } from '@utils/urlUtils';
import { parseTags, decodeAllHtmlEntities } from '@utils/stringUtils';
import { getCurrentTimestamp } from '@utils/timeUtils';

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
    autoDetectIngredients(ingredientNames);

    // Save the recipe
    await saveRecipe(recipe);

    return recipe;

  } catch (error) {
    console.error('Failed to import recipe:', error);
    throw new Error(`Failed to import recipe: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Re-export utility functions for convenience
export { formatAmountForDisplay } from '@utils/ingredientUtils';
