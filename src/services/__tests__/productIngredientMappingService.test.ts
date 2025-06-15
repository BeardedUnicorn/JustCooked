import { ProductIngredientMappingService } from '../productIngredientMappingService';
import { ProductIngredientMapping, CreateProductIngredientMappingRequest } from '@app-types/productIngredientMapping';

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

const mockInvoke = require('@tauri-apps/api/core').invoke;

const mockMapping: ProductIngredientMapping = {
  id: 'mapping-1',
  product_code: '123456789012',
  ingredient_id: 'ingredient-1',
  ingredient_name: 'All-purpose flour',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockMappings: ProductIngredientMapping[] = [
  mockMapping,
  {
    id: 'mapping-2',
    product_code: '123456789013',
    ingredient_id: 'ingredient-2',
    ingredient_name: 'Granulated sugar',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

describe('ProductIngredientMappingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMapping', () => {
    it('should return mapping when it exists', async () => {
      mockInvoke.mockResolvedValue(mockMapping);

      const result = await ProductIngredientMappingService.getMapping('123456789012');

      expect(mockInvoke).toHaveBeenCalledWith('db_get_product_ingredient_mapping', {
        productCode: '123456789012',
      });
      expect(result).toEqual(mockMapping);
    });

    it('should return null when mapping does not exist', async () => {
      mockInvoke.mockResolvedValue(null);

      const result = await ProductIngredientMappingService.getMapping('nonexistent');

      expect(mockInvoke).toHaveBeenCalledWith('db_get_product_ingredient_mapping', {
        productCode: 'nonexistent',
      });
      expect(result).toBeNull();
    });

    it('should return null when API call fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const result = await ProductIngredientMappingService.getMapping('123456789012');

      expect(result).toBeNull();
    });
  });

  describe('createMapping', () => {
    it('should create mapping successfully', async () => {
      const request: CreateProductIngredientMappingRequest = {
        product_code: '123456789012',
        ingredient_id: 'ingredient-1',
      };

      mockInvoke.mockResolvedValue(mockMapping);

      const result = await ProductIngredientMappingService.createMapping(request);

      expect(mockInvoke).toHaveBeenCalledWith('db_create_product_ingredient_mapping', request);
      expect(result).toEqual(mockMapping);
    });

    it('should throw error when creation fails', async () => {
      const request: CreateProductIngredientMappingRequest = {
        product_code: '123456789012',
        ingredient_id: 'ingredient-1',
      };

      mockInvoke.mockRejectedValue(new Error('Database error'));

      await expect(ProductIngredientMappingService.createMapping(request)).rejects.toThrow();
    });
  });

  describe('deleteMapping', () => {
    it('should return true when deletion is successful', async () => {
      mockInvoke.mockResolvedValue(true);

      const result = await ProductIngredientMappingService.deleteMapping('123456789012');

      expect(mockInvoke).toHaveBeenCalledWith('db_delete_product_ingredient_mapping', {
        productCode: '123456789012',
      });
      expect(result).toBe(true);
    });

    it('should return false when deletion fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const result = await ProductIngredientMappingService.deleteMapping('123456789012');

      expect(result).toBe(false);
    });
  });

  describe('getAllMappings', () => {
    it('should return all mappings', async () => {
      mockInvoke.mockResolvedValue(mockMappings);

      const result = await ProductIngredientMappingService.getAllMappings();

      expect(mockInvoke).toHaveBeenCalledWith('db_get_all_product_ingredient_mappings');
      expect(result).toEqual(mockMappings);
    });

    it('should return empty array when API call fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Database error'));

      const result = await ProductIngredientMappingService.getAllMappings();

      expect(result).toEqual([]);
    });
  });
});
