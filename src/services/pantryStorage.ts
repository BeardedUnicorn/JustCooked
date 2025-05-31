import {
  readTextFile,
  writeTextFile,
  mkdir,
  BaseDirectory,
  exists
} from '@tauri-apps/plugin-fs';
import { PantryItem } from '@app-types/recipe';

const PANTRY_DIR = 'pantry';
const PANTRY_FILE = 'pantry/items.json';

// Ensure the pantry directory exists
async function ensureDirectory() {
  try {
    const dirExists = await exists(PANTRY_DIR, {
      baseDir: BaseDirectory.AppLocalData
    });

    if (!dirExists) {
      await mkdir(PANTRY_DIR, {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true
      });
      console.log('Pantry directory created successfully');
    }
  } catch (error) {
    console.debug('Pantry directory check/create result:', error);
  }
}

// Get all pantry items
export async function getPantryItems(): Promise<PantryItem[]> {
  await ensureDirectory();

  try {
    const fileExists = await exists(PANTRY_FILE, {
      baseDir: BaseDirectory.AppLocalData
    });

    if (!fileExists) {
      return [];
    }

    const content = await readTextFile(PANTRY_FILE, {
      baseDir: BaseDirectory.AppLocalData
    });
    return JSON.parse(content);
  } catch (error) {
    console.debug('Error getting pantry items:', error);
    return [];
  }
}

// Save all pantry items
async function savePantryItems(items: PantryItem[]): Promise<void> {
  await ensureDirectory();
  await writeTextFile(PANTRY_FILE, JSON.stringify(items, null, 2), {
    baseDir: BaseDirectory.AppLocalData
  });
}

// Add a pantry item
export async function addPantryItem(item: PantryItem): Promise<void> {
  const items = await getPantryItems();
  items.push(item);
  await savePantryItems(items);
}

// Update a pantry item
export async function updatePantryItem(updatedItem: PantryItem): Promise<void> {
  const items = await getPantryItems();
  const index = items.findIndex(item => item.id === updatedItem.id);

  if (index >= 0) {
    items[index] = updatedItem;
    await savePantryItems(items);
  }
}

// Delete a pantry item
export async function deletePantryItem(id: string): Promise<void> {
  const items = await getPantryItems();
  const filteredItems = items.filter(item => item.id !== id);
  await savePantryItems(filteredItems);
}
