import { invoke } from '@tauri-apps/api/core';
import { RecipeCollection } from '@app-types';
import { getCurrentTimestamp } from '@utils/timeUtils';

// Database-backed recipe collection storage service
// This service now uses SQLite database instead of localStorage

export const getAllCollections = async (): Promise<RecipeCollection[]> => {
  try {
    return await invoke<RecipeCollection[]>('db_get_all_recipe_collections');
  } catch (error) {
    console.error('Failed to get all collections:', error);
    return [];
  }
};

export const getCollectionById = async (id: string): Promise<RecipeCollection | null> => {
  try {
    const collections = await getAllCollections();
    return collections.find(collection => collection.id === id) || null;
  } catch (error) {
    console.error('Failed to get collection by ID:', error);
    return null;
  }
};

export const saveCollection = async (collection: RecipeCollection): Promise<void> => {
  try {
    const updatedCollection = {
      ...collection,
      dateModified: getCurrentTimestamp(),
    };
    
    await invoke('db_save_recipe_collection', { collection: updatedCollection });
  } catch (error) {
    console.error('Failed to save collection:', error);
    throw new Error('Failed to save collection');
  }
};

export const deleteCollection = async (id: string): Promise<void> => {
  try {
    const deleted = await invoke<boolean>('db_delete_recipe_collection', { id });
    if (!deleted) {
      throw new Error('Collection not found or could not be deleted');
    }
  } catch (error) {
    console.error('Failed to delete collection:', error);
    throw new Error('Failed to delete collection');
  }
};

export const addRecipeToCollection = async (collectionId: string, recipeId: string): Promise<void> => {
  try {
    const collection = await getCollectionById(collectionId);
    if (collection && !collection.recipeIds.includes(recipeId)) {
      collection.recipeIds.push(recipeId);
      await saveCollection(collection);
    }
  } catch (error) {
    console.error('Failed to add recipe to collection:', error);
    throw new Error('Failed to add recipe to collection');
  }
};

export const removeRecipeFromCollection = async (collectionId: string, recipeId: string): Promise<void> => {
  try {
    const collection = await getCollectionById(collectionId);
    if (collection) {
      collection.recipeIds = collection.recipeIds.filter(id => id !== recipeId);
      await saveCollection(collection);
    }
  } catch (error) {
    console.error('Failed to remove recipe from collection:', error);
    throw new Error('Failed to remove recipe from collection');
  }
};

export const createCollection = async (name: string, description?: string): Promise<RecipeCollection> => {
  try {
    const collection: RecipeCollection = {
      id: crypto.randomUUID(),
      name,
      description,
      recipeIds: [],
      dateCreated: getCurrentTimestamp(),
      dateModified: getCurrentTimestamp(),
    };

    await saveCollection(collection);
    return collection;
  } catch (error) {
    console.error('Failed to create collection:', error);
    throw new Error('Failed to create collection');
  }
};

// Get collections that contain a specific recipe
export const getCollectionsForRecipe = async (recipeId: string): Promise<RecipeCollection[]> => {
  try {
    const collections = await getAllCollections();
    return collections.filter(collection => collection.recipeIds.includes(recipeId));
  } catch (error) {
    console.error('Failed to get collections for recipe:', error);
    return [];
  }
};

// Update collection metadata (name, description)
export const updateCollectionMetadata = async (
  id: string, 
  updates: { name?: string; description?: string }
): Promise<RecipeCollection | null> => {
  try {
    const collection = await getCollectionById(id);
    if (!collection) {
      return null;
    }

    const updatedCollection = {
      ...collection,
      ...updates,
      dateModified: getCurrentTimestamp(),
    };

    await saveCollection(updatedCollection);
    return updatedCollection;
  } catch (error) {
    console.error('Failed to update collection metadata:', error);
    return null;
  }
};

// Get collection statistics
export const getCollectionStats = async (id: string): Promise<{
  recipeCount: number;
  lastModified: string;
} | null> => {
  try {
    const collection = await getCollectionById(id);
    if (!collection) {
      return null;
    }

    return {
      recipeCount: collection.recipeIds.length,
      lastModified: collection.dateModified,
    };
  } catch (error) {
    console.error('Failed to get collection stats:', error);
    return null;
  }
};

// Bulk operations
export const addMultipleRecipesToCollection = async (
  collectionId: string, 
  recipeIds: string[]
): Promise<void> => {
  try {
    const collection = await getCollectionById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    // Add only new recipe IDs (avoid duplicates)
    const newRecipeIds = recipeIds.filter(id => !collection.recipeIds.includes(id));
    if (newRecipeIds.length > 0) {
      collection.recipeIds.push(...newRecipeIds);
      await saveCollection(collection);
    }
  } catch (error) {
    console.error('Failed to add multiple recipes to collection:', error);
    throw new Error('Failed to add recipes to collection');
  }
};

export const removeMultipleRecipesFromCollection = async (
  collectionId: string, 
  recipeIds: string[]
): Promise<void> => {
  try {
    const collection = await getCollectionById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }

    collection.recipeIds = collection.recipeIds.filter(id => !recipeIds.includes(id));
    await saveCollection(collection);
  } catch (error) {
    console.error('Failed to remove multiple recipes from collection:', error);
    throw new Error('Failed to remove recipes from collection');
  }
};

// Search collections by name
export const searchCollections = async (query: string): Promise<RecipeCollection[]> => {
  try {
    const collections = await getAllCollections();
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      return collections;
    }

    return collections.filter(collection =>
      collection.name.toLowerCase().includes(normalizedQuery) ||
      (collection.description && collection.description.toLowerCase().includes(normalizedQuery))
    );
  } catch (error) {
    console.error('Failed to search collections:', error);
    return [];
  }
};
