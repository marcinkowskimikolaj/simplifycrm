import { AuthService } from '../shared/auth.js';
import { DataService } from '../shared/data-service.js';

        // Sprawdź czy użytkownik jest już zalogowany
        if (AuthService.isAuthenticated()) {
            console.log('✓ Użytkownik już zalogowany - przekierowanie na dashboard');
            AuthService.redirectToDashboard();
        }

        let gapiInited = false;
        let gisInited = false;
        let tokenClient;

        const loginBtn = document.getElementById('loginBtn');
        const loginBtnText = document.getElementById('loginBtnText');
        const statusMessage = document.getElementById('statusMessage');

        /**
         * Pokazuje status message
         */
        function showStatus(message, type = 'info') {
            statusMessage.textContent = message;
            statusMessage.className = `status-message visible ${type}`;
            setTimeout(() => {
                statusMessage.classList.remove('visible');
            }, 5000);
        }

        /**
         * GAPI loaded callback
         */
        window.gapiLoaded = function() {
            console.log('✓ Google API (gapi) loaded');
            gapi.load('client', initializeGapiClient);
        };

        /**
         * Initialize GAPI client
         */
        async function initializeGapiClient() {
            try {
                await AuthService.initializeGoogleAPIs();
                gapiInited = true;
                console.log('✓ GAPI client initialized');
                maybeEnableButton();
            } catch (error) {
                console.error('✗ Błąd inicjalizacji GAPI:', error);
                showStatus('Błąd ładowania Google API', 'error');
            }
        }

        /**
         * GIS loaded callback
         */
        window.gisLoaded = function() {
            console.log('✓ Google Identity Services (GIS) loaded');
            try {
                tokenClient = AuthService.initializeTokenClient(handleAuthCallback);
                gisInited = true;
                console.log('✓ GIS token client initialized');
                maybeEnableButton();
            } catch (error) {
                console.error('✗ Błąd inicjalizacji GIS:', error);
                showStatus('Błąd konfiguracji logowania', 'error');
            }
        };

        /**
         * Enable button when both APIs are ready
         */
        function maybeEnableButton() {
            if (gapiInited && gisInited) {
                loginBtn.disabled = false;
                console.log('✓ Przycisk logowania aktywny');
            }
        }

        /**
         * Handle authorization callback
         */
        async function handleAuthCallback(response) {
            if (response.error !== undefined) {
                console.error('Błąd autoryzacji:', response);
                showStatus('Błąd logowania: ' + response.error, 'error');
                resetButton();
                return;
            }

            try {
                // Pobierz access token
                let accessToken = response.access_token;
                if (!accessToken && gapi.client.getToken()) {
                    accessToken = gapi.client.getToken().access_token;
                }

                if (!accessToken) {
                    throw new Error('Brak access token');
                }

                // Ustaw token w GAPI
                gapi.client.setToken({ access_token: accessToken });

                // Pobierz informacje o użytkowniku
                showStatus('Pobieranie danych użytkownika...', 'info');
                const userInfo = await AuthService.getUserInfo(accessToken);
                const email = userInfo.email || '';

                // Zapisz sesję
                const expiresIn = response.expires_in || 3600;
                AuthService.saveSession(accessToken, email, expiresIn);

                // Załaduj preferencje użytkownika (display name)
                try {
                    const prefs = await DataService.loadUserPreferences(email, false);
                    if (prefs && prefs.displayName) {
                        AuthService.saveDisplayName(prefs.displayName);
                        console.log('✓ Preferencje użytkownika załadowane:', prefs.displayName);
                    }
                } catch (prefError) {
                    console.warn('Nie udało się załadować preferencji (może nie istnieć arkusz):', prefError);
                    // Kontynuuj nawet jeśli preferencje nie zostały załadowane
                }

                console.log('✓ Logowanie zakończone sukcesem:', email);
                showStatus('Logowanie zakończone - przekierowanie...', 'info');

                // Przekieruj na dashboard po 1 sekundzie
                setTimeout(() => {
                    // Sprawdź czy był returnUrl
                    const returnUrl = sessionStorage.getItem('returnUrl');
                    if (returnUrl) {
                        sessionStorage.removeItem('returnUrl');
                        window.location.href = returnUrl;
                    } else {
                        AuthService.redirectToDashboard();
                    }
                }, 1000);

            } catch (error) {
                console.error('Błąd podczas logowania:', error);
                showStatus('Błąd podczas logowania: ' + error.message, 'error');
                resetButton();
            }
        }

                return {
                    email: userPref[0] || '',
                    displayName: userPref[1] || '',
                    createdAt: userPref[2] || '',
                    updatedAt: userPref[3] || ''
                };
            } catch (error) {
                console.warn('Nie można załadować preferencji użytkownika:', error);
                return null;
            }
        }

        /**
         * Reset button state
         */
        function resetButton() {
            loginBtn.disabled = false;
            loginBtnText.innerHTML = 'Zaloguj przez Google';
        }

        /**
         * Handle login button click
         */
        loginBtn.addEventListener('click', async function() {
            if (!tokenClient) {
                showStatus('Token client nie jest gotowy', 'error');
                return;
            }

            // Disable button and show loading
            loginBtn.disabled = true;
            loginBtnText.innerHTML = '<span class="spinner"></span>Logowanie...';

            try {
                // Check if already has a valid token
                const existingToken = gapi.client.getToken();
                if (existingToken === null) {
                    // Request new token with consent
                    tokenClient.requestAccessToken({ prompt: 'consent' });
                } else {
                    // Request new token without consent
                    tokenClient.requestAccessToken({ prompt: '' });
                }
            } catch (error) {
                console.error('Błąd requestAccessToken:', error);
                showStatus('Błąd autoryzacji', 'error');
                resetButton();
            }
        });

// Timeout dla ładowania bibliotek (backup)
setTimeout(() => {
    if (!gapiInited || !gisInited) {
        loginBtn.disabled = true;
        loginBtnText.textContent = '⚠️ Błąd ładowania';
        showStatus('Nie udało się załadować bibliotek Google. Odśwież stronę (Ctrl+Shift+R).', 'error');
    }
}, 15000);

// Polling mechanism - sprawdzaj czy skrypty się załadowały
let checkCount = 0;
const maxChecks = 75; // 75 × 200ms = 15 sekund

function checkScriptsLoaded() {
    checkCount++;
    
    // Sprawdź GAPI
    if (!gapiInited && typeof gapi !== 'undefined') {
        console.log('✓ GAPI wykryte - inicjalizacja...');
        window.gapiLoaded();
    }
    
    // Sprawdź GIS
    if (!gisInited && typeof google !== 'undefined' && google.accounts) {
        console.log('✓ GIS wykryte - inicjalizacja...');
        window.gisLoaded();
    }
    
    // Jeśli oba załadowane - koniec
    if (gapiInited && gisInited) {
        console.log('✓ Wszystkie biblioteki gotowe!');
        return;
    }
    
    // Jeśli nie przekroczono limitu - sprawdź ponownie
    if (checkCount < maxChecks) {
        setTimeout(checkScriptsLoaded, 200);
    } else {
        console.error('✗ Timeout - biblioteki nie załadowały się w czasie');
    }
}

// Start polling po 500ms (daj szansę skryptom zacząć ładowanie)
setTimeout(checkScriptsLoaded, 500);
