import { invoke } from '@tauri-apps/api/core';
import { ProductIngredientMapping, CreateProductIngredientMappingRequest } from '@app-types/productIngredientMapping';

export class ProductIngredientMappingService {
  /**
   * Get existing mapping for a product code
   */
  static async getMapping(productCode: string): Promise<ProductIngredientMapping | null> {
    try {
      const mapping = await invoke<ProductIngredientMapping | null>('db_get_product_ingredient_mapping', {
        productCode,
      });
      return mapping;
    } catch (error) {
      console.error('Failed to get product ingredient mapping:', error);
      return null;
    }
  }

  /**
   * Create or update a product-ingredient mapping
   */
  static async createMapping(request: CreateProductIngredientMappingRequest): Promise<ProductIngredientMapping | null> {
    try {
      const mapping = await invoke<ProductIngredientMapping>('db_create_product_ingredient_mapping', {
        productCode: request.product_code,
        ingredientId: request.ingredient_id,
      });
      return mapping;
    } catch (error) {
      console.error('Failed to create product ingredient mapping:', error);
      throw error;
    }
  }

  /**
   * Delete a product-ingredient mapping
   */
  static async deleteMapping(productCode: string): Promise<boolean> {
    try {
      await invoke('db_delete_product_ingredient_mapping', {
        productCode,
      });
      return true;
    } catch (error) {
      console.error('Failed to delete product ingredient mapping:', error);
      return false;
    }
  }

  /**
   * Get all mappings
   */
  static async getAllMappings(): Promise<ProductIngredientMapping[]> {
    try {
      const mappings = await invoke<ProductIngredientMapping[]>('db_get_all_product_ingredient_mappings');
      return mappings;
    } catch (error) {
      console.error('Failed to get all product ingredient mappings:', error);
      return [];
    }
  }
}
