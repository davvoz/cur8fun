/**
 * Format a date string or object into a readable format
 * 
 * @param {string|Date} dateString - Date to format
 * @param {Object} options - Additional formatting options
 * @returns {string} Formatted date string
 */
export function formatDate(dateString, options = {}) {
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  // Default formatting options
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  // Merge default options with provided options
  const formatterOptions = { ...defaultOptions, ...options };
  
  // Create formatter
  return new Intl.DateTimeFormat('en-US', formatterOptions).format(date);
}