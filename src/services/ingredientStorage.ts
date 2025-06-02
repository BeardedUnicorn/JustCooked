import { IngredientDatabase, IngredientSearchResult } from '@app-types';
import { cleanIngredientName, detectIngredientCategory } from '@utils/ingredientUtils';
import { getCurrentTimestamp } from '@utils/timeUtils';

const STORAGE_KEY = 'justcooked_ingredients';

// Load ingredients from localStorage
export function loadIngredients(): IngredientDatabase[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load ingredients:', error);
  }
  return getDefaultIngredients();
}

// Save ingredients to localStorage
export function saveIngredients(ingredients: IngredientDatabase[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ingredients));
  } catch (error) {
    console.error('Failed to save ingredients:', error);
  }
}

// Add a new ingredient
export function addIngredient(ingredient: Omit<IngredientDatabase, 'id' | 'dateAdded' | 'dateModified'>): IngredientDatabase {
  const ingredients = loadIngredients();
  
  const newIngredient: IngredientDatabase = {
    ...ingredient,
    id: crypto.randomUUID(),
    dateAdded: getCurrentTimestamp(),
    dateModified: getCurrentTimestamp(),
  };
  
  ingredients.push(newIngredient);
  saveIngredients(ingredients);
  
  return newIngredient;
}

// Update an existing ingredient
export function updateIngredient(id: string, updates: Partial<IngredientDatabase>): IngredientDatabase | null {
  const ingredients = loadIngredients();
  const index = ingredients.findIndex(ing => ing.id === id);
  
  if (index === -1) {
    return null;
  }
  
  ingredients[index] = {
    ...ingredients[index],
    ...updates,
    dateModified: getCurrentTimestamp(),
  };
  
  saveIngredients(ingredients);
  return ingredients[index];
}

// Delete an ingredient
export function deleteIngredient(id: string): boolean {
  const ingredients = loadIngredients();
  const index = ingredients.findIndex(ing => ing.id === id);
  
  if (index === -1) {
    return false;
  }
  
  ingredients.splice(index, 1);
  saveIngredients(ingredients);
  return true;
}

// Search ingredients by name (fuzzy search)
export function searchIngredients(query: string): IngredientSearchResult[] {
  const ingredients = loadIngredients();
  const normalizedQuery = query.toLowerCase().trim();
  
  if (!normalizedQuery) {
    return ingredients.map(ingredient => ({
      ingredient,
      score: 1,
      matchType: 'exact' as const,
    }));
  }
  
  const results: IngredientSearchResult[] = [];
  
  for (const ingredient of ingredients) {
    const normalizedName = ingredient.name.toLowerCase();
    
    // Exact match
    if (normalizedName === normalizedQuery) {
      results.push({
        ingredient,
        score: 1,
        matchType: 'exact',
      });
      continue;
    }
    
    // Alias match
    const aliasMatch = ingredient.aliases.some(alias => 
      alias.toLowerCase() === normalizedQuery
    );
    if (aliasMatch) {
      results.push({
        ingredient,
        score: 0.9,
        matchType: 'alias',
      });
      continue;
    }
    
    // Fuzzy match (contains)
    if (normalizedName.includes(normalizedQuery)) {
      const score = normalizedQuery.length / normalizedName.length;
      results.push({
        ingredient,
        score,
        matchType: 'fuzzy',
      });
      continue;
    }
    
    // Fuzzy match in aliases
    for (const alias of ingredient.aliases) {
      if (alias.toLowerCase().includes(normalizedQuery)) {
        const score = (normalizedQuery.length / alias.length) * 0.8;
        results.push({
          ingredient,
          score,
          matchType: 'fuzzy',
        });
        break;
      }
    }
  }
  
  // Sort by score (highest first)
  return results.sort((a, b) => b.score - a.score);
}

// Find ingredient by exact name or alias
export function findIngredientByName(name: string): IngredientDatabase | null {
  const ingredients = loadIngredients();
  const normalizedName = name.toLowerCase().trim();
  
  return ingredients.find(ingredient => 
    ingredient.name.toLowerCase() === normalizedName ||
    ingredient.aliases.some(alias => alias.toLowerCase() === normalizedName)
  ) || null;
}

// Auto-detect and add new ingredients from recipe imports
export function autoDetectIngredients(ingredientNames: string[]): IngredientDatabase[] {
  const newIngredients: IngredientDatabase[] = [];

  for (const name of ingredientNames) {
    const cleanName = cleanIngredientName(name);
    const existing = findIngredientByName(cleanName);

    if (!existing) {
      const category = detectIngredientCategory(cleanName);
      const newIngredient = addIngredient({
        name: cleanName,
        category: category.id,
        aliases: [],
      });
      newIngredients.push(newIngredient);
    }
  }

  return newIngredients;
}





// Get default ingredients (common ingredients to start with)
function getDefaultIngredients(): IngredientDatabase[] {
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
  
  return defaultIngredients.map(ingredient => ({
    ...ingredient,
    id: crypto.randomUUID(),
    dateAdded: getCurrentTimestamp(),
    dateModified: getCurrentTimestamp(),
  }));
}
