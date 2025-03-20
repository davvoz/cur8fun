/**
 * Utility per funzioni di logging nell'applicazione
 */

/**
 * Log raw data in a copy-friendly format
 * @param {string} label - Label for the log
 * @param {any} data - Data to log
 * @param {boolean} enableLogging - Whether logging is enabled
 */
export function logRawData(label, data, enableLogging = true) {
  if (!enableLogging) return;
  
  console.group(`📋 ${label} - Click to expand/collapse`);
  console.log('%c Copy the data below:', 'font-weight: bold; color: #3498db;');
  console.log('%c -----------------------------------------------', 'color: #7f8c8d');
  
  if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
  
  console.log('%c -----------------------------------------------', 'color: #7f8c8d');
  console.log('%c Right-click and "Copy object" or select text and copy', 'font-style: italic; color: #7f8c8d');
  console.groupEnd();
}

export default {
  logRawData
};
