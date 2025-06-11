export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  section?: string; // Optional section for grouped ingredients (e.g., "White Cake Layer", "Glaze")
}
