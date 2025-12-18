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
            user: AuthService.getUserDisplayText() || AuthService.getUserEmail() || '',
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
            user: AuthService.getUserDisplayText() || AuthService.getUserEmail() || '',
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

    // ============= TAGS FOR COMPANIES =============

/**
 * TAGS (Companies) - Load all company tags
 */
    static async loadCompanyTags(useCache = true) {
        const cacheKey = 'tags_companies';
    
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('✓ Etykiety firm załadowane z cache');
                return cached;
            }
        }

        return this.retryRequest(async () => {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.TAGS_COMPANIES}!A2:F`,
            });

            const rows = response.result.values || [];
            const tags = rows.map(row => ({
                id: row[0] || this.generateId(),
                name: row[1] || '',
                color: row[2] || '#3b82f6',
                description: row[3] || '',
                createdBy: row[4] || '',
                createdAt: row[5] || ''
            })).filter(t => t.name);

            this.setCache(cacheKey, tags);
            console.log(`✓ Załadowano ${tags.length} etykiet firm`);
            return tags;
        });
    }

    /**
     * TAGS (Companies) - Save (Create or Update)
     */
    static async saveCompanyTag(tag, rowIndex = null) {
        const values = [[
            tag.id || this.generateId(),
            tag.name || '',
            tag.color || '#3b82f6',
            tag.description || '',
            tag.createdBy || AuthService.getUserEmail() || '',
            tag.createdAt || new Date().toISOString()
        ]];

        const isUpdate = rowIndex !== null;
        const range = isUpdate
            ? `${CONFIG.SHEETS.TAGS_COMPANIES}!A${rowIndex + 2}:F${rowIndex + 2}`
            : `${CONFIG.SHEETS.TAGS_COMPANIES}!A:F`;

        return this.retryRequest(async () => {
            if (isUpdate) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Etykieta firmy zaktualizowana:', tag.name);
            } else {
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Etykieta firmy dodana:', tag.name);
            }

            this.clearCache('tags_companies');
            return values[0][0]; // Return ID
        });
    }

    /**
     * TAGS (Companies) - Delete
     */
    static async deleteCompanyTag(rowIndex) {
        const range = `${CONFIG.SHEETS.TAGS_COMPANIES}!A${rowIndex + 2}:F${rowIndex + 2}`;

        return this.retryRequest(async () => {
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: CONFIG.SHEET_ID,
                range
            });
        
            this.clearCache('tags_companies');
            console.log('✓ Etykieta firmy usunięta');
        });
    }

    /**
     * COMPANY-TAG RELATIONS - Load
     */
    static async loadCompanyTagRelations(companyId = null, useCache = true) {
        const cacheKey = companyId ? `company_tags_${companyId}` : 'company_tag_relations';
    
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('✓ Relacje etykiet firm załadowane z cache');
                return cached;
            }
        }

        return this.retryRequest(async () => {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.COMPANY_TAGS_RELATIONS}!A2:E`,
            });

            const rows = response.result.values || [];
            let relations = rows.map(row => ({
                id: row[0] || '',
                companyId: row[1] || '',
                tagId: row[2] || '',
                assignedBy: row[3] || '',
                assignedAt: row[4] || ''
            })).filter(r => r.companyId && r.tagId);

            if (companyId) {
                relations = relations.filter(r => r.companyId === companyId);
            }

            this.setCache(cacheKey, relations);
            console.log(`✓ Załadowano ${relations.length} relacji etykiet firm`);
            return relations;
        });
    }

    /**
     * COMPANY-TAG RELATIONS - Assign tag to company
     */
    static async assignTagToCompany(companyId, tagId) {
        const values = [[
            this.generateId(),
            companyId,
            tagId,
            AuthService.getUserEmail() || '',
            new Date().toISOString()
        ]];

        return this.retryRequest(async () => {
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.COMPANY_TAGS_RELATIONS}!A:E`,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            });

            this.clearCache(`company_tags_${companyId}`);
            this.clearCache('company_tag_relations');
            console.log('✓ Etykieta przypisana do firmy');
            return values[0][0];
        });
    }

    /**
     * COMPANY-TAG RELATIONS - Remove tag from company
     */
    static async removeTagFromCompany(relationId, rowIndex) {
        const range = `${CONFIG.SHEETS.COMPANY_TAGS_RELATIONS}!A${rowIndex + 2}:E${rowIndex + 2}`;

        return this.retryRequest(async () => {
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: CONFIG.SHEET_ID,
                range
            });
        
            this.clearCache('company_tag_relations');
            console.log('✓ Etykieta usunięta z firmy');
        });
    }

    // ============= TAGS FOR CONTACTS =============

    /**
     * TAGS (Contacts) - Load all contact tags
     */
    static async loadContactTags(useCache = true) {
        const cacheKey = 'tags_contacts';
    
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('✓ Etykiety kontaktów załadowane z cache');
                return cached;
            }
        }

        return this.retryRequest(async () => {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.TAGS_CONTACTS}!A2:F`,
            });

            const rows = response.result.values || [];
            const tags = rows.map(row => ({
                id: row[0] || this.generateId(),
                name: row[1] || '',
                color: row[2] || '#3b82f6',
                description: row[3] || '',
                createdBy: row[4] || '',
                createdAt: row[5] || ''
            })).filter(t => t.name);

            this.setCache(cacheKey, tags);
            console.log(`✓ Załadowano ${tags.length} etykiet kontaktów`);
            return tags;
        });
    }

    /**
     * TAGS (Contacts) - Save (Create or Update)
     */
    static async saveContactTag(tag, rowIndex = null) {
        const values = [[
            tag.id || this.generateId(),
            tag.name || '',
            tag.color || '#3b82f6',
            tag.description || '',
            tag.createdBy || AuthService.getUserEmail() || '',
            tag.createdAt || new Date().toISOString()
        ]];

        const isUpdate = rowIndex !== null;
        const range = isUpdate
            ? `${CONFIG.SHEETS.TAGS_CONTACTS}!A${rowIndex + 2}:F${rowIndex + 2}`
            : `${CONFIG.SHEETS.TAGS_CONTACTS}!A:F`;

        return this.retryRequest(async () => {
            if (isUpdate) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Etykieta kontaktu zaktualizowana:', tag.name);
            } else {
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Etykieta kontaktu dodana:', tag.name);
            }

            this.clearCache('tags_contacts');
            return values[0][0]; // Return ID
        });
    }

    /**
     * TAGS (Contacts) - Delete
     */
    static async deleteContactTag(rowIndex) {
        const range = `${CONFIG.SHEETS.TAGS_CONTACTS}!A${rowIndex + 2}:F${rowIndex + 2}`;

        return this.retryRequest(async () => {
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: CONFIG.SHEET_ID,
                range
            });
        
            this.clearCache('tags_contacts');
            console.log('✓ Etykieta kontaktu usunięta');
        });
    }

    /**
     * CONTACT-TAG RELATIONS - Load
     */
    static async loadContactTagRelations(contactId = null, useCache = true) {
        const cacheKey = contactId ? `contact_tags_${contactId}` : 'contact_tag_relations';
    
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('✓ Relacje etykiet kontaktów załadowane z cache');
                return cached;
            }
        }

        return this.retryRequest(async () => {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.CONTACT_TAGS_RELATIONS}!A2:E`,
            });

            const rows = response.result.values || [];
            let relations = rows.map(row => ({
                id: row[0] || '',
                contactId: row[1] || '',
                tagId: row[2] || '',
                assignedBy: row[3] || '',
                assignedAt: row[4] || ''
            })).filter(r => r.contactId && r.tagId);

            if (contactId) {
                relations = relations.filter(r => r.contactId === contactId);
            }

            this.setCache(cacheKey, relations);
            console.log(`✓ Załadowano ${relations.length} relacji etykiet kontaktów`);
            return relations;
        });
    }

    /**
     * CONTACT-TAG RELATIONS - Assign tag to contact
     */
    static async assignTagToContact(contactId, tagId) {
        const values = [[
            this.generateId(),
            contactId,
            tagId,
            AuthService.getUserEmail() || '',
            new Date().toISOString()
        ]];

        return this.retryRequest(async () => {
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.CONTACT_TAGS_RELATIONS}!A:E`,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            });

            this.clearCache(`contact_tags_${contactId}`);
            this.clearCache('contact_tag_relations');
            console.log('✓ Etykieta przypisana do kontaktu');
            return values[0][0];
        });
    }

    /**
     * CONTACT-TAG RELATIONS - Remove tag from contact
     */
    static async removeTagFromContact(relationId, rowIndex) {
        const range = `${CONFIG.SHEETS.CONTACT_TAGS_RELATIONS}!A${rowIndex + 2}:E${rowIndex + 2}`;

        return this.retryRequest(async () => {
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: CONFIG.SHEET_ID,
                range
            });
        
            this.clearCache('contact_tag_relations');
            console.log('✓ Etykieta usunięta z kontaktu');
        });
    }

    // ============= UTILITY METHODS =============

    /**
     * Get tags for specific company
     */
    static getCompanyTags(companyId, allTags, allRelations) {
        const relations = allRelations.filter(r => r.companyId === companyId);
        return relations.map(r => allTags.find(t => t.id === r.tagId)).filter(Boolean);
    }

    /**
     * Get tags for specific contact
     */
    static getContactTags(contactId, allTags, allRelations) {
        const relations = allRelations.filter(r => r.contactId === contactId);
        return relations.map(r => allTags.find(t => t.id === r.tagId)).filter(Boolean);
    }

    /**
     * Get companies by tag
     */
    static getCompaniesByTag(tagId, allCompanies, allRelations) {
        const relations = allRelations.filter(r => r.tagId === tagId);
        const companyIds = relations.map(r => r.companyId);
        return allCompanies.filter(c => companyIds.includes(c.id));
    }

    /**
     * Get contacts by tag
     */
    static getContactsByTag(tagId, allContacts, allRelations) {
        const relations = allRelations.filter(r => r.tagId === tagId);
        const contactIds = relations.map(r => r.contactId);
        return allContacts.filter(c => contactIds.includes(c.id));
    }

    // ============= USER PREFERENCES =============

    /**
     * USER PREFERENCES - Load user preferences
     */
    static async loadUserPreferences(email, useCache = true) {
        if (!email) {
            console.warn('Brak emaila - nie można załadować preferencji');
            return null;
        }

        const cacheKey = `user_prefs_${email}`;
        
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('✓ Preferencje użytkownika załadowane z cache');
                return cached;
            }
        }

        return this.retryRequest(async () => {
            try {
                const response = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range: `${CONFIG.SHEETS.USER_PREFERENCES}!A2:D`,
                });

                const rows = response.result.values || [];
                const userPref = rows.find(row => row[0] && row[0].toLowerCase() === email.toLowerCase());
                
                if (!userPref) {
                    console.log('Brak preferencji dla użytkownika:', email);
                    return null;
                }

                const prefs = {
                    email: userPref[0] || '',
                    displayName: userPref[1] || '',
                    createdAt: userPref[2] || '',
                    updatedAt: userPref[3] || ''
                };

                this.setCache(cacheKey, prefs);
                console.log('✓ Preferencje użytkownika załadowane:', prefs.displayName);
                return prefs;
            } catch (error) {
                console.warn('Arkusz UserPreferences nie istnieje lub jest pusty:', error);
                return null;
            }
        });
    }

    /**
     * USER PREFERENCES - Save user preferences
     */
    static async saveUserPreferences(email, displayName) {
        if (!email) {
            throw new Error('Email jest wymagany');
        }

        return this.retryRequest(async () => {
            // Najpierw sprawdź czy użytkownik już ma preferencje
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.USER_PREFERENCES}!A2:D`,
            });

            const rows = response.result.values || [];
            const userIndex = rows.findIndex(row => row[0] && row[0].toLowerCase() === email.toLowerCase());
            const isUpdate = userIndex !== -1;

            const values = [[
                email,
                displayName || '',
                isUpdate ? rows[userIndex][2] : new Date().toISOString(), // createdAt
                new Date().toISOString() // updatedAt
            ]];

            if (isUpdate) {
                // Update existing row
                const range = `${CONFIG.SHEETS.USER_PREFERENCES}!A${userIndex + 2}:D${userIndex + 2}`;
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Preferencje użytkownika zaktualizowane');
            } else {
                // Append new row
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range: `${CONFIG.SHEETS.USER_PREFERENCES}!A:D`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Preferencje użytkownika utworzone');
            }

            // Clear cache
            this.clearCache(`user_prefs_${email}`);
            
            return {
                email,
                displayName,
                updatedAt: values[0][3]
            };
        });
    }

    // ============= ACTIVITIES =============

    /**
     * ACTIVITIES - Load
     */
    static async loadActivities(useCache = true) {
        const cacheKey = 'activities';
        
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('✓ Aktywności załadowane z cache');
                return cached;
            }
        }

        return this.retryRequest(async () => {
            try {
                const response = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range: `${CONFIG.SHEETS.ACTIVITIES}!A2:J`,
                });

                const rows = response.result.values || [];
                const activities = rows.map(row => ({
                    id: row[0] || '',
                    type: row[1] || '',
                    title: row[2] || '',
                    date: row[3] || '',
                    notes: row[4] || '',
                    companyId: row[5] || '',
                    contactId: row[6] || '',
                    status: row[7] || 'planned',
                    createdBy: row[8] || '',
                    createdAt: row[9] || ''
                })).filter(a => a.id);

                this.setCache(cacheKey, activities);
                console.log(`✓ Załadowano ${activities.length} aktywności`);
                return activities;
            } catch (error) {
                console.warn('Arkusz Activities nie istnieje:', error);
                return [];
            }
        });
    }

    /**
     * ACTIVITIES - Save (Create or Update)
     */
    static async saveActivity(activity, rowIndex = null) {
        const values = [[
            activity.id || this.generateId(),
            activity.type || '',
            activity.title || '',
            activity.date || '',
            activity.notes || '',
            activity.companyId || '',
            activity.contactId || '',
            activity.status || 'planned',
            activity.createdBy || AuthService.getUserEmail() || '',
            activity.createdAt || new Date().toISOString()
        ]];

        const isUpdate = rowIndex !== null;
        const range = isUpdate
            ? `${CONFIG.SHEETS.ACTIVITIES}!A${rowIndex + 2}:J${rowIndex + 2}`
            : `${CONFIG.SHEETS.ACTIVITIES}!A:J`;

        return this.retryRequest(async () => {
            if (isUpdate) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Aktywność zaktualizowana');
            } else {
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                console.log('✓ Aktywność dodana');
            }

            this.clearCache('activities');
            return values[0][0]; // Return ID
        });
    }

    /**
     * ACTIVITIES - Delete
     */
    static async deleteActivity(rowIndex) {
        const range = `${CONFIG.SHEETS.ACTIVITIES}!A${rowIndex + 2}:J${rowIndex + 2}`;

        return this.retryRequest(async () => {
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: CONFIG.SHEET_ID,
                range
            });
            
            this.clearCache('activities');
            console.log('✓ Aktywność usunięta');
        });
    }


    /**
     * CUSTOM FIELDS - Definitions (new sheet: CustomFields)
     * Columns (A-K):
     * A id | B entityType (company/contact/both) | C key | D label | E fieldType
     * F optionsJson | G required | H enabled | I order | J createdAt | K updatedAt
     */
    static async loadCustomFieldDefinitions(useCache = true) {
        const cacheKey = 'customFieldDefinitions';
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) return cached;
        }

        return this.retryRequest(async () => {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.CUSTOM_FIELDS}!A2:K`,
            });

            const rows = response.result.values || [];
            const defs = rows.map((row, idx) => {
                const requiredRaw = (row[6] || '').toString().toLowerCase();
                const enabledRaw  = (row[7] || '').toString().toLowerCase();
                const orderRaw    = row[8];

                return {
                    _rowIndex: idx, // 0-based index in "A2:K" set (used for updates)
                    id: row[0] || this.generateId(),
                    entityType: row[1] || 'both',
                    key: row[2] || '',
                    label: row[3] || '',
                    fieldType: row[4] || 'text',
                    optionsJson: row[5] || '',
                    required: requiredRaw === 'true' || requiredRaw === '1' || requiredRaw === 'yes',
                    enabled: enabledRaw === '' ? true : (enabledRaw === 'true' || enabledRaw === '1' || enabledRaw === 'yes'),
                    order: Number.isFinite(Number(orderRaw)) ? Number(orderRaw) : 0,
                    createdAt: row[9] || '',
                    updatedAt: row[10] || '',
                };
            }).filter(d => d.label && d.key);

            this.setCache(cacheKey, defs);
            return defs;
        });
    }

    static async saveCustomFieldDefinition(definition, rowIndex = null) {
        const now = new Date().toISOString();
        const isUpdate = rowIndex !== null && rowIndex !== undefined;

        const id = definition.id || this.generateId();
        const createdAt = definition.createdAt || (isUpdate ? '' : now);

        const values = [[
            id,
            definition.entityType || 'both',
            definition.key || '',
            definition.label || '',
            definition.fieldType || 'text',
            definition.optionsJson || '',
            definition.required ? 'TRUE' : 'FALSE',
            (definition.enabled ?? true) ? 'TRUE' : 'FALSE',
            (definition.order ?? 0).toString(),
            createdAt,
            now
        ]];

        const range = isUpdate
            ? `${CONFIG.SHEETS.CUSTOM_FIELDS}!A${rowIndex + 2}:K${rowIndex + 2}`
            : `${CONFIG.SHEETS.CUSTOM_FIELDS}!A2:K`;

        return this.retryRequest(async () => {
            if (isUpdate) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
            } else {
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    resource: { values }
                });
            }
            this.clearCache('customFieldDefinitions');
            return id;
        });
    }

    /**
     * Soft-delete: disable a definition (keeps history / avoids row deletion).
     */
    static async disableCustomFieldDefinition(rowIndex) {
        const defs = await this.loadCustomFieldDefinitions(false);
        const def = defs.find(d => d._rowIndex === rowIndex);
        if (!def) return;
        def.enabled = false;
        await this.saveCustomFieldDefinition(def, rowIndex);
    }

    /**
     * CUSTOM FIELD VALUES (new sheet: CustomFieldValues)
     * Columns (A-F):
     * A id | B entityType (company/contact) | C entityId | D valuesJson | E updatedAt | F updatedBy
     */
    static async loadCustomFieldValues(entityType, entityId, useCache = true) {
        const cacheKey = `customFieldValues:${entityType}:${entityId}`;
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) return cached;
        }

        return this.retryRequest(async () => {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: CONFIG.SHEET_ID,
                range: `${CONFIG.SHEETS.CUSTOM_FIELD_VALUES}!A2:F`,
            });

            const rows = response.result.values || [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const et = (row[1] || '').toString();
                const eid = (row[2] || '').toString();
                if (et === entityType && eid === entityId) {
                    let parsed = {};
                    try { parsed = row[3] ? JSON.parse(row[3]) : {}; } catch (e) { parsed = {}; }
                    const result = { _rowIndex: i, id: row[0] || '', values: parsed };
                    this.setCache(cacheKey, result);
                    return result;
                }
            }

            const result = { _rowIndex: null, id: '', values: {} };
            this.setCache(cacheKey, result);
            return result;
        });
    }

    static async saveCustomFieldValues(entityType, entityId, valuesObj) {
        const now = new Date().toISOString();
        const email = AuthService.getUserEmail() || '';

        const current = await this.loadCustomFieldValues(entityType, entityId, false);
        const isUpdate = current && current._rowIndex !== null && current._rowIndex !== undefined;

        const id = (current && current.id) ? current.id : this.generateId();
        const valuesJson = JSON.stringify(valuesObj || {});

        const values = [[
            id,
            entityType,
            entityId,
            valuesJson,
            now,
            email
        ]];

        const range = isUpdate
            ? `${CONFIG.SHEETS.CUSTOM_FIELD_VALUES}!A${current._rowIndex + 2}:F${current._rowIndex + 2}`
            : `${CONFIG.SHEETS.CUSTOM_FIELD_VALUES}!A2:F`;

        return this.retryRequest(async () => {
            if (isUpdate) {
                await gapi.client.sheets.spreadsheets.values.update({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
            } else {
                await gapi.client.sheets.spreadsheets.values.append({
                    spreadsheetId: CONFIG.SHEET_ID,
                    range,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    resource: { values }
                });
            }

            // Clear caches for this entity
            this.clearCache('customFieldDefinitions');
            this.clearCache(`customFieldValues:${entityType}:${entityId}`);
            return id;
        });
    }

}

// Export dla kompatybilności bez ES6 modules
if (typeof window !== 'undefined') {
    window.DataService = DataService;
}
