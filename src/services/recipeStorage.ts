import { invoke } from '@tauri-apps/api/core';
import { Recipe } from '../types';
import { deleteRecipeImage } from '@services/imageService';
import { getCurrentTimestamp } from '@utils/timeUtils';

// Database-backed recipe storage service
// This service now uses SQLite database instead of JSON files

// Save a recipe
export async function saveRecipe(recipe: Recipe): Promise<void> {
  try {
    // Convert frontend Recipe to the format expected by Tauri command
    const frontendRecipe = {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      image: recipe.image,
      source_url: recipe.sourceUrl,
      prep_time: recipe.prepTime,
      cook_time: recipe.cookTime,
      total_time: recipe.totalTime,
      servings: recipe.servings,
      ingredients: recipe.ingredients.map(ing => ({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
      })),
      instructions: recipe.instructions,
      tags: recipe.tags,
      date_added: recipe.dateAdded,
      date_modified: recipe.dateModified,
      rating: recipe.rating,
      difficulty: recipe.difficulty,
      is_favorite: recipe.isFavorite,
      personal_notes: recipe.personalNotes,
      collections: recipe.collections,
    };

    await invoke('db_save_recipe', { recipe: frontendRecipe });
    console.log('Recipe saved successfully to database');
  } catch (error) {
    console.error('Failed to save recipe:', error);
    throw new Error(`Failed to save recipe: ${error}`);
  }
}

// Get all recipes
export async function getAllRecipes(): Promise<Recipe[]> {
  try {
    const frontendRecipes = await invoke<any[]>('db_get_all_recipes');
    
    // Convert from Tauri format to frontend Recipe format
    return frontendRecipes.map(convertTauriToFrontendRecipe);
  } catch (error) {
    console.error('Failed to get all recipes:', error);
    return [];
  }
}

// Get a specific recipe by ID
export async function getRecipeById(id: string): Promise<Recipe | null> {
  try {
    const frontendRecipe = await invoke<any | null>('db_get_recipe_by_id', { id });
    
    if (!frontendRecipe) {
      return null;
    }
    
    return convertTauriToFrontendRecipe(frontendRecipe);
  } catch (error) {
    console.warn(`Recipe not found: ${id}`, error);
    return null;
  }
}

// Update a recipe
export async function updateRecipe(recipe: Recipe): Promise<void> {
  // Update the dateModified field
  const updatedRecipe = {
    ...recipe,
    dateModified: getCurrentTimestamp(),
  };

  // Use the existing saveRecipe function which handles both create and update
  await saveRecipe(updatedRecipe);
}

// Delete a recipe
export async function deleteRecipe(id: string): Promise<void> {
  try {
    // First, get the recipe to check if it has a local image to delete
    const recipe = await getRecipeById(id);

    // Delete the associated image if it exists and is local
    if (recipe && recipe.image) {
      await deleteRecipeImage(recipe.image);
    }

    const deleted = await invoke<boolean>('db_delete_recipe', { id });
    
    if (!deleted) {
      throw new Error('Recipe not found or could not be deleted');
    }
  } catch (error) {
    console.error('Failed to delete recipe:', error);
    throw new Error('Failed to delete recipe');
  }
}

// Get all existing recipe source URLs
export async function getExistingRecipeUrls(): Promise<string[]> {
  try {
    return await invoke<string[]>('db_get_existing_recipe_urls');
  } catch (error) {
    console.error('Failed to get existing recipe URLs:', error);
    return [];
  }
}

// Search recipes
export async function searchRecipes(query: string): Promise<Recipe[]> {
  try {
    const frontendRecipes = await invoke<any[]>('db_search_recipes', { query });
    
    return frontendRecipes.map(convertTauriToFrontendRecipe);
  } catch (error) {
    console.error('Failed to search recipes:', error);
    return [];
  }
}

// Get recipes by tag
export async function getRecipesByTag(tag: string): Promise<Recipe[]> {
  try {
    const frontendRecipes = await invoke<any[]>('db_get_recipes_by_tag', { tag });
    
    return frontendRecipes.map(convertTauriToFrontendRecipe);
  } catch (error) {
    console.error('Failed to get recipes by tag:', error);
    return [];
  }
}

// Get favorite recipes
export async function getFavoriteRecipes(): Promise<Recipe[]> {
  try {
    const frontendRecipes = await invoke<any[]>('db_get_favorite_recipes');
    
    return frontendRecipes.map(convertTauriToFrontendRecipe);
  } catch (error) {
    console.error('Failed to get favorite recipes:', error);
    return [];
  }
}

// Migrate JSON recipes to database
export async function migrateJsonRecipes(): Promise<number> {
  try {
    const migratedCount = await invoke<number>('db_migrate_json_recipes');
    console.log(`Migrated ${migratedCount} recipes from JSON to database`);
    return migratedCount;
  } catch (error) {
    console.error('Failed to migrate JSON recipes:', error);
    return 0;
  }
}

// Helper function to convert Tauri format to frontend Recipe format
function convertTauriToFrontendRecipe(tauriRecipe: any): Recipe {
  return {
    id: tauriRecipe.id,
    title: tauriRecipe.title,
    description: tauriRecipe.description,
    image: tauriRecipe.image,
    sourceUrl: tauriRecipe.source_url,
    prepTime: tauriRecipe.prep_time,
    cookTime: tauriRecipe.cook_time,
    totalTime: tauriRecipe.total_time,
    servings: tauriRecipe.servings,
    ingredients: tauriRecipe.ingredients.map((ing: any) => ({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
    })),
    instructions: tauriRecipe.instructions,
    tags: tauriRecipe.tags,
    dateAdded: tauriRecipe.date_added,
    dateModified: tauriRecipe.date_modified,
    rating: tauriRecipe.rating,
    difficulty: tauriRecipe.difficulty,
    isFavorite: tauriRecipe.is_favorite,
    personalNotes: tauriRecipe.personal_notes,
    collections: tauriRecipe.collections || [],
    nutritionalInfo: tauriRecipe.nutritional_info,
  };
}
