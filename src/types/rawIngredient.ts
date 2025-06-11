/**
 * Raw ingredient data captured during recipe import for ingredient parsing analysis
 */
export interface RawIngredient {
  /** Unique identifier for the raw ingredient entry */
  id: string;
  
  /** The original, unparsed ingredient text as it appeared on the source website */
  rawText: string;
  
  /** Source URL where this ingredient was captured from */
  sourceUrl: string;
  
  /** Recipe ID this ingredient belongs to (if available) */
  recipeId?: string;
  
  /** Recipe title for context (if available) */
  recipeTitle?: string;
  
  /** Timestamp when this raw ingredient was captured */
  dateCaptured: string;
}
