import { getFromStorage, setToStorage } from '@utils/storageUtils';
import { cleanIngredientName } from '@utils/ingredientUtils';

export interface UseItUpExclusions {
  ingredients: string[];
  recipeIds: string[];
}

const STORAGE_KEY = 'useItUpExclusions';
const EMPTY: UseItUpExclusions = { ingredients: [], recipeIds: [] };

export function normalizeIngredientKey(name: string): string {
  return cleanIngredientName(name).toLowerCase();
}

export function getExclusions(): UseItUpExclusions {
  const stored = getFromStorage<UseItUpExclusions>(STORAGE_KEY, EMPTY);
  return {
    ingredients: Array.isArray(stored.ingredients) ? stored.ingredients : [],
    recipeIds: Array.isArray(stored.recipeIds) ? stored.recipeIds : [],
  };
}

function save(exclusions: UseItUpExclusions): UseItUpExclusions {
  setToStorage(STORAGE_KEY, exclusions);
  return exclusions;
}

export function excludeIngredient(name: string): UseItUpExclusions {
  const current = getExclusions();
  const key = normalizeIngredientKey(name);
  if (current.ingredients.includes(key)) return current;
  return save({ ...current, ingredients: [...current.ingredients, key] });
}

export function restoreIngredient(name: string): UseItUpExclusions {
  const current = getExclusions();
  const key = normalizeIngredientKey(name);
  return save({ ...current, ingredients: current.ingredients.filter((i) => i !== key) });
}

export function excludeRecipe(id: string): UseItUpExclusions {
  const current = getExclusions();
  if (current.recipeIds.includes(id)) return current;
  return save({ ...current, recipeIds: [...current.recipeIds, id] });
}

export function restoreRecipe(id: string): UseItUpExclusions {
  const current = getExclusions();
  return save({ ...current, recipeIds: current.recipeIds.filter((r) => r !== id) });
}
