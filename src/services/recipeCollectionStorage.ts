import { RecipeCollection } from '@app-types';
import { getCurrentTimestamp } from '@utils/timeUtils';
import { getFromStorage, setToStorage } from '@utils/storageUtils';

const COLLECTIONS_STORAGE_KEY = 'recipe_collections';

export const getAllCollections = (): RecipeCollection[] => {
  return getFromStorage(COLLECTIONS_STORAGE_KEY, []);
};

export const getCollectionById = (id: string): RecipeCollection | null => {
  const collections = getAllCollections();
  return collections.find(collection => collection.id === id) || null;
};

export const saveCollection = (collection: RecipeCollection): void => {
  const collections = getAllCollections();
  const existingIndex = collections.findIndex(c => c.id === collection.id);

  if (existingIndex >= 0) {
    collections[existingIndex] = { ...collection, dateModified: getCurrentTimestamp() };
  } else {
    collections.push(collection);
  }

  setToStorage(COLLECTIONS_STORAGE_KEY, collections);
};

export const deleteCollection = (id: string): void => {
  const collections = getAllCollections();
  const filtered = collections.filter(collection => collection.id !== id);
  setToStorage(COLLECTIONS_STORAGE_KEY, filtered);
};

export const addRecipeToCollection = (collectionId: string, recipeId: string): void => {
  const collection = getCollectionById(collectionId);
  if (collection && !collection.recipeIds.includes(recipeId)) {
    collection.recipeIds.push(recipeId);
    saveCollection(collection);
  }
};

export const removeRecipeFromCollection = (collectionId: string, recipeId: string): void => {
  const collection = getCollectionById(collectionId);
  if (collection) {
    collection.recipeIds = collection.recipeIds.filter(id => id !== recipeId);
    saveCollection(collection);
  }
};

export const createCollection = (name: string, description?: string): RecipeCollection => {
  const collection: RecipeCollection = {
    id: crypto.randomUUID(),
    name,
    description,
    recipeIds: [],
    dateCreated: getCurrentTimestamp(),
    dateModified: getCurrentTimestamp(),
  };

  saveCollection(collection);
  return collection;
};
