export interface ProductIngredientMapping {
  id: string;
  product_code: string;
  ingredient_id: string;
  ingredient_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProductIngredientMappingRequest {
  product_code: string;
  ingredient_id: string;
}

export interface IngredientAssociation {
  ingredient_id: string;
  ingredient_name: string;
}
