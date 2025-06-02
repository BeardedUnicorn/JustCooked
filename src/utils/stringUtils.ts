/**
 * Utility functions for string manipulation and processing
 */

// Parse tags from keywords string
export function parseTags(keywords: string): string[] {
  if (!keywords) return [];

  return keywords
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .slice(0, 10); // Limit to 10 tags
}

// Normalize string for comparison (lowercase, trim, remove extra spaces)
export function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Truncate string to specified length with ellipsis
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

// Capitalize first letter of each word
export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

// Remove HTML tags from string
export function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

// Convert string to slug (URL-friendly format)
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Check if string contains any of the provided keywords
export function containsAnyKeyword(str: string, keywords: string[]): boolean {
  const normalizedStr = normalizeString(str);
  return keywords.some(keyword => 
    normalizedStr.includes(normalizeString(keyword))
  );
}

// Extract numbers from string
export function extractNumbers(str: string): number[] {
  const matches = str.match(/\d+\.?\d*/g);
  return matches ? matches.map(Number) : [];
}

// Clean whitespace and normalize line endings
export function cleanWhitespace(str: string): string {
  return str
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\t/g, ' ') // Replace tabs with spaces
    .replace(/[ ]+/g, ' ') // Replace multiple spaces with single space
    .trim();
}
