/**
 * ZeBongo — auth.js
 * Auth guard utilities shared across all pages.
 */

import { onAuthChange } from './firebase.js';

/**
 * Returns a Promise that resolves to the current user, or
 * redirects to index.html if no session is active.
 * Call at the top of every protected page (menu, game, editor, profile).
 *
 * Usage:
 *   import { requireAuth } from './js/auth.js';
 *   const user = await requireAuth();
 */
export function requireAuth(redirectTo = 'index.html') {
  return new Promise((resolve, reject) => {
    const unsub = onAuthChange(user => {
      unsub();
      if (user) {
        resolve(user);
      } else {
        window.location.href = redirectTo;
        reject(new Error('Not authenticated'));
      }
    });
  });
}

/**
 * If the user is already logged in, redirect them away from the login page.
 * Usage: call at the top of index.html so logged-in users skip the login form.
 */
export function redirectIfLoggedIn(to = 'menu.html') {
  return new Promise(resolve => {
    const unsub = onAuthChange(user => {
      unsub();
      if (user) window.location.href = to;
      else resolve();
    });
  });
}