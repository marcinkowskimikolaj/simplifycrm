 /**
 * SIMPLIFY CRM - Authentication Service
 * ======================================
 * Zarządzanie autoryzacją i sesją użytkownika
 * Wspólny dla wszystkich modułów
 */

import { CONFIG } from './config.js';

export class AuthService {
    static SESSION_KEY = CONFIG.SESSION.KEY;
    static TOKEN_REFRESH_THRESHOLD = CONFIG.SESSION.TOKEN_REFRESH_THRESHOLD;

    /**
     * Sprawdza czy użytkownik jest zalogowany
     * @returns {boolean}
     */
    static isAuthenticated() {
        const session = this.getSession();
        if (!session || !session.accessToken) {
            return false;
        }
        
        // Sprawdź czy token nie wygasł
        if (session.tokenExpiry && Date.now() > session.tokenExpiry) {
            console.warn('Token wygasł');
            this.clearSession();
            return false;
        }
        
        return true;
    }

    /**
     * Pobiera sesję z localStorage
     * @returns {Object|null}
     */
    static getSession() {
        try {
            const raw = localStorage.getItem(this.SESSION_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (error) {
            console.error('Błąd parsowania sesji:', error);
            return null;
        }
    }

    /**
     * Zapisuje sesję do localStorage
     * @param {string} accessToken - Token OAuth
     * @param {string} email - Email użytkownika
     * @param {number} expiresIn - Czas życia tokenu w sekundach (domyślnie 3600)
     */
    static saveSession(accessToken, email, expiresIn = 3600) {
        const session = {
            accessToken,
            email,
            tokenExpiry: Date.now() + (expiresIn * 1000),
            lastActivity: Date.now(),
            savedAt: new Date().toISOString()
        };
        
        try {
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
            console.log('✓ Sesja zapisana:', email);
            return true;
        } catch (error) {
            console.error('Błąd zapisu sesji:', error);
            return false;
        }
    }

    /**
     * Aktualizuje ostatnią aktywność
     */
    static updateActivity() {
        const session = this.getSession();
        if (session) {
            session.lastActivity = Date.now();
            localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        }
    }

    /**
     * Czyści sesję
     */
    static clearSession() {
        localStorage.removeItem(this.SESSION_KEY);
        console.log('✓ Sesja wyczyszczona');
    }

    /**
     * Pobiera access token
     * @returns {string|null}
     */
    static getAccessToken() {
        const session = this.getSession();
        return session ? session.accessToken : null;
    }

    /**
     * Pobiera email użytkownika
     * @returns {string|null}
     */
    static getUserEmail() {
        const session = this.getSession();
        return session ? session.email : null;
    }

    /**
     * Przekierowuje na stronę logowania
     */
    static redirectToLogin() {
        // Zapisz obecny URL jako returnUrl
        const returnUrl = window.location.pathname + window.location.search;
        if (returnUrl !== CONFIG.ROUTES.LOGIN) {
            sessionStorage.setItem('returnUrl', returnUrl);
        }
        
        window.location.href = CONFIG.ROUTES.LOGIN;
    }

    /**
     * Przekierowuje na dashboard
     */
    static redirectToDashboard() {
        window.location.href = CONFIG.ROUTES.DASHBOARD;
    }

    /**
     * Guard - wymaga autoryzacji na chronionej stronie
     * Jeśli użytkownik nie jest zalogowany, przekierowuje na login
     * @returns {boolean} - true jeśli zalogowany, false jeśli przekierowano
     */
    static requireAuth() {
        if (!this.isAuthenticated()) {
            console.warn('⚠️ Brak autoryzacji - przekierowanie na login');
            this.redirectToLogin();
            return false;
        }
        
        // Aktualizuj aktywność
        this.updateActivity();
        return true;
    }

    /**
     * Sprawdza czy token niedługo wygaśnie
     * @returns {boolean}
     */
    static shouldRefreshToken() {
        const session = this.getSession();
        if (!session || !session.tokenExpiry) return false;
        
        const timeToExpiry = session.tokenExpiry - Date.now();
        return timeToExpiry < this.TOKEN_REFRESH_THRESHOLD;
    }

    /**
     * Inicjalizuje Google APIs (GAPI)
     * @returns {Promise<void>}
     */
    static async initializeGoogleAPIs() {
        return new Promise((resolve, reject) => {
            if (typeof gapi === 'undefined') {
                reject(new Error('GAPI nie jest załadowane'));
                return;
            }

            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: '', // API Key nie jest wymagany dla OAuth
                        discoveryDocs: CONFIG.API.DISCOVERY_DOCS,
                    });
                    console.log('✓ GAPI client zainicjalizowany');
                    resolve();
                } catch (error) {
                    console.error('✗ Błąd inicjalizacji GAPI:', error);
                    reject(error);
                }
            });
        });
    }

    /**
     * Inicjalizuje token client (GIS)
     * @returns {Object} Token client
     */
    static initializeTokenClient(callback) {
        if (typeof google === 'undefined' || !google.accounts) {
            throw new Error('Google Identity Services nie są załadowane');
        }

        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.CLIENT_ID,
            scope: CONFIG.SCOPES,
            callback: callback
        });

        console.log('✓ GIS token client zainicjalizowany');
        return tokenClient;
    }

    /**
     * Wylogowuje użytkownika
     * @param {boolean} revokeToken - Czy odwołać token w Google (domyślnie true)
     */
    static logout(revokeToken = true) {
        const token = gapi.client.getToken();
        
        if (revokeToken && token !== null && typeof google !== 'undefined') {
            try {
                google.accounts.oauth2.revoke(token.access_token);
                console.log('✓ Token odwołany w Google');
            } catch (error) {
                console.warn('Nie udało się odwołać tokenu:', error);
            }
        }
        
        if (typeof gapi !== 'undefined' && gapi.client) {
            gapi.client.setToken(null);
        }
        
        this.clearSession();
        this.redirectToLogin();
    }

    /**
     * Pobiera informacje o użytkowniku z Google API
     * @param {string} accessToken
     * @returns {Promise<Object>}
     */
    static async getUserInfo(accessToken) {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 
                Authorization: `Bearer ${accessToken}` 
            }
        });
        
        if (!response.ok) {
            throw new Error('Nie udało się pobrać informacji o użytkowniku');
        }
        
        return await response.json();
    }

    /**
     * Ustawia token w GAPI client
     */
    static setGAPIToken() {
        const accessToken = this.getAccessToken();
        if (accessToken && typeof gapi !== 'undefined' && gapi.client) {
            gapi.client.setToken({ access_token: accessToken });
            console.log('✓ Token ustawiony w GAPI');
        }
    }

    /**
     * Sprawdza i wyświetla informacje o sesji (debug)
     */
    static debugSession() {
        const session = this.getSession();
        if (!session) {
            console.log('🔒 Brak sesji');
            return;
        }

        const now = Date.now();
        const timeToExpiry = session.tokenExpiry - now;
        const minutesToExpiry = Math.floor(timeToExpiry / 60000);

        console.log('🔓 Sesja aktywna:', {
            email: session.email,
            tokenExpiry: new Date(session.tokenExpiry).toLocaleString('pl-PL'),
            minutesToExpiry: minutesToExpiry,
            lastActivity: new Date(session.lastActivity).toLocaleString('pl-PL'),
            savedAt: session.savedAt
        });
    }
}

// Export dla kompatybilności bez ES6 modules
if (typeof window !== 'undefined') {
    window.AuthService = AuthService;
}
