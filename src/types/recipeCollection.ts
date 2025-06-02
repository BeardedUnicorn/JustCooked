export interface RecipeCollection {
  id: string;
  name: string;
  description?: string;
  recipeIds: string[];
  dateCreated: string;
  dateModified: string;
}
