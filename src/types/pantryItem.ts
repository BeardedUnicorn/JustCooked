export interface PantryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category?: string;
  expiryDate?: string;
  location?: string;
  notes?: string;
  dateAdded?: string;
  dateModified?: string;
}
