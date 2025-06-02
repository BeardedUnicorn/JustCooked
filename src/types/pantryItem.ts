export interface PantryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: string;
  expiryDate?: string;
}
