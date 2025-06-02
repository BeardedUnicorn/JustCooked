import { NutritionalInfo } from './NutritionalInfo';
import { StorageInfo } from './storageInfo';

export interface IngredientDatabase {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  nutritionalInfo?: NutritionalInfo;
  storageInfo?: StorageInfo;
  dateAdded: string;
  dateModified: string;
}
