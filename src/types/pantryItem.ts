export interface PantryItem {
  id: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  expiryDate?: string;
  location?: string;
  notes?: string;
  dateAdded: string;
  dateModified: string;
}
