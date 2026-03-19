/**
 * Utility functions for parsing and formatting time durations
 */

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

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

/**
 * Format a Date object as a local YYYY-MM-DD string.
 * This preserves the user's calendar day instead of normalizing to UTC.
 */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

/**
 * Parse a YYYY-MM-DD date string into a local Date at midnight.
 */
export function parseDateOnly(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);

  if (!year || !month || !day) {
    return new Date(dateString);
  }

  return new Date(year, month - 1, day);
}

/**
 * Get today's date as a local YYYY-MM-DD string.
 */
export function getTodayLocalDateString(): string {
  return formatLocalDate(new Date());
}

/**
 * Generate current ISO timestamp
 * @returns Current date/time as ISO string
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format date for display
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatDateForDisplay(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
}

/**
 * Format date and time for display
 * @param dateString - ISO date string
 * @returns Formatted date and time string
 */
export function formatDateTimeForDisplay(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return dateString;
  }
}

/**
 * Get relative time string (e.g., "2 hours ago", "yesterday")
 * @param dateString - ISO date string
 * @returns Relative time string
 */
export function getRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return formatDateForDisplay(dateString);
    }
  } catch {
    return dateString;
  }
}
