import { AuthService } from '../shared/auth.js';
import { DataService } from '../shared/data-service.js';
import { CustomFieldsUI } from '../shared/custom-fields-ui.js';
import { ActivitiesService } from '../shared/activities-service.js';
import { bootstrapProtectedPage } from '../shared/app-shell.js';

        // ============= AUTH GUARD =============
        if (!AuthService.requireAuth()) {
            throw new Error('Unauthorized');
        }

        // ============= VARIABLES =============
        let allActivities = [];
        let allCompanies = [];
        let allContacts = [];
        let editingCompanyIndex = null;
        let editingContactIndex = null;

        let companyInputEl = null;
        let companyIdEl = null;
        let companySuggestionsEl = null;

        // ============= INIT =============
        async function init() {
            try {
                const { email, displayName } = await bootstrapProtectedPage({ logoAction: 'reload' });

                // ⚙️ Settings shortcut
                const settingsBtn = document.getElementById('settingsBtn');
                if (settingsBtn) {
                    settingsBtn.addEventListener('click', () => {
                        window.location.href = './modules/settings.html';
                    });
                }


                if (email) {
                    if (displayName) {
                        document.getElementById('welcomeTitle').textContent = `Witaj, ${displayName}! 👋`;
                    } else {
                        document.getElementById('welcomeTitle').textContent = `Witaj, ${email.split('@')[0]}! 👋`;
                    }
                }

                setWelcomeDate();

                await loadDashboardData();
                showDashboard();

            } catch (error) {
                console.error('Błąd inicjalizacji:', error);
                alert('Wystąpił błąd podczas ładowania danych.');
            }
        }

        function setWelcomeDate() {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const dateStr = new Date().toLocaleDateString('pl-PL', options);
            const capitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
            document.getElementById('welcomeDate').textContent = capitalized;
        }

        async function loadDashboardData() {
            try {
                [allActivities, allCompanies, allContacts] = await Promise.all([
                    DataService.loadActivities(),
                    DataService.loadCompanies(),
                    DataService.loadContacts()
                ]);

                renderAllSections();
            } catch (error) {
                console.error('Błąd ładowania danych:', error);
            }
        }

        function renderAllSections() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() + 7);

            // Filter activities
            const todayTasks = allActivities.filter(a => {
                if (a.status !== 'planned') return false;
                const taskDate = new Date(a.date);
                taskDate.setHours(0, 0, 0, 0);
                return taskDate.getTime() === today.getTime();
            }).sort((a, b) => a.date.localeCompare(b.date));

            const overdueTasks = allActivities.filter(a => {
                if (a.status !== 'planned') return false;
                const taskDate = new Date(a.date);
                taskDate.setHours(0, 0, 0, 0);
                return taskDate.getTime() < today.getTime();
            }).sort((a, b) => a.date.localeCompare(b.date));

            const tomorrowTasks = allActivities.filter(a => {
                if (a.status !== 'planned') return false;
                const taskDate = new Date(a.date);
                taskDate.setHours(0, 0, 0, 0);
                return taskDate.getTime() === tomorrow.getTime();
            }).sort((a, b) => a.date.localeCompare(b.date));

            const weekTasks = allActivities.filter(a => {
                if (a.status !== 'planned') return false;
                const taskDate = new Date(a.date);
                taskDate.setHours(0, 0, 0, 0);
                return taskDate.getTime() > tomorrow.getTime() && taskDate.getTime() < weekEnd.getTime();
            }).sort((a, b) => a.date.localeCompare(b.date));

            // Update stats
            document.getElementById('overdueCount').textContent = overdueTasks.length;
            document.getElementById('tomorrowCount').textContent = tomorrowTasks.length;
            document.getElementById('weekCount').textContent = weekTasks.length;
            document.getElementById('todayCount').textContent = todayTasks.length;

            // Render sections
            renderTodayTasks(todayTasks);
            renderOverdueTasks(overdueTasks);
            renderTomorrowTasks(tomorrowTasks);
            renderWeekTasks(weekTasks);
        }

        function renderTodayTasks(tasks) {
            const tasksList = document.getElementById('tasksList');
            const tasksEmpty = document.getElementById('tasksEmpty');

            if (tasks.length === 0) {
                tasksList.innerHTML = '';
                tasksEmpty.style.display = 'block';
                return;
            }

            tasksEmpty.style.display = 'none';
            tasksList.innerHTML = tasks.map(task => renderTaskItem(task, false)).join('');
        }

        function renderOverdueTasks(tasks) {
            const overdueSection = document.getElementById('overdueSection');
            const overdueList = document.getElementById('overdueList');
            const overdueCardCount = document.getElementById('overdueCardCount');

            if (tasks.length === 0) {
                overdueSection.style.display = 'none';
                return;
            }

            overdueSection.style.display = 'block';
            overdueCardCount.textContent = tasks.length;
            overdueList.innerHTML = tasks.map(task => renderTaskItem(task, true)).join('');
        }

        function renderTomorrowTasks(tasks) {
            const tomorrowList = document.getElementById('tomorrowList');

            if (tasks.length === 0) {
                tomorrowList.innerHTML = '<div class="empty-state" style="padding: 1rem;"><p style="font-size: 0.75rem;">Brak zadań</p></div>';
                return;
            }

            tomorrowList.innerHTML = tasks.slice(0, 5).map(task => renderUpcomingItem(task)).join('');
        }

        function renderWeekTasks(tasks) {
            const weekList = document.getElementById('weekList');

            if (tasks.length === 0) {
                weekList.innerHTML = '<div class="empty-state" style="padding: 1rem;"><p style="font-size: 0.75rem;">Brak zadań</p></div>';
                return;
            }

            weekList.innerHTML = tasks.slice(0, 5).map(task => renderUpcomingItem(task)).join('');
        }

        function renderTaskItem(task, isOverdue) {
            const formatted = ActivitiesService.formatActivity(task);
            const company = allCompanies.find(c => c.id === task.companyId);
            const contact = allContacts.find(c => c.id === task.contactId);

            const time = new Date(task.date).toLocaleTimeString('pl-PL', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const metaParts = [];
            if (contact) metaParts.push(escapeHtml(contact.name));
            if (company) metaParts.push(escapeHtml(company.name));
            const meta = metaParts.join(' • ');

            return `
                <div class="task-item ${isOverdue ? 'overdue' : task.type.toLowerCase()}" onclick="openActivityPreview('${task.id}')">
                    <div class="task-time">${time}</div>
                    <div class="task-icon">${formatted.typeIcon}</div>
                    <div class="task-content">
                        <div class="task-title">${escapeHtml(task.title)}</div>
                        ${meta ? `<div class="task-meta">${meta}</div>` : ''}
                    </div>
                    <div class="task-actions">
                        <button class="task-action-btn primary" onclick="event.stopPropagation(); completeTask('${task.id}')">
                            ✓
                        </button>
                        <button class="task-action-btn" onclick="event.stopPropagation(); openActivityPreview('${task.id}')">
                            👁️
                        </button>
                    </div>
                </div>
            `;
        }

        function renderUpcomingItem(task) {
            const formatted = ActivitiesService.formatActivity(task);
            const contact = allContacts.find(c => c.id === task.contactId);
            const company = allCompanies.find(c => c.id === task.companyId);

            const time = new Date(task.date).toLocaleTimeString('pl-PL', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const textParts = [escapeHtml(task.title)];
            if (contact) textParts.push(escapeHtml(contact.name));
            if (company) textParts.push(escapeHtml(company.name));
            const text = textParts.join(' • ');

            return `
                <div class="upcoming-item" onclick="openActivityPreview('${task.id}')">
                    <span class="icon">${formatted.typeIcon}</span>
                    <span class="text">${text}</span>
                    <span class="time">${time}</span>
                </div>
            `;
        }

        // ============= ACTIVITY PREVIEW MODAL =============
        function openActivityPreview(activityId) {
            const activity = allActivities.find(a => a.id === activityId);
            if (!activity) return;

            const formatted = ActivitiesService.formatActivity(activity);
            const company = allCompanies.find(c => c.id === activity.companyId);
            const contact = allContacts.find(c => c.id === activity.contactId);

            const dateFormatted = new Date(activity.date).toLocaleString('pl-PL', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let content = `
                <div class="activity-preview-header">
                    <div class="activity-preview-icon">${formatted.typeIcon}</div>
                    <div class="activity-preview-title-block">
                        <div class="activity-preview-type">${formatted.typeLabel}</div>
                        <div class="activity-preview-title">${escapeHtml(activity.title)}</div>
                        <div class="activity-preview-datetime">${dateFormatted}</div>
                    </div>
                    <span class="activity-preview-status ${activity.status}">${formatted.statusLabel}</span>
                </div>

                <div class="activity-info-grid">
            `;

            if (contact) {
                content += `
                    <div class="activity-info-item">
                        <div class="activity-info-label">Osoba kontaktowa</div>
                        <div class="activity-info-value clickable" onclick="viewInRelationships('${contact.id}', 'contact')">
                            👤 ${escapeHtml(contact.name)}${contact.position ? ` • ${escapeHtml(contact.position)}` : ''}
                        </div>
                    </div>
                `;
            }

            if (company) {
                content += `
                    <div class="activity-info-item">
                        <div class="activity-info-label">Firma</div>
                        <div class="activity-info-value clickable" onclick="viewInRelationships('${company.id}', 'company')">
                            🏢 ${escapeHtml(company.name)}${company.industry ? ` • ${escapeHtml(company.industry)}` : ''}
                        </div>
                    </div>
                `;
            }

            if (contact && contact.email) {
                content += `
                    <div class="activity-info-item">
                        <div class="activity-info-label">Email</div>
                        <div class="activity-info-value">
                            <a href="mailto:${escapeHtml(contact.email)}" style="color: var(--accent);">
                                ${escapeHtml(contact.email)}
                            </a>
                        </div>
                    </div>
                `;
            }

            if (contact && contact.phone) {
                content += `
                    <div class="activity-info-item">
                        <div class="activity-info-label">Telefon</div>
                        <div class="activity-info-value">
                            <a href="tel:${escapeHtml(contact.phone)}" style="color: var(--accent);">
                                ${escapeHtml(contact.phone)}
                            </a>
                        </div>
                    </div>
                `;
            }

            content += `</div>`;

            if (activity.notes) {
                content += `
                    <div class="activity-notes-section">
                        <div class="activity-notes-title">Notatki</div>
                        <div class="activity-notes-content">${escapeHtml(activity.notes)}</div>
                    </div>
                `;
            }

            content += `
                <div class="activity-preview-actions">
            `;

            if (activity.status === 'planned') {
                content += `
                    <button class="btn btn-primary" onclick="completeActivityFromPreview('${activity.id}')">
                        ✓ Oznacz jako ukończone
                    </button>
                `;
            }

            content += `
                    <button class="btn btn-secondary" onclick="viewFullDetails('${activity.companyId || activity.contactId}', '${activity.companyId ? 'company' : 'contact'}')">
                        Zobacz pełne szczegóły
                    </button>
                </div>
            `;

            document.getElementById('activityPreviewContent').innerHTML = content;
            document.getElementById('activityPreviewModal').classList.add('active');
        }

        function closeActivityPreview() {
            document.getElementById('activityPreviewModal').classList.remove('active');
        }

        async function completeActivityFromPreview(activityId) {
            try {
                await ActivitiesService.completeActivity(activityId);
                showStatus('Zadanie ukończone!', 'success');
                
                allActivities = await DataService.loadActivities();
                renderAllSections();
                closeActivityPreview();
            } catch (error) {
                console.error('Błąd:', error);
                showStatus('Błąd: ' + error.message, 'error');
            }
        }

        function viewFullDetails(id, type) {
            closeActivityPreview();
            viewInRelationships(id, type);
        }

        window.openActivityPreview = openActivityPreview;
        window.closeActivityPreview = closeActivityPreview;
        window.completeActivityFromPreview = completeActivityFromPreview;
        window.viewFullDetails = viewFullDetails;

        // ============= TASK ACTIONS =============
        async function completeTask(taskId) {
            try {
                await ActivitiesService.completeActivity(taskId);
                showStatus('Zadanie ukończone!', 'success');
                
                allActivities = await DataService.loadActivities();
                renderAllSections();
            } catch (error) {
                console.error('Błąd:', error);
                showStatus('Błąd: ' + error.message, 'error');
            }
        }

        function viewInRelationships(id, type) {
            if (type === 'company') {
                window.location.href = `./modules/relationships.html?company=${id}`;
            } else {
                window.location.href = `./modules/relationships.html?contact=${id}`;
            }
        }

        // Export to window
        window.completeTask = completeTask;
        window.viewInRelationships = viewInRelationships;

        function showDashboard() {
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'block';
        }

        
        // ============= CUSTOM FIELDS (Dynamic) =============
        let _customFieldDefinitions = null;

        async function ensureCustomFieldDefinitionsLoaded() {
            if (_customFieldDefinitions) return _customFieldDefinitions;
            const defs = await DataService.loadCustomFieldDefinitions(true);
            _customFieldDefinitions = Array.isArray(defs) ? defs : [];
            return _customFieldDefinitions;
        }

        function getActiveDefsFor(entityType) {
            const defs = _customFieldDefinitions || [];
            return defs.filter(d => (d.enabled ?? true) && (d.entityType === entityType || d.entityType === 'both'));
        }

        async function renderDashboardCustomFields(entityType, entityId) {
            await ensureCustomFieldDefinitionsLoaded();
            const sectionId = entityType === 'company' ? 'companyCustomFieldsSection' : 'contactCustomFieldsSection';
            const containerId = entityType === 'company' ? 'companyCustomFieldsContainer' : 'contactCustomFieldsContainer';

            const sectionEl = document.getElementById(sectionId);
            const containerEl = document.getElementById(containerId);
            if (!sectionEl || !containerEl) return;

            const defs = getActiveDefsFor(entityType);
            if (!defs.length) {
                sectionEl.style.display = 'none';
                containerEl.innerHTML = '';
                return;
            }

            sectionEl.style.display = '';
            let values = {};
            if (entityId) {
                const payload = await DataService.loadCustomFieldValues(entityType, entityId, true);
                values = payload?.values || {};
            }
            CustomFieldsUI.mount(containerEl, defs, values, `${entityType}_`);
        }

        async function saveDashboardCustomFields(entityType, entityId) {
            await ensureCustomFieldDefinitionsLoaded();
            const containerId = entityType === 'company' ? 'companyCustomFieldsContainer' : 'contactCustomFieldsContainer';
            const containerEl = document.getElementById(containerId);
            if (!containerEl) return;

            const defs = getActiveDefsFor(entityType);
            if (!defs.length) return;

            const values = CustomFieldsUI.collect(containerEl, defs, `${entityType}_`);
            await DataService.saveCustomFieldValues(entityType, entityId, values);
        }

        // ============= COMPANY MODAL =============
        window.openAddCompanyModal = async function() {
            editingCompanyIndex = null;
            document.getElementById('companyModalTitle').textContent = 'Dodaj firmę';
            document.getElementById('companyForm').reset();
            document.getElementById('companyModal').classList.add('active');
            // Render custom fields (blank for new)
            renderDashboardCustomFields('company', editingCompanyIndex !== null ? (allCompanies[editingCompanyIndex]?.id || null) : null);
        };

        function closeCompanyModal() {
            document.getElementById('companyModal').classList.remove('active');
            document.getElementById('companyForm').reset();
            editingCompanyIndex = null;
        }

        async function saveCompany(e) {
            e.preventDefault();

            const name = document.getElementById('companyName').value.trim();
            const domain = document.getElementById('companyDomain').value.trim();
            const phone = document.getElementById('companyPhone').value.trim();
            const industry = document.getElementById('companyIndustry').value.trim();
            const city = document.getElementById('companyCity').value.trim();
            const country = document.getElementById('companyCountry').value.trim();
            const notes = document.getElementById('companyNotes').value.trim();
            
            let website = domain ? (domain.startsWith('http') ? domain : `https://${domain}`) : '';

            const company = {
                id: editingCompanyIndex !== null ? allCompanies[editingCompanyIndex].id : DataService.generateId(),
                name, industry, website, phone, city, country, domain, notes,
                tags: ''
            };

            try {
                await DataService.saveCompany(company, editingCompanyIndex);
                // Save custom fields to sheet
                await saveDashboardCustomFields('company', company.id);
                
                if (editingCompanyIndex !== null) {
                    allCompanies[editingCompanyIndex] = company;
                    await DataService.logCompanyHistory(company.id, 'event', 'Firma zaktualizowana');
                    showStatus('Firma zaktualizowana', 'success');
                } else {
                    allCompanies.push(company);
                    await DataService.logCompanyHistory(company.id, 'event', 'Firma utworzona');
                    showStatus('Firma dodana', 'success');
                }

                closeCompanyModal();
            } catch (err) {
                console.error('Błąd zapisu firmy:', err);
                showStatus('Błąd zapisu firmy', 'error');
            }
        }

        // ============= CONTACT MODAL =============
        window.openAddContactModal = async function() {
            editingContactIndex = null;
            document.getElementById('contactModalTitle').textContent = 'Dodaj kontakt';
            document.getElementById('contactForm').reset();
            hideCompanySuggestions();
            document.getElementById('contactModal').classList.add('active');
            // Render custom fields (blank for new)
            renderDashboardCustomFields('contact', editingContactIndex !== null ? (allContacts[editingContactIndex]?.id || null) : null);
        };

        function closeContactModal() {
            document.getElementById('contactModal').classList.remove('active');
            document.getElementById('contactForm').reset();
            hideCompanySuggestions();
            editingContactIndex = null;
        }

        async function saveContact(e) {
            e.preventDefault();
            
            const typedCompanyName = (companyInputEl?.value || '').trim();
            let selectedCompanyId = companyIdEl?.value || '';
            
            const name = document.getElementById('contactName').value.trim();
            const email = document.getElementById('contactEmail').value.trim();
            const phone = document.getElementById('contactPhone').value.trim();
            const position = document.getElementById('contactPosition').value.trim();

            // Auto-match by domain
            if (!typedCompanyName && !selectedCompanyId && email) {
                const domain = DataService.extractDomain(email);
                const matchedCompany = DataService.findCompanyByDomain(allCompanies, domain);
                if (matchedCompany) {
                    selectedCompanyId = matchedCompany.id;
                    companyInputEl.value = matchedCompany.name;
                    showStatus(`🎯 Auto-dopasowano: ${matchedCompany.name}`, 'success');
                }
            }

            try {
                // Create company on the fly
                if (typedCompanyName && !selectedCompanyId) {
                    const existing = allCompanies.find(c => c.name && c.name.toLowerCase() === typedCompanyName.toLowerCase());
                    if (existing) {
                        selectedCompanyId = existing.id;
                    } else {
                        let newDomain = '';
                        let newWebsite = '';
                        
                        if (email && email.includes('@')) {
                            const extracted = DataService.extractDomain(email);
                            const publicDomains = ['gmail.com', 'wp.pl', 'onet.pl', 'interia.pl', 'outlook.com', 'yahoo.com'];
                            if (!publicDomains.includes(extracted)) {
                                newDomain = extracted;
                                newWebsite = `https://${extracted}`;
                            }
                        }

                        const newCompany = {
                            id: DataService.generateId(),
                            name: typedCompanyName,
                            industry: '', notes: '', phone: '', city: '', country: '', 
                            domain: newDomain, 
                            website: newWebsite,
                            tags: ''
                        };
                        
                        await DataService.saveCompany(newCompany);
                        allCompanies.push(newCompany);
                        selectedCompanyId = newCompany.id;
                        await DataService.logCompanyHistory(newCompany.id, 'event', 'Firma utworzona (z kontaktu)');
                        showStatus(`Utworzono: "${newCompany.name}"`, 'success');
                    }
                }

                const contact = {
                    id: editingContactIndex !== null ? allContacts[editingContactIndex].id : DataService.generateId(),
                    companyId: selectedCompanyId || '',
                    name, position, email, phone,
                    tags: ''
                };

                await DataService.saveContact(contact, editingContactIndex);
                // Save custom fields to sheet
                await saveDashboardCustomFields('contact', contact.id);

                if (editingContactIndex !== null) {
                    allContacts[editingContactIndex] = contact;
                    await DataService.logContactHistory(contact.id, 'event', 'Kontakt zaktualizowany');
                    showStatus('Kontakt zaktualizowany', 'success');
                } else {
                    allContacts.push(contact);
                    await DataService.logContactHistory(contact.id, 'event', 'Kontakt utworzony');
                    if (contact.companyId) await DataService.logCompanyHistory(contact.companyId, 'event', `Kontakt "${contact.name}" powiązany`);
                    showStatus('Kontakt dodany', 'success');
                }

                closeContactModal();
            } catch (err) {
                console.error('Błąd zapisu kontaktu:', err);
                showStatus('Błąd zapisu kontaktu', 'error');
            }
        }

        // ============= COMPANY PICKER =============
        function showCompanySuggestions(query) {
            if (!companySuggestionsEl || !companyInputEl) return;
            const q = (query || '').trim().toLowerCase();
            let filtered = q ? allCompanies.filter(c => (c.name || '').toLowerCase().includes(q)) : allCompanies;

            let html = '';
            filtered.slice(0, 8).forEach(c => {
                const meta = [c.industry, c.city].filter(Boolean).join(' • ');
                html += `<div class="company-suggestion-item" data-id="${c.id}"><span>${escapeHtml(c.name)}</span>${meta ? `<span class="suggestion-meta">${escapeHtml(meta)}</span>` : ''}</div>`;
            });

            const exactExists = allCompanies.some(c => c.name && c.name.toLowerCase() === q && q.length > 0);
            if (q && !exactExists) {
                html += `<div class="company-suggestion-item company-suggestion-new"><span>➕ Utwórz "<strong>${escapeHtml(query.trim())}</strong>"</span></div>`;
            }

            if (!html) {
                companySuggestionsEl.innerHTML = '';
                companySuggestionsEl.classList.remove('visible');
                return;
            }

            companySuggestionsEl.innerHTML = html;
            companySuggestionsEl.classList.add('visible');
        }

        function hideCompanySuggestions() {
            if (companySuggestionsEl) {
                companySuggestionsEl.classList.remove('visible');
                companySuggestionsEl.innerHTML = '';
            }
        }

        function openProfileModal() {
            const email = AuthService.getUserEmail();
            const displayName = AuthService.getDisplayName();
            const displayText = AuthService.getUserDisplayText();
            
            document.getElementById('userEmailDisplay').value = email || '';
            document.getElementById('displayName').value = displayName || '';
            document.getElementById('currentDisplay').textContent = displayText;
            
            document.getElementById('profileModal').classList.add('active');
            document.getElementById('displayName').focus();
        }

        function closeProfileModal() {
            document.getElementById('profileModal').classList.remove('active');
            document.getElementById('profileForm').reset();
        }

        async function saveProfile(event) {
            event.preventDefault();
            
            const email = AuthService.getUserEmail();
            const displayName = document.getElementById('displayName').value.trim();
            
            if (!email) {
                alert('Błąd: brak emaila');
                return;
            }
            
            try {
                await DataService.saveUserPreferences(email, displayName);
                AuthService.saveDisplayName(displayName);
                
                const displayText = AuthService.getUserDisplayText();
                document.getElementById('userEmail').textContent = displayText;
                
                if (displayName) {
                    document.getElementById('welcomeTitle').textContent = `Witaj, ${displayName}! 👋`;
                } else {
                    document.getElementById('welcomeTitle').textContent = `Witaj, ${email.split('@')[0]}! 👋`;
                }
                
                showStatus('✓ Profil zaktualizowany!', 'success');
                closeProfileModal();
            } catch (error) {
                console.error('Błąd zapisu profilu:', error);
                alert('Wystąpił błąd podczas zapisu.');
            }
        }

        // ============= HELPERS =============
        function showStatus(message, type) {
            const msg = document.createElement('div');
            msg.className = 'status-message' + (type ? ' ' + type : '');
            msg.textContent = message;
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 3200);
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : text;
            return div.innerHTML;
        }

        // ============= EVENT LISTENERS =============
        document.addEventListener('DOMContentLoaded', () => {

            // Profile
            document.getElementById('profileBtn').addEventListener('click', openProfileModal);
            document.getElementById('closeProfileBtn').addEventListener('click', closeProfileModal);
            document.getElementById('cancelProfileBtn').addEventListener('click', closeProfileModal);
            document.getElementById('profileForm').addEventListener('submit', saveProfile);

            // Company modal
            document.getElementById('closeCompanyModalBtn').addEventListener('click', closeCompanyModal);
            document.getElementById('cancelCompanyBtn').addEventListener('click', closeCompanyModal);
            document.getElementById('companyForm').addEventListener('submit', saveCompany);

            // Contact modal
            document.getElementById('closeContactModalBtn').addEventListener('click', closeContactModal);
            document.getElementById('cancelContactBtn').addEventListener('click', closeContactModal);
            document.getElementById('contactForm').addEventListener('submit', saveContact);

            // Company picker
            companyInputEl = document.getElementById('contactCompanyInput');
            companyIdEl = document.getElementById('contactCompanyId');
            companySuggestionsEl = document.getElementById('companySuggestions');

            if (companyInputEl) {
                const onInput = () => {
                    companyIdEl.value = '';
                    showCompanySuggestions(companyInputEl.value);
                };
                companyInputEl.addEventListener('input', onInput);
                companyInputEl.addEventListener('focus', onInput);
            }

            if (companySuggestionsEl) {
                companySuggestionsEl.addEventListener('click', (e) => {
                    const item = e.target.closest('.company-suggestion-item');
                    if (!item) return;
                    if (item.dataset.id) {
                        const company = allCompanies.find(c => c.id === item.dataset.id);
                        if (company) {
                            companyInputEl.value = company.name;
                            companyIdEl.value = company.id;
                        }
                    }
                    hideCompanySuggestions();
                });
            }

            // Auto-match
            const contactEmailEl = document.getElementById('contactEmail');
            if (contactEmailEl && companyInputEl && companyIdEl) {
                contactEmailEl.addEventListener('blur', () => {
                    const email = contactEmailEl.value.trim();
                    if (!email || !email.includes('@')) return;
                    if (companyInputEl.value.trim() || companyIdEl.value) return;
                    const domain = DataService.extractDomain(email);
                    const matchedCompany = DataService.findCompanyByDomain(allCompanies, domain);
                    if (matchedCompany) {
                        companyInputEl.value = matchedCompany.name;
                        companyIdEl.value = matchedCompany.id;
                        showStatus(`🎯 Auto-dopasowano: ${matchedCompany.name}`, 'success');
                    }
                });
            }

            // Close modals on background click
            document.querySelectorAll('.modal').forEach(modal => {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        if (modal.id === 'activityPreviewModal') {
                            closeActivityPreview();
                        } else {
                            modal.classList.remove('active');
                        }
                    }
                });
            });

            // Hide suggestions when clicking outside
            document.addEventListener('click', (e) => {
                if (companyInputEl && companyInputEl.closest('.company-picker') && companySuggestionsEl) {
                    if (!companyInputEl.closest('.company-picker').contains(e.target)) {
                        hideCompanySuggestions();
                    }
                }
            });
        });

        // ============= START =============
        if (typeof gapi !== 'undefined') {
            init();
        } else {
            window.addEventListener('load', () => {
                setTimeout(init, 1000);
            });
        }
