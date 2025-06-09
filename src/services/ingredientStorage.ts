import { invoke } from '@tauri-apps/api/core';
import { IngredientDatabase, IngredientSearchResult } from '@app-types';
import { cleanIngredientName, detectIngredientCategory } from '@utils/ingredientUtils';
import { getCurrentTimestamp } from '@utils/timeUtils';

// Load ingredients from database
export async function loadIngredients(): Promise<IngredientDatabase[]> {
  try {
    return await invoke<IngredientDatabase[]>('db_get_all_ingredients');
  } catch (error) {
    console.error('Failed to load ingredients:', error);
    return [];
  }
}

// Save ingredient to database
export async function saveIngredient(ingredient: IngredientDatabase): Promise<void> {
  try {
    await invoke('db_save_ingredient', { ingredient });
  } catch (error) {
    console.error('Failed to save ingredient:', error);
    throw error;
  }
}

// Add a new ingredient
export async function addIngredient(ingredient: Omit<IngredientDatabase, 'id' | 'dateAdded' | 'dateModified'>): Promise<IngredientDatabase> {
  const newIngredient: IngredientDatabase = {
    ...ingredient,
    id: crypto.randomUUID(),
    dateAdded: getCurrentTimestamp(),
    dateModified: getCurrentTimestamp(),
  };
  
  await saveIngredient(newIngredient);
  return newIngredient;
}

// Update an existing ingredient
export async function updateIngredient(id: string, updates: Partial<IngredientDatabase>): Promise<IngredientDatabase | null> {
  try {
    const ingredients = await loadIngredients();
    const existing = ingredients.find(ing => ing.id === id);
    
    if (!existing) {
      return null;
    }
    
    const updated: IngredientDatabase = {
      ...existing,
      ...updates,
      dateModified: getCurrentTimestamp(),
    };
    
    await saveIngredient(updated);
    return updated;
  } catch (error) {
    console.error('Failed to update ingredient:', error);
    return null;
  }
}

// Delete an ingredient
export async function deleteIngredient(id: string): Promise<boolean> {
  try {
    return await invoke<boolean>('db_delete_ingredient', { id });
  } catch (error) {
    console.error('Failed to delete ingredient:', error);
    return false;
  }
}

// Search ingredients by name (fuzzy search)
export async function searchIngredients(query: string): Promise<IngredientSearchResult[]> {
  try {
    const ingredients = await invoke<IngredientDatabase[]>('db_search_ingredients', { query });
    
    // Convert to search results with scoring
    const results: IngredientSearchResult[] = ingredients.map(ingredient => {
      const normalizedQuery = query.toLowerCase().trim();
      const normalizedName = ingredient.name.toLowerCase();
      
      let score = 1;
      let matchType: 'exact' | 'alias' | 'fuzzy' = 'fuzzy';
      
      // Exact match
      if (normalizedName === normalizedQuery) {
        score = 1;
        matchType = 'exact';
      }
      // Alias match
      else if (ingredient.aliases.some(alias => alias.toLowerCase() === normalizedQuery)) {
        score = 0.9;
        matchType = 'alias';
      }
      // Fuzzy match (contains)
      else if (normalizedName.includes(normalizedQuery)) {
        score = normalizedQuery.length / normalizedName.length;
        matchType = 'fuzzy';
      }
      // Fuzzy match in aliases
      else {
        for (const alias of ingredient.aliases) {
          if (alias.toLowerCase().includes(normalizedQuery)) {
            score = (normalizedQuery.length / alias.length) * 0.8;
            matchType = 'fuzzy';
            break;
          }
        }
      }
      
      return {
        ingredient,
        score,
        matchType,
      };
    });
    
    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('Failed to search ingredients:', error);
    return [];
  }
}

// Find ingredient by exact name or alias
export async function findIngredientByName(name: string): Promise<IngredientDatabase | null> {
  try {
    const ingredients = await loadIngredients();
    const normalizedName = name.toLowerCase().trim();
    
    return ingredients.find(ingredient => 
      ingredient.name.toLowerCase() === normalizedName ||
      ingredient.aliases.some(alias => alias.toLowerCase() === normalizedName)
    ) || null;
  } catch (error) {
    console.error('Failed to find ingredient by name:', error);
    return null;
  }
}

// Auto-detect and add new ingredients from recipe imports
export async function autoDetectIngredients(ingredientNames: string[]): Promise<IngredientDatabase[]> {
  const newIngredients: IngredientDatabase[] = [];

  for (const name of ingredientNames) {
    const cleanName = cleanIngredientName(name);
    const existing = await findIngredientByName(cleanName);

    if (!existing) {
      const category = detectIngredientCategory(cleanName);
      const newIngredient = await addIngredient({
        name: cleanName,
        category: category.id,
        aliases: [],
      });
      newIngredients.push(newIngredient);
    }
  }

  return newIngredients;
}

// Initialize default ingredients if database is empty
export async function initializeDefaultIngredients(): Promise<void> {
  try {
    const existing = await loadIngredients();
    if (existing.length === 0) {
      const defaultIngredients = [
        { name: 'Salt', category: 'herbs', aliases: ['table salt', 'sea salt', 'kosher salt'] },
        { name: 'Black Pepper', category: 'herbs', aliases: ['pepper', 'ground black pepper'] },
        { name: 'Olive Oil', category: 'oils', aliases: ['extra virgin olive oil', 'EVOO'] },
        { name: 'Garlic', category: 'vegetables', aliases: ['garlic cloves', 'fresh garlic'] },
        { name: 'Onion', category: 'vegetables', aliases: ['yellow onion', 'white onion', 'sweet onion'] },
        { name: 'Butter', category: 'dairy', aliases: ['unsalted butter', 'salted butter'] },
        { name: 'All-Purpose Flour', category: 'baking', aliases: ['flour', 'AP flour', 'plain flour'] },
        { name: 'Sugar', category: 'baking', aliases: ['white sugar', 'granulated sugar', 'caster sugar'] },
        { name: 'Eggs', category: 'dairy', aliases: ['egg', 'large eggs', 'chicken eggs'] },
        { name: 'Milk', category: 'dairy', aliases: ['whole milk', '2% milk', 'skim milk'] },
      ];
      
      for (const ingredient of defaultIngredients) {
        await addIngredient(ingredient);
      }
    }
  } catch (error) {
    console.error('Failed to initialize default ingredients:', error);
  }
}
