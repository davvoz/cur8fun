/**
 * App Version Configuration
 * This file contains versioning information for the PWA.
 * It is updated automatically by the CI/CD workflow.
 */

export const APP_CONFIG = {
  version: '1.0.122',
  buildTimestamp: '2025-07-30T12:53:37Z',
  environment: 'production', // può essere 'development', 'staging', o 'production'
  updateCheckInterval: 60 * 60 * 1000, // 1 ora in millisecondi
  skipUpdateCheck: false, // impostare a true durante lo sviluppo locale
};

/**
 * Verifica se due versioni sono diverse
 * @param {string} currentVersion - La versione attuale
 * @param {string} newVersion - La nuova versione da confrontare
 * @returns {boolean} - True se le versioni sono diverse
 */
export function isNewVersion(currentVersion, newVersion) {
  if (!currentVersion || !newVersion) return false;
  return currentVersion !== newVersion;
}

/**
 * Ottiene la versione corrente dell'applicazione
 * @returns {string} - La versione corrente
 */
export function getAppVersion() {
  return APP_CONFIG.version;
}

/**
 * Ottiene il timestamp di build dell'applicazione
 * @returns {string} - Il timestamp di build
 */
export function getBuildTimestamp() {
  return APP_CONFIG.buildTimestamp;
}