/**
 * Utility functions for parsing and formatting time durations
 */

/**
 * Parse ISO 8601 duration string (e.g., "PT50M", "PT1H30M", "PT2H") to human-readable format
 * @param duration - ISO 8601 duration string
 * @returns Human-readable time string (e.g., "50 minutes", "1 hour 30 minutes")
 */
export function parseIsoDuration(duration: string): string {
  if (!duration || duration.trim() === '') {
    return '';
  }

  // Handle non-ISO duration formats that might already be human-readable
  if (!duration.startsWith('PT')) {
    return duration;
  }

  // Remove 'PT' prefix and parse the duration
  const timeString = duration.slice(2);
  
  // Extract hours and minutes using regex
  const hourMatch = timeString.match(/(\d+)H/);
  const minuteMatch = timeString.match(/(\d+)M/);
  
  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
  
  // Format the result
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }
  
  if (parts.length === 0) {
    return '0 minutes';
  }
  
  return parts.join(' ');
}

/**
 * Format time for display, handling both ISO 8601 durations and regular strings
 * @param timeValue - Time value (could be ISO 8601 duration or regular string)
 * @returns Formatted time string
 */
export function formatTimeForDisplay(timeValue: string): string {
  if (!timeValue || timeValue.trim() === '') {
    return '';
  }
  
  // If it looks like an ISO 8601 duration, parse it
  if (timeValue.startsWith('PT')) {
    return parseIsoDuration(timeValue);
  }
  
  // Otherwise, return as-is
  return timeValue;
}

/**
 * Calculate total time from prep and cook times if total time is not available
 * @param prepTime - Prep time string
 * @param cookTime - Cook time string
 * @param totalTime - Total time string (if available)
 * @returns Formatted total time string
 */
export function calculateTotalTime(prepTime: string, cookTime: string, totalTime: string): string {
  // If total time is provided and valid, use it
  if (totalTime && totalTime.trim() !== '') {
    return formatTimeForDisplay(totalTime);
  }
  
  // Otherwise, try to calculate from prep + cook time
  const formattedPrepTime = formatTimeForDisplay(prepTime);
  const formattedCookTime = formatTimeForDisplay(cookTime);
  
  if (formattedPrepTime && formattedCookTime) {
    return `${formattedPrepTime} + ${formattedCookTime}`;
  } else if (formattedPrepTime) {
    return formattedPrepTime;
  } else if (formattedCookTime) {
    return formattedCookTime;
  }
  
  return '';
}
