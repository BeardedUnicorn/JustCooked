import { invoke } from '@tauri-apps/api/tauri';
import { Recipe } from '../types/recipe';
import { saveRecipe } from './recipeStorage';

export async function importRecipeFromUrl(url: string): Promise<Recipe> {
  try {
    // Using Tauri command to fetch and parse the recipe (to avoid CORS issues)
    const recipeData = await invoke<any>('scrape_recipe', { url });

    // Transform the data to match our Recipe type
    const recipe: Recipe = {
      id: crypto.randomUUID(),
      title: recipeData.name,
      description: recipeData.description || '',
      image: recipeData.image || '',
      sourceUrl: url,
      prepTime: recipeData.prepTime || '',
      cookTime: recipeData.cookTime || '',
      totalTime: recipeData.totalTime || '',
      servings: recipeData.recipeYield ? Number(recipeData.recipeYield) : 0,
      ingredients: recipeData.recipeIngredient.map((item: string) => {
        // Simplified parsing - in a real app you'd want more sophisticated parsing
        const parts = item.split(' ');
        return {
          name: parts.slice(1).join(' '),
          amount: parseFloat(parts[0]) || 0,
          unit: 'unit', // Default unit
        };
      }),
      instructions: Array.isArray(recipeData.recipeInstructions)
        ? recipeData.recipeInstructions
        : [recipeData.recipeInstructions],
      tags: recipeData.keywords ? recipeData.keywords.split(',').map((k: string) => k.trim()) : [],
      dateAdded: new Date().toISOString(),
      dateModified: new Date().toISOString(),
    };

    // Save the recipe
    await saveRecipe(recipe);

    return recipe;
  } catch (error) {
    console.error('Failed to import recipe:', error);
    throw new Error('Failed to import recipe. Please check if the URL is valid and from a supported site.');
  }
}
