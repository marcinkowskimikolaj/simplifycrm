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
        HISTORY_CONTACTS: 'HistoriaKontaktow',
        // Nowe arkusze dla systemu etykiet
        TAGS_COMPANIES: 'TagsFirm',
        TAGS_CONTACTS: 'TagsContact',
        COMPANY_TAGS_RELATIONS: 'CompanyTags',
        CONTACT_TAGS_RELATIONS: 'ContactTags',
        // Arkusz preferencji użytkownika  
        USER_PREFERENCES: 'UserPreferences',
        // Arkusz aktywności
        ACTIVITIES: 'Activities'
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
        VERSION: '2.1.0',
        TAGLINE: 'Twój partner w interesach'
    },
    
    // Tags Configuration
    TAGS: {
        DEFAULT_COLORS: [
            '#ef4444', // red
            '#f97316', // orange
            '#f59e0b', // amber
            '#eab308', // yellow
            '#84cc16', // lime
            '#22c55e', // green
            '#10b981', // emerald
            '#14b8a6', // teal
            '#06b6d4', // cyan
            '#0ea5e9', // sky
            '#3b82f6', // blue
            '#6366f1', // indigo
            '#8b5cf6', // violet
            '#a855f7', // purple
            '#d946ef', // fuchsia
            '#ec4899', // pink
            '#f43f5e', // rose
            '#64748b'  // slate
        ]
    },
    
    // Activities Configuration
    ACTIVITIES: {
        TYPES: {
            EMAIL: {
                id: 'EMAIL',
                label: 'Email',
                icon: '📧',
                color: '#3b82f6',
                requiresTitle: true,
                requiresDate: true
            },
            PHONE: {
                id: 'PHONE',
                label: 'Telefon',
                icon: '📞',
                color: '#10b981',
                requiresTitle: true,
                requiresDate: true
            },
            MEETING: {
                id: 'MEETING',
                label: 'Spotkanie',
                icon: '🤝',
                color: '#8b5cf6',
                requiresTitle: true,
                requiresDate: true
            },
            TASK: {
                id: 'TASK',
                label: 'Zadanie',
                icon: '✅',
                color: '#f59e0b',
                requiresTitle: true,
                requiresDate: false
            }
        },
        STATUSES: {
            PLANNED: 'planned',
            COMPLETED: 'completed',
            CANCELLED: 'cancelled'
        }
    }
};

// Export dla kompatybilności bez ES6 modules
if (typeof window !== 'undefined') {
    window.CRM_CONFIG = CONFIG;
}
