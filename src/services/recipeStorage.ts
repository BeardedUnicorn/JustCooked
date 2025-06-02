import {
  readTextFile,
  writeTextFile,
  mkdir,
  remove,
  BaseDirectory,
  exists
} from '@tauri-apps/plugin-fs';
import { Recipe } from '@app-types';
import { deleteRecipeImage } from '@services/imageService';
import { getCurrentTimestamp } from '@utils/timeUtils';

// Use simpler paths without app name (Tauri handles that)
const RECIPES_DIR = 'recipes';
const RECIPES_INDEX = 'recipes/index.json';

// Ensure the recipes directory exists
async function ensureDirectory() {
  try {
    const dirExists = await exists(RECIPES_DIR, {
      baseDir: BaseDirectory.AppLocalData
    });

    if (!dirExists) {
      await mkdir(RECIPES_DIR, {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true
      });
      console.log('Directory created successfully');
    } else {
      console.log('Directory already exists');
    }
  } catch (error) {
    console.error('Error checking/creating directory:', error);
  }
}

// Save a recipe
export async function saveRecipe(recipe: Recipe): Promise<void> {
  await ensureDirectory();

  try {
    // Save the recipe file
    const filename = `${RECIPES_DIR}/${recipe.id}.json`;
    console.log(`Saving recipe to: ${filename} in AppLocalData`);

    await writeTextFile(filename, JSON.stringify(recipe, null, 2), {
      baseDir: BaseDirectory.AppLocalData
    });

    // Update the index without calling getAllRecipes to avoid circular dependency
    let recipes: Recipe[] = [];

    try {
      const indexExists = await exists(RECIPES_INDEX, {
        baseDir: BaseDirectory.AppLocalData
      });

      if (indexExists) {
        const indexContent = await readTextFile(RECIPES_INDEX, {
          baseDir: BaseDirectory.AppLocalData
        });
        recipes = JSON.parse(indexContent);
      }
    } catch (error) {
      console.log('No existing index, creating new one');
      recipes = [];
    }

    // Find existing recipe or add new one
    const existingIndex = recipes.findIndex(r => r.id === recipe.id);

    if (existingIndex >= 0) {
      recipes[existingIndex] = recipe;
    } else {
      recipes.push(recipe);
    }

    // Save updated index
    const indexData = recipes.map(r => ({
      id: r.id,
      title: r.title,
      image: r.image,
      tags: r.tags,
      dateAdded: r.dateAdded,
      dateModified: r.dateModified,
    }));

    await writeTextFile(RECIPES_INDEX, JSON.stringify(indexData, null, 2), {
      baseDir: BaseDirectory.AppLocalData
    });

    console.log('Recipe saved successfully');
  } catch (error) {
    console.error('Failed to save recipe:', error);
    throw new Error(`Failed to save recipe: ${error}`);
  }
}

// Get all recipes
export async function getAllRecipes(): Promise<Recipe[]> {
  await ensureDirectory();

  try {
    const indexExists = await exists(RECIPES_INDEX, {
      baseDir: BaseDirectory.AppLocalData
    });

    if (!indexExists) {
      console.log('Recipe index not found, returning empty array');
      return [];
    }

    const indexContent = await readTextFile(RECIPES_INDEX, {
      baseDir: BaseDirectory.AppLocalData
    });
    const indexData = JSON.parse(indexContent);

    // Filter out recipes that don't have a corresponding file
    const validRecipes = [];
    const updatedIndex = [];

    for (const item of indexData) {
      try {
        const filePath = `${RECIPES_DIR}/${item.id}.json`;
        const fileExists = await exists(filePath, {
          baseDir: BaseDirectory.AppLocalData
        });

        if (fileExists) {
          const content = await readTextFile(filePath, {
            baseDir: BaseDirectory.AppLocalData
          });
          const recipe = JSON.parse(content);
          validRecipes.push(recipe);
          updatedIndex.push(item);
        } else {
          console.warn(`Recipe file missing for ${item.id} - removing from index`);
        }
      } catch (error) {
        console.warn(`Error reading recipe file for ${item.id}:`, error);
      }
    }

    // Update the index if any recipes were missing
    if (updatedIndex.length !== indexData.length) {
      console.log(`Updating recipe index: ${indexData.length} -> ${updatedIndex.length}`);
      await writeTextFile(RECIPES_INDEX, JSON.stringify(updatedIndex, null, 2), {
        baseDir: BaseDirectory.AppLocalData
      });
    }

    return validRecipes;
  } catch (error) {
    console.debug('Recipe index not found or error reading it:', error);
    return [];
  }
}

// Get a specific recipe by ID
export async function getRecipeById(id: string): Promise<Recipe | null> {
  await ensureDirectory();

  try {
    const filePath = `${RECIPES_DIR}/${id}.json`;
    const fileExists = await exists(filePath, {
      baseDir: BaseDirectory.AppLocalData
    });

    if (!fileExists) {
      return null;
    }

    const content = await readTextFile(filePath, {
      baseDir: BaseDirectory.AppLocalData
    });
    return JSON.parse(content);
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
  await ensureDirectory();

  try {
    // First, get the recipe to check if it has a local image to delete
    const recipe = await getRecipeById(id);

    // Delete the associated image if it exists and is local
    if (recipe && recipe.image) {
      await deleteRecipeImage(recipe.image);
    }

    const filePath = `${RECIPES_DIR}/${id}.json`;
    const fileExists = await exists(filePath, {
      baseDir: BaseDirectory.AppLocalData
    });

    if (fileExists) {
      await remove(filePath, {
        baseDir: BaseDirectory.AppLocalData
      });
    }

    const recipes = await getAllRecipes();
    const filtered = recipes.filter(r => r.id !== id);

    await writeTextFile(RECIPES_INDEX, JSON.stringify(filtered.map(r => ({
      id: r.id,
      title: r.title,
      image: r.image,
      tags: r.tags,
      dateAdded: r.dateAdded,
      dateModified: r.dateModified,
    })), null, 2), {
      baseDir: BaseDirectory.AppLocalData
    });
  } catch (error) {
    console.error('Failed to delete recipe:', error);
    throw new Error('Failed to delete recipe');
  }
}
