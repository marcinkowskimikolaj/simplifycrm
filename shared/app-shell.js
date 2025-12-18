/**
 * SIMPLIFY CRM - App Shell Helpers
 * =================================
 * Wspólne klocki dla stron:
 * - inicjalizacja GAPI
 * - pobranie preferencji użytkownika (displayName)
 * - ustawienie headera (nazwa wyświetlana, logout, logo)
 */

import { CONFIG } from './config.js';
import { AuthService } from './auth.js';
import { DataService } from './data-service.js';



async function ensureGapiLoaded(timeoutMs = 15000) {
  if (typeof window === 'undefined') return;
  if (window.gapi && window.gapi.client) return;

  const existing = document.querySelector('script[data-gapi-loader="1"]');
  if (!existing) {
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.async = true;
    s.defer = true;
    s.dataset.gapiLoader = '1';
    document.head.appendChild(s);
  }

  const start = Date.now();
  await new Promise((resolve, reject) => {
    const tick = () => {
      if (window.gapi) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('GAPI nie jest załadowane'));
      setTimeout(tick, 50);
    };
    tick();
  });
}
/**
 * Uruchamia standardową inicjalizację strony chronionej.
 *
 * @param {Object} opts
 * @param {string} [opts.userEmailId='userEmail'] - id elementu, w którym pokazujemy nazwę użytkownika
 * @param {string} [opts.logoSelector='.app-logo'] - selektor logo w headerze
 * @param {'dashboard'|'reload'|null} [opts.logoAction='dashboard'] - co ma robić klik w logo
 * @param {string} [opts.logoutBtnId='logoutBtn'] - id przycisku wylogowania
 * @param {boolean} [opts.confirmLogout=true] - czy pytać o potwierdzenie wylogowania
 * @returns {Promise<{email: string|null, displayName: string|null, displayText: string}>}
 */
export async function bootstrapProtectedPage(opts = {}) {
  const {
    userEmailId = 'userEmail',
    logoSelector = '.app-logo',
    logoAction = 'dashboard',
    logoutBtnId = 'logoutBtn',
    confirmLogout = true,
  } = opts;

  // 1) Auth guard
  if (!AuthService.requireAuth()) {
    throw new Error('Unauthorized');
  }

  // 2) Header interactions should work ASAP (no waiting for GAPI)
  const logo = document.querySelector(logoSelector);
  if (logo && logoAction) {
    logo.addEventListener('click', () => {
      if (logoAction === 'reload') {
        window.location.reload();
        return;
      }
      window.location.href = CONFIG.ROUTES.DASHBOARD;
    });
  }

  const logoutBtn = document.getElementById(logoutBtnId);
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (!confirmLogout || confirm('Czy na pewno chcesz się wylogować?')) {
        AuthService.logout();
      }
    });
  }

  // 3) Initial header user label (from session/localStorage)
  const userEl = document.getElementById(userEmailId);
  if (userEl) {
    userEl.textContent = AuthService.getUserDisplayText();
  }

  // 4) Ensure GAPI script & client
  await ensureGapiLoaded();
  await AuthService.initializeGoogleAPIs();
  AuthService.setGAPIToken();

  // 5) Load user preferences (displayName) from Sheets and refresh header
  const email = AuthService.getUserEmail();
  if (email) {
    try {
      const prefs = await DataService.loadUserPreferences(email);
      if (prefs && typeof prefs.displayName === 'string') {
        AuthService.saveDisplayName(prefs.displayName);
        if (userEl) {
          userEl.textContent = AuthService.getUserDisplayText();
        }
      }
    } catch (e) {
      console.warn('Nie udało się załadować preferencji użytkownika:', e);
    }
  }

  return {
    email: email || null,
    displayName: AuthService.getDisplayName() || null,
    displayText: AuthService.getUserDisplayText(),
  };
}
