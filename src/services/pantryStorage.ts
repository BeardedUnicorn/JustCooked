import { invoke } from '@tauri-apps/api/core';
import { PantryItem } from '@app-types';
import { getCurrentTimestamp } from '@utils/timeUtils';

// Get all pantry items from database
export async function getPantryItems(): Promise<PantryItem[]> {
  try {
    return await invoke<PantryItem[]>('db_get_all_pantry_items');
  } catch (error) {
    console.error('Error getting pantry items:', error);
    return [];
  }
}

// Save pantry item to database
async function savePantryItem(item: PantryItem): Promise<void> {
  try {
    await invoke('db_save_pantry_item', { item });
  } catch (error) {
    console.error('Failed to save pantry item:', error);
    throw error;
  }
}

// Add a pantry item
export async function addPantryItem(item: Omit<PantryItem, 'id' | 'dateAdded' | 'dateModified'>): Promise<void> {
  const newItem: PantryItem = {
    ...item,
    id: crypto.randomUUID(),
    dateAdded: getCurrentTimestamp(),
    dateModified: getCurrentTimestamp(),
  };

  await savePantryItem(newItem);
}

// Update a pantry item
export async function updatePantryItem(updatedItem: PantryItem): Promise<void> {
  const itemWithUpdatedDate: PantryItem = {
    ...updatedItem,
    dateModified: getCurrentTimestamp(),
  };

  await savePantryItem(itemWithUpdatedDate);
}

// Delete a pantry item
export async function deletePantryItem(id: string): Promise<void> {
  try {
    const deleted = await invoke<boolean>('db_delete_pantry_item', { id });
    if (!deleted) {
      throw new Error('Pantry item not found');
    }
  } catch (error) {
    console.error('Failed to delete pantry item:', error);
    if (error instanceof Error && error.message === 'Pantry item not found') {
      throw error;
    }
    throw new Error('Failed to delete pantry item');
  }
}

// Get pantry item by ID
export async function getPantryItemById(id: string): Promise<PantryItem | null> {
  try {
    const items = await getPantryItems();
    return items.find(item => item.id === id) || null;
  } catch (error) {
    console.error('Failed to get pantry item by ID:', error);
    return null;
  }
}

// Search pantry items by ingredient name
export async function searchPantryItems(query: string): Promise<PantryItem[]> {
  try {
    const items = await getPantryItems();
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) {
      return items;
    }
    
    return items.filter(item => 
      item.name.toLowerCase().includes(normalizedQuery) ||
      (item.location && item.location.toLowerCase().includes(normalizedQuery)) ||
      (item.notes && item.notes.toLowerCase().includes(normalizedQuery))
    );
  } catch (error) {
    console.error('Failed to search pantry items:', error);
    return [];
  }
}

// Get pantry items by ingredient name
export async function getPantryItemsByIngredient(ingredientName: string): Promise<PantryItem[]> {
  try {
    const items = await getPantryItems();
    return items.filter(item => 
      item.name.toLowerCase() === ingredientName.toLowerCase()
    );
  } catch (error) {
    console.error('Failed to get pantry items by ingredient:', error);
    return [];
  }
}

// Get expiring items (within specified days)
export async function getExpiringItems(withinDays: number = 7): Promise<PantryItem[]> {
  try {
    const items = await getPantryItems();
    const now = new Date();
    const futureDate = new Date(now.getTime() + (withinDays * 24 * 60 * 60 * 1000));
    
    return items.filter(item => {
      if (!item.expiryDate) return false;
      
      const expiryDate = new Date(item.expiryDate);
      return expiryDate <= futureDate && expiryDate >= now;
    }).sort((a, b) => {
      if (!a.expiryDate || !b.expiryDate) return 0;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
  } catch (error) {
    console.error('Failed to get expiring items:', error);
    return [];
  }
}

// Get expired items
export async function getExpiredItems(): Promise<PantryItem[]> {
  try {
    const items = await getPantryItems();
    const now = new Date();
    
    return items.filter(item => {
      if (!item.expiryDate) return false;
      
      const expiryDate = new Date(item.expiryDate);
      return expiryDate < now;
    }).sort((a, b) => {
      if (!a.expiryDate || !b.expiryDate) return 0;
      return new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime();
    });
  } catch (error) {
    console.error('Failed to get expired items:', error);
    return [];
  }
}

// Get pantry items grouped by location
export async function getPantryItemsByLocation(): Promise<Record<string, PantryItem[]>> {
  try {
    const items = await getPantryItems();
    const grouped: Record<string, PantryItem[]> = {};
    
    for (const item of items) {
      const location = item.location || 'Unspecified';
      if (!grouped[location]) {
        grouped[location] = [];
      }
      grouped[location].push(item);
    }
    
    return grouped;
  } catch (error) {
    console.error('Failed to get pantry items by location:', error);
    return {};
  }
}

// Update pantry item quantity
export async function updatePantryItemQuantity(id: string, newQuantity: number): Promise<void> {
  try {
    const item = await getPantryItemById(id);
    if (!item) {
      throw new Error('Pantry item not found');
    }
    
    const updatedItem: PantryItem = {
      ...item,
      amount: newQuantity,
      dateModified: getCurrentTimestamp(),
    };
    
    await updatePantryItem(updatedItem);
  } catch (error) {
    console.error('Failed to update pantry item quantity:', error);
    throw new Error('Failed to update pantry item quantity');
  }
}

// Bulk delete pantry items
export async function bulkDeletePantryItems(ids: string[]): Promise<void> {
  try {
    const deletePromises = ids.map(id => deletePantryItem(id));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Failed to bulk delete pantry items:', error);
    throw new Error('Failed to delete some pantry items');
  }
}
