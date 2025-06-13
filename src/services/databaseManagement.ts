import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { DatabaseExport, DatabaseImportResult } from '@app-types';

export class DatabaseManagementService {
  /**
   * Export the entire database to a JSON file
   */
  async exportDatabase(): Promise<void> {
    try {
      // Get the database export data from the backend
      const exportData: DatabaseExport = await invoke('db_export_database');

      // Show save dialog
      const filePath = await save({
        title: 'Export Database',
        defaultPath: `justcooked-backup-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          {
            name: 'JSON Files',
            extensions: ['json']
          },
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      });

      if (!filePath) {
        throw new Error('Export cancelled by user');
      }

      // Write the export data to the selected file
      await writeTextFile(filePath, JSON.stringify(exportData, null, 2));

    } catch (error) {
      console.error('Failed to export database:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to export database');
    }
  }

  /**
   * Import database from a JSON file
   */
  async importDatabase(replaceExisting: boolean = false): Promise<DatabaseImportResult> {
    try {
      // Show open dialog
      const filePath = await open({
        title: 'Import Database',
        multiple: false,
        filters: [
          {
            name: 'JSON Files',
            extensions: ['json']
          },
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      });

      if (!filePath) {
        throw new Error('Import cancelled by user');
      }

      // Read the file content
      const fileContent = await readTextFile(filePath as string);
      
      // Parse the JSON data
      let importData: DatabaseExport;
      try {
        importData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid JSON file format');
      }

      // Validate the import data structure
      this.validateImportData(importData);

      // Import the data using the backend
      const result: DatabaseImportResult = await invoke('db_import_database', {
        data: importData,
        replaceExisting
      });

      return result;

    } catch (error) {
      console.error('Failed to import database:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to import database');
    }
  }

  /**
   * Reset/clear the entire database
   */
  async resetDatabase(): Promise<void> {
    try {
      await invoke('db_reset_database');
    } catch (error) {
      console.error('Failed to reset database:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to reset database');
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      const [
        recipeCount,
        // Add other counts as needed
      ] = await Promise.all([
        invoke<number>('db_get_recipe_count'),
        // Add other count calls
      ]);

      return {
        total_recipes: recipeCount,
        total_ingredients: 0, // TODO: Add ingredient count endpoint
        total_pantry_items: 0, // TODO: Add pantry count endpoint
        total_collections: 0, // TODO: Add collection count endpoint
        total_searches: 0, // TODO: Add search count endpoint
        total_raw_ingredients: 0, // TODO: Add raw ingredient count endpoint
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get database statistics');
    }
  }

  /**
   * Validate the structure of import data
   */
  private validateImportData(data: any): void {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data: not an object');
    }

    if (!data.version) {
      throw new Error('Invalid import data: missing version');
    }

    if (!data.export_date) {
      throw new Error('Invalid import data: missing export date');
    }

    // Check for required arrays
    const requiredArrays = [
      'recipes',
      'ingredients', 
      'pantry_items',
      'recipe_collections',
      'recent_searches',
      'raw_ingredients'
    ];

    for (const arrayName of requiredArrays) {
      if (!Array.isArray(data[arrayName])) {
        throw new Error(`Invalid import data: ${arrayName} is not an array`);
      }
    }
  }

  /**
   * Format import result for display
   */
  formatImportResult(result: DatabaseImportResult): string {
    const parts: string[] = [];
    
    if (result.recipes_imported > 0) {
      parts.push(`${result.recipes_imported} recipes`);
    }
    if (result.ingredients_imported > 0) {
      parts.push(`${result.ingredients_imported} ingredients`);
    }
    if (result.pantry_items_imported > 0) {
      parts.push(`${result.pantry_items_imported} pantry items`);
    }
    if (result.collections_imported > 0) {
      parts.push(`${result.collections_imported} collections`);
    }
    if (result.searches_imported > 0) {
      parts.push(`${result.searches_imported} searches`);
    }
    if (result.raw_ingredients_imported > 0) {
      parts.push(`${result.raw_ingredients_imported} raw ingredients`);
    }

    const successMessage = parts.length > 0 
      ? `Successfully imported: ${parts.join(', ')}`
      : 'No data was imported';

    const failureCount = result.recipes_failed + result.ingredients_failed + 
                        result.pantry_items_failed + result.collections_failed + 
                        result.searches_failed + result.raw_ingredients_failed;

    const failureMessage = failureCount > 0 
      ? `\n${failureCount} items failed to import`
      : '';

    return successMessage + failureMessage;
  }
}

export const databaseManagementService = new DatabaseManagementService();
