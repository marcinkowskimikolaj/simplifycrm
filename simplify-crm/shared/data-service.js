/**
 * SIMPLIFY CRM - Data Service
 * ============================
 * Centralne API do komunikacji z Google Sheets
 * Obsługuje CRUD dla wszystkich danych CRM
 */

import { CONFIG } from './config.js';
import { AuthService } from './auth.js';

export class DataService {
    static cache = new Map();
    static CACHE_TTL = CONFIG.SESSION.CACHE_TTL;

    /**
     * Helpers - Cache Management
     */
    static setCache(key, value) {
        this.cache.set(key, { 
            value, 
            timestamp: Date.now() 
        });
    }

    static getCache(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        // Sprawdź czy cache nie wygasł
        if (Date.now() - item.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }

    static clearCache(key = null) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Helpers - Retry Logic
     */
    static async retryRequest(fn, maxRetries = CONFIG.API.MAX_RETRIES) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === maxRetries - 1) {
                    throw error;
                }
                
                // Exponential backoff
                const delay = CONFIG.API.RETRY_DELAY * Math.pow(2, i);
                console.warn(`⚠️ Retry ${i + 1}/${maxRetries} za ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Helpers - ID Generator
     */
    static generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * COMPANIES - Load
     */
    static async loadCompanies(useCache = true) {
        const cacheKey = 'companies';
        
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('✓ Firmy załadowane z cache');
                return cached;
            }
        } 

        return this.retryRequest(async () => {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.COMPANIES}!A2:I`,
            });

            const rows = response.result.values || [];
            const companies = rows.map(row => ({
                id: row[0] || this.generateId(),
                name: row[1] || '',
                industry: row[2] || '',
                notes: row[3] || '',
                website: row[4] || '',
                phone: row[5] || '',
                city: row[6] || '',
                country: row[7] || '',
                domain: row[8] || ''
            })).filter(c => c.name);

            this.setCache(cacheKey, companies);
            console.log(`✓ Załadowano ${companies.length} firm`);
            return companies;
        });
    }

    /**
     * COMPANIES - Save (Create or Update)
     */
    static async saveCompany(company, rowIndex = null) {
        const values = [[
            company.id || this.generateId(),
            company.name || '',
            company.industry || '',
            company.notes || '',
            company.website || '',
            company.phone || '',
            company.city || '',
            company.country || '',
            company.domain || ''
        ]];

        const isUpdate = rowIndex !== null;
        const range = isUpdate
            ? `${CONFIG.SHEETS.COMPANIES}!A${rowIndex + 2}:I${rowIndex + 2}`
            : `${CONFIG.SHEETS.COMPANIES}!A:I`;

        return this.retryRequest(async () => {
            if (isUpdate) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Firma zaktualizowana:', company.name);
            } else {
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Firma dodana:', company.name);
            }

            this.clearCache('companies');
            return values[0][0]; // Return ID
        });
    }

    /**
     * COMPANIES - Delete
     */
    static async deleteCompany(rowIndex) {
        const range = `${CONFIG.SHEETS.COMPANIES}!A${rowIndex + 2}:I${rowIndex + 2}`;

        return this.retryRequest(async () => {
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: CONFIG.SHEET_ID,
                range
            });
            
            this.clearCache('companies');
            console.log('✓ Firma usunięta');
        });
    }

    /**
     * CONTACTS - Load
     */
    static async loadContacts(useCache = true) {
        const cacheKey = 'contacts';
        
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('✓ Kontakty załadowane z cache');
                return cached;
            }
        }

        return this.retryRequest(async () => {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.CONTACTS}!A2:F`,
            });

            const rows = response.result.values || [];
            const contacts = rows.map(row => ({
                id: row[0] || this.generateId(),
                companyId: row[1] || '',
                name: row[2] || '',
                position: row[3] || '',
                email: row[4] || '',
                phone: row[5] || ''
            })).filter(c => c.name);

            this.setCache(cacheKey, contacts);
            console.log(`✓ Załadowano ${contacts.length} kontaktów`);
            return contacts;
        });
    }

    /**
     * CONTACTS - Save (Create or Update)
     */
    static async saveContact(contact, rowIndex = null) {
        const values = [[
            contact.id || this.generateId(),
            contact.companyId || '',
            contact.name || '',
            contact.position || '',
            contact.email || '',
            contact.phone || ''
        ]];

        const isUpdate = rowIndex !== null;
        const range = isUpdate
            ? `${CONFIG.SHEETS.CONTACTS}!A${rowIndex + 2}:F${rowIndex + 2}`
            : `${CONFIG.SHEETS.CONTACTS}!A:F`;

        return this.retryRequest(async () => {
            if (isUpdate) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Kontakt zaktualizowany:', contact.name);
            } else {
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Kontakt dodany:', contact.name);
            }

            this.clearCache('contacts');
            return values[0][0]; // Return ID
        });
    }

    /**
     * CONTACTS - Delete
     */
    static async deleteContact(rowIndex) {
        const range = `${CONFIG.SHEETS.CONTACTS}!A${rowIndex + 2}:F${rowIndex + 2}`;

        return this.retryRequest(async () => {
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: CONFIG.SHEET_ID,
                range
            });
            
            this.clearCache('contacts');
            console.log('✓ Kontakt usunięty');
        });
    }

    /**
     * HISTORY (Companies) - Load
     */
    static async loadCompanyHistory(companyId = null, useCache = true) {
        const cacheKey = companyId ? `history_company_${companyId}` : 'history_companies';
        
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('✓ Historia firm załadowana z cache');
                return cached;
            }
        }

        return this.retryRequest(async () => {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.HISTORY_COMPANIES}!A2:G`,
            });

            const rows = response.result.values || [];
            let history = rows.map(row => ({
                id: row[0] || '',
                companyId: row[1] || '',
                type: row[2] || 'event',
                timestamp: row[3] || '',
                user: row[4] || '',
                content: row[5] || '',
                meta: row[6] || ''
            })).filter(h => h.companyId);

            // Filter by companyId if specified
            if (companyId) {
                history = history.filter(h => h.companyId === companyId);
            }

            this.setCache(cacheKey, history);
            console.log(`✓ Załadowano ${history.length} wpisów historii firm`);
            return history;
        });
    }

    /**
     * HISTORY (Contacts) - Load
     */
    static async loadContactHistory(contactId = null, useCache = true) {
        const cacheKey = contactId ? `history_contact_${contactId}` : 'history_contacts';
        
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('✓ Historia kontaktów załadowana z cache');
                return cached;
            }
        }

        return this.retryRequest(async () => {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.HISTORY_CONTACTS}!A2:G`,
            });

            const rows = response.result.values || [];
            let history = rows.map(row => ({
                id: row[0] || '',
                contactId: row[1] || '',
                type: row[2] || 'event',
                timestamp: row[3] || '',
                user: row[4] || '',
                content: row[5] || '',
                meta: row[6] || ''
            })).filter(h => h.contactId);

            // Filter by contactId if specified
            if (contactId) {
                history = history.filter(h => h.contactId === contactId);
            }

            this.setCache(cacheKey, history);
            console.log(`✓ Załadowano ${history.length} wpisów historii kontaktów`);
            return history;
        });
    }

    /**
     * HISTORY - Log (Companies)
     */
    static async logCompanyHistory(companyId, type, content, meta = '') {
        if (!companyId) {
            console.warn('Brak companyId - historia nie została zapisana');
            return;
        }

        const entry = {
            id: this.generateId(),
            companyId,
            type, // 'note' lub 'event'
            timestamp: new Date().toISOString(),
            user: AuthService.getUserEmail() || '',
            content,
            meta
        };

        const values = [[
            entry.id,
            entry.companyId,
            entry.type,
            entry.timestamp,
            entry.user,
            entry.content,
            entry.meta
        ]];

        return this.retryRequest(async () => {
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.HISTORY_COMPANIES}!A:G`,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            });

            this.clearCache(`history_company_${companyId}`);
            this.clearCache('history_companies');
            console.log('✓ Historia firmy zapisana:', content);
            return entry.id;
        });
    }

    /**
     * HISTORY - Log (Contacts)
     */
    static async logContactHistory(contactId, type, content, meta = '') {
        if (!contactId) {
            console.warn('Brak contactId - historia nie została zapisana');
            return;
        }

        const entry = {
            id: this.generateId(),
            contactId,
            type, // 'note' lub 'event'
            timestamp: new Date().toISOString(),
            user: AuthService.getUserEmail() || '',
            content,
            meta
        };

        const values = [[
            entry.id,
            entry.contactId,
            entry.type,
            entry.timestamp,
            entry.user,
            entry.content,
            entry.meta
        ]];

        return this.retryRequest(async () => {
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.HISTORY_CONTACTS}!A:G`,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            });

            this.clearCache(`history_contact_${contactId}`);
            this.clearCache('history_contacts');
            console.log('✓ Historia kontaktu zapisana:', content);
            return entry.id;
        });
    }

    /**
     * BATCH - Load All Data
     */
    static async loadAllData() {
        console.log('📊 Ładowanie wszystkich danych...');
        
        const [companies, contacts, companyHistory, contactHistory] = await Promise.all([
            this.loadCompanies(),
            this.loadContacts(),
            this.loadCompanyHistory(),
            this.loadContactHistory()
        ]);

        console.log('✓ Wszystkie dane załadowane');
        
        return {
            companies,
            contacts,
            companyHistory,
            contactHistory
        };
    }

    /**
     * UTILITIES - Find company by domain
     */
    static findCompanyByDomain(companies, domain) {
        if (!domain) return null;
        const normalized = domain.toLowerCase().trim();
        return companies.find(c => 
            c.domain && c.domain.toLowerCase().trim() === normalized
        );
    }

    /**
     * UTILITIES - Extract domain from email
     */
    static extractDomain(email) {
        if (!email || !email.includes('@')) return '';
        return email.split('@')[1].toLowerCase().trim();
    }

    /**
     * UTILITIES - Format date/time
     */
    static formatDateTime(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString;
        return date.toLocaleString('pl-PL', {
            dateStyle: 'short',
            timeStyle: 'short'
        });
    }
}

// Export dla kompatybilności bez ES6 modules
if (typeof window !== 'undefined') {
    window.DataService = DataService;
}
