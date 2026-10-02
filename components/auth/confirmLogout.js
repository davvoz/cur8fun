import authService from '../../services/AuthService.js';
import DialogUtility from '../DialogUtility.js';

/**
 * Asks the user to confirm before logging out (avoids misclicks). If other
 * accounts are saved, logout switches to one of them: the message says which.
 * @returns {Promise<boolean>} true if the user confirmed
 */
export default async function confirmLogout() {
  const user = authService.getCurrentUser();
  if (!user) return false;

  const next = authService.getStoredAccounts().find(a => a.username !== user.username);
  return DialogUtility.showConfirmationDialog({
    title: 'Log out',
    message: next
      ? `Log out of @${user.username}? You will be switched to @${next.username}.`
      : `Log out of @${user.username}?`,
    confirmText: 'Log out',
    cancelText: 'Cancel',
    icon: 'logout',
    type: 'warning',
    compact: true
  });
}
