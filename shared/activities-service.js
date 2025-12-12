/**
 * SIMPLIFY CRM - Activities Service
 * ==================================
 * Logika biznesowa dla systemu aktywności
 * Warstwa pośrednia między UI a DataService
 */

import { CONFIG } from './config.js';
import { DataService } from './data-service.js';
import { AuthService } from './auth.js';

export class ActivitiesService {
    
    /**
     * Pobiera typy aktywności z konfiguracji
     * @returns {Object}
     */
    static getActivityTypes() {
        return CONFIG.ACTIVITIES.TYPES;
    }

    /**
     * Pobiera typ aktywności po ID
     * @param {string} typeId
     * @returns {Object|null}
     */
    static getActivityType(typeId) {
        return CONFIG.ACTIVITIES.TYPES[typeId] || null;
    }

    /**
     * Tworzy nową aktywność
     * @param {Object} params - Parametry aktywności
     * @param {string} params.type - Typ aktywności (EMAIL, PHONE, MEETING, TASK)
     * @param {string} params.title - Tytuł aktywności
     * @param {string} params.date - Data wykonania (ISO string)
     * @param {string} params.notes - Notatki
     * @param {string} params.companyId - ID firmy (opcjonalne)
     * @param {string} params.contactId - ID kontaktu (opcjonalne)
     * @param {string} params.status - Status (planned/completed/cancelled)
     * @returns {Promise<Object>} - Utworzona aktywność
     */
    static async createActivity(params) {
        // Walidacja
        const validation = this.validateActivity(params);
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        const activity = {
            id: DataService.generateId(),
            type: params.type,
            title: params.title,
            date: params.date || new Date().toISOString(),
            notes: params.notes || '',
            companyId: params.companyId || '',
            contactId: params.contactId || '',
            status: params.status || CONFIG.ACTIVITIES.STATUSES.PLANNED,
            createdBy: AuthService.getUserEmail() || '',
            createdAt: new Date().toISOString()
        };

        // Zapisz do Sheets
        await DataService.saveActivity(activity);

        // Loguj do historii
        await this.logActivityToHistory(activity);

        return activity;
    }

    /**
     * Aktualizuje istniejącą aktywność
     * @param {string} activityId
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    static async updateActivity(activityId, updates) {
        const activities = await DataService.loadActivities(false);
        const index = activities.findIndex(a => a.id === activityId);
        
        if (index === -1) {
            throw new Error('Aktywność nie znaleziona');
        }

        const activity = {
            ...activities[index],
            ...updates,
            id: activityId // Nie zmieniaj ID
        };

        // Walidacja
        const validation = this.validateActivity(activity);
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        await DataService.saveActivity(activity, index);

        // Loguj zmianę
        await this.logActivityUpdate(activity);

        return activity;
    }

    /**
     * Usuwa aktywność
     * @param {string} activityId
     * @returns {Promise<void>}
     */
    static async deleteActivity(activityId) {
        const activities = await DataService.loadActivities(false);
        const index = activities.findIndex(a => a.id === activityId);
        
        if (index === -1) {
            throw new Error('Aktywność nie znaleziona');
        }

        const activity = activities[index];
        await DataService.deleteActivity(index);

        // Loguj usunięcie
        await this.logActivityDeletion(activity);
    }

    /**
     * Oznacza aktywność jako ukończoną
     * @param {string} activityId
     * @returns {Promise<Object>}
     */
    static async completeActivity(activityId) {
        return await this.updateActivity(activityId, {
            status: CONFIG.ACTIVITIES.STATUSES.COMPLETED
        });
    }

    /**
     * Oznacza aktywność jako anulowaną
     * @param {string} activityId
     * @returns {Promise<Object>}
     */
    static async cancelActivity(activityId) {
        return await this.updateActivity(activityId, {
            status: CONFIG.ACTIVITIES.STATUSES.CANCELLED
        });
    }

    /**
     * Pobiera aktywności dla firmy
     * @param {string} companyId
     * @param {Object} filters - Filtry (type, status, dateFrom, dateTo)
     * @returns {Promise<Array>}
     */
    static async getCompanyActivities(companyId, filters = {}) {
        const activities = await DataService.loadActivities();
        let filtered = activities.filter(a => a.companyId === companyId);

        return this.applyFilters(filtered, filters);
    }

    /**
     * Pobiera aktywności dla kontaktu
     * @param {string} contactId
     * @param {Object} filters - Filtry (type, status, dateFrom, dateTo)
     * @returns {Promise<Array>}
     */
    static async getContactActivities(contactId, filters = {}) {
        const activities = await DataService.loadActivities();
        let filtered = activities.filter(a => a.contactId === contactId);

        return this.applyFilters(filtered, filters);
    }

    /**
     * Pobiera nadchodzące aktywności (status=planned, date >= today)
     * @param {string} companyId - Opcjonalnie filtruj po firmie
     * @param {string} contactId - Opcjonalnie filtruj po kontakcie
     * @returns {Promise<Array>}
     */
    static async getUpcomingActivities(companyId = null, contactId = null) {
        const activities = await DataService.loadActivities();
        const today = new Date().toISOString().split('T')[0];

        let filtered = activities.filter(a => 
            a.status === CONFIG.ACTIVITIES.STATUSES.PLANNED &&
            a.date >= today
        );

        if (companyId) {
            filtered = filtered.filter(a => a.companyId === companyId);
        }

        if (contactId) {
            filtered = filtered.filter(a => a.contactId === contactId);
        }

        // Sortuj po dacie (najbliższe najpierw)
        filtered.sort((a, b) => a.date.localeCompare(b.date));

        return filtered;
    }

    /**
     * Pobiera przeterminowane aktywności (status=planned, date < today)
     * @returns {Promise<Array>}
     */
    static async getOverdueActivities() {
        const activities = await DataService.loadActivities();
        const today = new Date().toISOString().split('T')[0];

        const overdue = activities.filter(a => 
            a.status === CONFIG.ACTIVITIES.STATUSES.PLANNED &&
            a.date < today
        );

        // Sortuj po dacie (najstarsze najpierw)
        overdue.sort((a, b) => a.date.localeCompare(b.date));

        return overdue;
    }

    /**
     * Waliduje dane aktywności
     * @param {Object} activity
     * @returns {Object} { valid: boolean, errors: Array }
     */
    static validateActivity(activity) {
        const errors = [];

        // Sprawdź typ
        const activityType = this.getActivityType(activity.type);
        if (!activityType) {
            errors.push(`Nieprawidłowy typ aktywności: ${activity.type}`);
        } else {
            // Sprawdź wymagane pola dla tego typu
            if (activityType.requiresTitle && !activity.title) {
                errors.push('Tytuł jest wymagany');
            }
            if (activityType.requiresDate && !activity.date) {
                errors.push('Data jest wymagana');
            }
        }

        // Sprawdź powiązania - musi być firma LUB kontakt
        if (!activity.companyId && !activity.contactId) {
            errors.push('Aktywność musi być powiązana z firmą lub kontaktem');
        }

        // Sprawdź format daty
        if (activity.date && isNaN(new Date(activity.date).getTime())) {
            errors.push('Nieprawidłowy format daty');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Aplikuje filtry do listy aktywności
     * @param {Array} activities
     * @param {Object} filters
     * @returns {Array}
     */
    static applyFilters(activities, filters) {
        let filtered = [...activities];

        // Filtr po typie
        if (filters.type) {
            filtered = filtered.filter(a => a.type === filters.type);
        }

        // Filtr po statusie
        if (filters.status) {
            filtered = filtered.filter(a => a.status === filters.status);
        }

        // Filtr po dacie od
        if (filters.dateFrom) {
            filtered = filtered.filter(a => a.date >= filters.dateFrom);
        }

        // Filtr po dacie do
        if (filters.dateTo) {
            filtered = filtered.filter(a => a.date <= filters.dateTo);
        }

        // Sortuj po dacie (najnowsze najpierw)
        filtered.sort((a, b) => b.date.localeCompare(a.date));

        return filtered;
    }

    /**
     * Formatuje aktywność dla wyświetlenia
     * @param {Object} activity
     * @returns {Object}
     */
    static formatActivity(activity) {
        const activityType = this.getActivityType(activity.type);
        
        return {
            ...activity,
            typeLabel: activityType ? activityType.label : activity.type,
            typeIcon: activityType ? activityType.icon : '📋',
            typeColor: activityType ? activityType.color : '#64748b',
            formattedDate: this.formatDate(activity.date),
            statusLabel: this.getStatusLabel(activity.status)
        };
    }

    /**
     * Formatuje datę
     * @param {string} isoDate
     * @returns {string}
     */
    static formatDate(isoDate) {
        if (!isoDate) return '';
        const date = new Date(isoDate);
        if (isNaN(date.getTime())) return isoDate;
        
        return date.toLocaleDateString('pl-PL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Pobiera etykietę statusu
     * @param {string} status
     * @returns {string}
     */
    static getStatusLabel(status) {
        const labels = {
            planned: 'Zaplanowane',
            completed: 'Ukończone',
            cancelled: 'Anulowane'
        };
        return labels[status] || status;
    }

    /**
     * Loguje aktywność do historii firmy/kontaktu
     * @param {Object} activity
     * @returns {Promise<void>}
     */
    static async logActivityToHistory(activity) {
        const activityType = this.getActivityType(activity.type);
        const typeLabel = activityType ? activityType.label : activity.type;
        const content = `${typeLabel}: ${activity.title}`;

        // Loguj do firmy
        if (activity.companyId) {
            await DataService.logCompanyHistory(
                activity.companyId,
                'event',
                content,
                `activity_created:${activity.id}`
            );
        }

        // Loguj do kontaktu
        if (activity.contactId) {
            await DataService.logContactHistory(
                activity.contactId,
                'event',
                content,
                `activity_created:${activity.id}`
            );
        }
    }

    /**
     * Loguje aktualizację aktywności do historii
     * @param {Object} activity
     * @returns {Promise<void>}
     */
    static async logActivityUpdate(activity) {
        const activityType = this.getActivityType(activity.type);
        const typeLabel = activityType ? activityType.label : activity.type;
        const content = `Zaktualizowano ${typeLabel.toLowerCase()}: ${activity.title}`;

        if (activity.companyId) {
            await DataService.logCompanyHistory(
                activity.companyId,
                'event',
                content,
                `activity_updated:${activity.id}`
            );
        }

        if (activity.contactId) {
            await DataService.logContactHistory(
                activity.contactId,
                'event',
                content,
                `activity_updated:${activity.id}`
            );
        }
    }

    /**
     * Loguje usunięcie aktywności do historii
     * @param {Object} activity
     * @returns {Promise<void>}
     */
    static async logActivityDeletion(activity) {
        const activityType = this.getActivityType(activity.type);
        const typeLabel = activityType ? activityType.label : activity.type;
        const content = `Usunięto ${typeLabel.toLowerCase()}: ${activity.title}`;

        if (activity.companyId) {
            await DataService.logCompanyHistory(
                activity.companyId,
                'event',
                content,
                `activity_deleted:${activity.id}`
            );
        }

        if (activity.contactId) {
            await DataService.logContactHistory(
                activity.contactId,
                'event',
                content,
                `activity_deleted:${activity.id}`
            );
        }
    }

    /**
     * Pobiera statystyki aktywności
     * @param {string} companyId - Opcjonalnie filtruj po firmie
     * @param {string} contactId - Opcjonalnie filtruj po kontakcie
     * @returns {Promise<Object>}
     */
    static async getActivityStats(companyId = null, contactId = null) {
        const activities = await DataService.loadActivities();
        
        let filtered = activities;
        if (companyId) {
            filtered = filtered.filter(a => a.companyId === companyId);
        }
        if (contactId) {
            filtered = filtered.filter(a => a.contactId === contactId);
        }

        const stats = {
            total: filtered.length,
            byType: {},
            byStatus: {
                planned: 0,
                completed: 0,
                cancelled: 0
            },
            upcoming: 0,
            overdue: 0
        };

        const today = new Date().toISOString().split('T')[0];

        filtered.forEach(activity => {
            // Zlicz po typie
            stats.byType[activity.type] = (stats.byType[activity.type] || 0) + 1;
            
            // Zlicz po statusie
            if (stats.byStatus[activity.status] !== undefined) {
                stats.byStatus[activity.status]++;
            }

            // Zlicz nadchodzące i przeterminowane
            if (activity.status === CONFIG.ACTIVITIES.STATUSES.PLANNED) {
                if (activity.date >= today) {
                    stats.upcoming++;
                } else {
                    stats.overdue++;
                }
            }
        });

        return stats;
    }
}

// Export dla kompatybilności bez ES6 modules
if (typeof window !== 'undefined') {
    window.ActivitiesService = ActivitiesService;
}
