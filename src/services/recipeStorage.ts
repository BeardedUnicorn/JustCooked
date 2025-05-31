import { invoke } from '@tauri-apps/api/tauri';
import { readTextFile, writeTextFile, createDir } from '@tauri-apps/api/fs';
import { BaseDirectory } from '@tauri-apps/api/path';
import { Recipe } from '../types/recipe';

const RECIPES_DIR = 'recipes';
const RECIPES_INDEX = 'recipes/index.json';

// Ensure the recipes directory exists
async function ensureDirectory() {
  try {
    await createDir(RECIPES_DIR, { dir: BaseDirectory.AppData, recursive: true });
  } catch (error) {
    // Directory may already exist
  }
}

// Save a recipe
export async function saveRecipe(recipe: Recipe): Promise<void> {
  await ensureDirectory();

  // Save the recipe file
  const filename = `${recipe.id}.json`;
  await writeTextFile(
    `${RECIPES_DIR}/${filename}`,
    JSON.stringify(recipe, null, 2),
    { dir: BaseDirectory.AppData }
  );

  // Update the index
  const recipes = await getAllRecipes();
  const existingIndex = recipes.findIndex(r => r.id === recipe.id);

  if (existingIndex >= 0) {
    recipes[existingIndex] = recipe;
  } else {
    recipes.push(recipe);
  }

  await writeTextFile(
    RECIPES_INDEX,
    JSON.stringify(recipes.map(r => ({
      id: r.id,
      title: r.title,
      image: r.image,
      tags: r.tags,
      dateAdded: r.dateAdded,
      dateModified: r.dateModified,
    })), null, 2),
    { dir: BaseDirectory.AppData }
  );
}

// Get all recipes (metadata only)
export async function getAllRecipes(): Promise<Recipe[]> {
  await ensureDirectory();

  try {
    const indexContent = await readTextFile(RECIPES_INDEX, { dir: BaseDirectory.AppData });
    const index = JSON.parse(indexContent);

    return Promise.all(index.map(async (item: any) => {
      try {
        const content = await readTextFile(
          `${RECIPES_DIR}/${item.id}.json`,
          { dir: BaseDirectory.AppData }
        );
        return JSON.parse(content);
      } catch (error) {
        // File may be missing
        return {
          ...item,
          description: '',
          ingredients: [],
          instructions: [],
        };
      }
    }));
  } catch (error) {
    // Index doesn't exist yet
    return [];
  }
}

// Get a specific recipe by ID
export async function getRecipeById(id: string): Promise<Recipe | null> {
  await ensureDirectory();

  try {
    const content = await readTextFile(
      `${RECIPES_DIR}/${id}.json`,
      { dir: BaseDirectory.AppData }
    );
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// Delete a recipe
export async function deleteRecipe(id: string): Promise<void> {
  await ensureDirectory();

  // Delete the recipe file
  await invoke('plugin:fs|remove_file', {
    path: `${RECIPES_DIR}/${id}.json`,
    directory: BaseDirectory.AppData
  });

  // Update the index
  const recipes = await getAllRecipes();
  const filtered = recipes.filter(r => r.id !== id);

  await writeTextFile(
    RECIPES_INDEX,
    JSON.stringify(filtered.map(r => ({
      id: r.id,
      title: r.title,
      image: r.image,
      tags: r.tags,
      dateAdded: r.dateAdded,
      dateModified: r.dateModified,
    })), null, 2),
    { dir: BaseDirectory.AppData }
  );
}
