import { invoke } from '@tauri-apps/api/core';
import { Recipe } from '../types';
import { deleteRecipeImage } from '@services/imageService';
import { getCurrentTimestamp } from '@utils/timeUtils';

// Database-backed recipe storage service
// This service now uses SQLite database instead of JSON files

// Save a recipe
export async function saveRecipe(recipe: Recipe): Promise<void> {
  try {
    // Validate required fields
    if (!recipe.sourceUrl) {
      throw new Error('Recipe sourceUrl is required');
    }
    if (!recipe.dateAdded) {
      throw new Error('Recipe dateAdded is required');
    }
    if (!recipe.dateModified) {
      throw new Error('Recipe dateModified is required');
    }

    // The Tauri FrontendRecipe struct expects camelCase fields due to #[serde(rename_all = "camelCase")]
    // So we should send the recipe object directly without field name conversion
    const frontendRecipe = {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      image: recipe.image,
      sourceUrl: recipe.sourceUrl, // Keep camelCase for Tauri serde
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      totalTime: recipe.totalTime,
      servings: recipe.servings,
      ingredients: recipe.ingredients.map(ing => ({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        section: ing.section, // Include section for grouped ingredients
      })),
      instructions: recipe.instructions,
      tags: recipe.tags,
      dateAdded: recipe.dateAdded,
      dateModified: recipe.dateModified,
      rating: recipe.rating,
      difficulty: recipe.difficulty,
      isFavorite: recipe.isFavorite,
      personalNotes: recipe.personalNotes,
      collections: recipe.collections || [], // Ensure collections is always an array
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

// Get recipes with pagination
export async function getRecipesPaginated(page: number, pageSize: number): Promise<Recipe[]> {
  try {
    const frontendRecipes = await invoke<any[]>('db_get_recipes_paginated', { 
      page: page, 
      pageSize: pageSize 
    });
    
    // Convert from Tauri format to frontend Recipe format
    return frontendRecipes.map(convertTauriToFrontendRecipe);
  } catch (error) {
    console.error('Failed to get paginated recipes:', error);
    return [];
  }
}

// Get total recipe count
export async function getRecipeCount(): Promise<number> {
  try {
    const count = await invoke<number>('db_get_recipe_count');
    return count;
  } catch (error) {
    console.error('Failed to get recipe count:', error);
    return 0;
  }
}

// Search recipes with pagination
export async function searchRecipesPaginated(query: string, page: number, pageSize: number): Promise<Recipe[]> {
  try {
    const frontendRecipes = await invoke<any[]>('db_search_recipes_paginated', { 
      query: query,
      page: page, 
      pageSize: pageSize 
    });
    
    return frontendRecipes.map(convertTauriToFrontendRecipe);
  } catch (error) {
    console.error('Failed to search recipes with pagination:', error);
    return [];
  }
}

// Get search results count
export async function getSearchRecipesCount(query: string): Promise<number> {
  try {
    const count = await invoke<number>('db_search_recipes_count', { query: query });
    return count;
  } catch (error) {
    console.error('Failed to get search results count:', error);
    return 0;
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
