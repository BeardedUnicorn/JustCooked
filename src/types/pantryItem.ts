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
  // Product information for items added via product search
  productCode?: string;
  productName?: string;
  brands?: string;
}
