/**
 * SIMPLIFY CRM - Global Configuration
 * ====================================
 * Centralna konfiguracja dla całej aplikacji
 * Używana przez wszystkie moduły
 */

export const CONFIG = {
    // Google OAuth Client ID
    CLIENT_ID: '567555578754-nsqdiab9suu01a9i1mdgc30vf5g9rq2k.apps.googleusercontent.com',
    
    // Google Sheets Database ID
    SHEET_ID: '1A4vT2_sQnM48Q74jLPqGIT27P8NRdzKwiOsiDdMByJ0',
    
    // Nazwy arkuszy w Google Sheets
    SHEETS: {
        COMPANIES: 'Firmy',
        CONTACTS: 'Kontakty',
        HISTORY_COMPANIES: 'HistoriaFirm',
        HISTORY_CONTACTS: 'HistoriaKontaktow'
    },
    
    // OAuth Scopes
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email',
    
    // Session Configuration
    SESSION: {
        KEY: 'simplify_crm_session',
        TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minut przed wygaśnięciem
        CACHE_TTL: 5 * 60 * 1000 // 5 minut cache
    },
    
    // API Configuration
    API: {
        DISCOVERY_DOCS: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000
    },
    
// Routes (absolute paths for GitHub Pages)
ROUTES: {
    LOGIN: '/simplifycrm/login.html',
    DASHBOARD: '/simplifycrm/index.html',
    RELATIONSHIPS: '/simplifycrm/modules/relationships.html',
    PIPELINE: '/simplifycrm/modules/pipeline.html',
    TASKS: '/simplifycrm/modules/tasks.html',
    ANALYTICS: '/simplifycrm/modules/analytics.html'
},
    
    // App Info
    APP: {
        NAME: 'Simplify CRM',
        VERSION: '2.0.0',
        TAGLINE: 'Twój partner w interesach'
    }
};

// Export dla kompatybilności bez ES6 modules
if (typeof window !== 'undefined') {
    window.CRM_CONFIG = CONFIG;
}
