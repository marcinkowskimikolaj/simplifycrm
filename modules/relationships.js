import { AIService } from '../shared/ai-service.js';
import { CONFIG } from '../shared/config.js';
        import { AuthService } from '../shared/auth.js';
        import { DataService } from '../shared/data-service.js';
        import { ActivitiesService } from '../shared/activities-service.js';
import { bootstrapProtectedPage } from '../shared/app-shell.js';

        // ============= AUTH GUARD =============
        if (!AuthService.requireAuth()) {
            throw new Error('Unauthorized - redirecting to login');
        }

        // ============= VARIABLES =============
                // Tags variables
        let companyTags = [];
        let contactTags = [];
        let companyTagRelations = [];
        let contactTagRelations = [];
        let currentTagFilter = null;
        let currentTagType = 'companies';
        let companyActivities = [];
        let contactActivities = [];
        let currentActivityType = 'EMAIL';

        let companies = [];
        let contacts = [];
        let companyHistory = [];
        let contactHistory = [];

        let editingCompanyIndex = null;
        let editingContactIndex = null;
        let currentCompanyId = null;
        let currentContactId = null;
        let currentSearchTerm = '';

        let currentCompanyHistoryScope = 'all';
        let currentContactHistoryScope = 'all';

        let companyInputEl = null;
        let companyIdEl = null;
        let companySuggestionsEl = null;

        let noteEntityTypeEl = null;
        let noteEntityIdEl = null;
        let noteContentEl = null;

        let contactsViewMode = 'grid';
        let companiesViewMode = 'grid';

        
// Export & Selection variables
let selectedContactIds = [];
let selectedCompanyIds = [];
let contactsSelectionMode = false;
let companiesSelectionMode = false;
// AI Request Tracking (for regenerate functionality)
        let lastAiRequest = null; // { type: 'summary'|'suggestions', entityType: 'company'|'contact', entityId: string }
        let lastAiResponse = null; // Ostatnia odpowiedź AI

        // ============= INIT =============
        async function init() {
            try {                const { email } = await bootstrapProtectedPage({ logoAction: 'dashboard' });

                // Load data
                await loadData();
// Initialize AI
                const savedApiKey = localStorage.getItem('ai_api_key');
                const savedProvider = localStorage.getItem('ai_provider') || 'gemini'; // Domyślnie Gemini
                const aiConsent = localStorage.getItem('ai_consent') === 'true';
                
                if (savedApiKey && aiConsent) {
                    AIService.init(savedApiKey, savedProvider);
                    console.log(`✓ AI Service initialized with ${savedProvider}`);
                }
                console.log('✓ Relationships module initialized');

            } catch (error) {
                console.error('Błąd inicjalizacji modułu:', error);
                alert('Wystąpił błąd podczas ładowania danych. Sprawdź konsolę.');
            }
        }

        // ============= DATA LOADING =============
        async function loadData() {
            // Show loading indicators
            const companiesLoading = document.getElementById('companiesLoading');
            const contactsLoading = document.getElementById('contactsLoading');
            companiesLoading.style.display = 'block';
            contactsLoading.style.display = 'block';

            try {
                // STEP 1: Load all data FIRST (no rendering yet!)
                [companies, contacts] = await Promise.all([
                    DataService.loadCompanies(),
                    DataService.loadContacts()
                ]);

                // STEP 2: Load tags and history
                await loadTagsData();
                await Promise.all([
                    loadCompanyHistory(), 
                    loadContactHistory(),
                    loadActivitiesData()
                ]);

                // STEP 3: NOW render everything (all data is available)
                renderCompanies();
                renderAllContacts();
                renderTagFilterDropdowns();

                // Initialize selection UI
                updateCompanySelectionUI();
                updateContactSelectionUI();

                console.log('✓ Wszystkie dane załadowane i wyświetlone');
            } catch (err) {
                console.error('Błąd ładowania danych:', err);
                showStatus('Błąd ładowania danych', 'error');
            } finally {
                // Hide loading indicators
                companiesLoading.style.display = 'none';
                contactsLoading.style.display = 'none';
            }
        }

        async function loadCompanies() {
            const loading = document.getElementById('companiesLoading');
            const grid = document.getElementById('companiesGrid');
            const empty = document.getElementById('companiesEmpty');

            loading.style.display = 'block';
            grid.innerHTML = '';
            empty.style.display = 'none';

            try {
                companies = await DataService.loadCompanies();
                renderCompanies();
            } catch (err) {
                console.error('Błąd ładowania firm:', err);
                showStatus('Błąd ładowania firm (sprawdź arkusz "Firmy")', 'error');
                empty.style.display = 'block';
            } finally {
                loading.style.display = 'none';
            }
        }

        async function loadContacts() {
            const loading = document.getElementById('contactsLoading');
            const grid = document.getElementById('contactsGrid');
            const empty = document.getElementById('contactsEmpty');

            loading.style.display = 'block';
            grid.innerHTML = '';
            empty.style.display = 'none';

            try {
                contacts = await DataService.loadContacts();
                renderAllContacts();
            } catch (err) {
                console.error('Błąd ładowania kontaktów:', err);
                showStatus('Błąd ładowania kontaktów (sprawdź arkusz "Kontakty")', 'error');
                empty.style.display = 'block';
            } finally {
                loading.style.display = 'none';
            }
        }

        async function loadCompanyHistory() {
            companyHistory = [];
            try {
                companyHistory = await DataService.loadCompanyHistory();
            } catch (err) {
                console.warn('HistoriaFirm nie jest dostępna:', err);
            }
        }

        async function loadContactHistory() {
            contactHistory = [];
            try {
                contactHistory = await DataService.loadContactHistory();
            } catch (err) {
                console.warn('HistoriaKontaktow nie jest dostępna:', err);
            }
        }

        // ============= FILTER HELPERS =============
        function getFilteredCompanies() {
            let result = companies;
            
            // Search filter
            if (currentSearchTerm) {
                const q = currentSearchTerm.toLowerCase();
                result = result.filter(c => {
                    const combined = `${c.name} ${c.industry} ${c.notes} ${c.website} ${c.phone} ${c.city} ${c.country}`.toLowerCase();
                    return combined.includes(q);
                });
            }
            
            // Tag filter
            if (currentTagFilter && currentTagFilter.type === 'company') {
                result = DataService.getCompaniesByTag(
                    currentTagFilter.id,
                    result,
                    companyTagRelations
                );
            }
            
            return result;
        }

        function getFilteredContacts() {
            let result = contacts;
            
            // Search filter
            if (currentSearchTerm) {
                const q = currentSearchTerm.toLowerCase();
                result = result.filter(contact => {
                    const company = companies.find(c => c.id === contact.companyId);
                    const companyText = company
                        ? `${company.name} ${company.industry} ${company.city} ${company.country}`
                        : '';
                    const combined = `${contact.name} ${contact.position} ${contact.email} ${contact.phone} ${companyText}`.toLowerCase();
                    return combined.includes(q);
                });
            }
            
            // Tag filter
            if (currentTagFilter && currentTagFilter.type === 'contact') {
                result = DataService.getContactsByTag(
                    currentTagFilter.id,
                    result,
                    contactTagRelations
                );
            }
            
            return result;
        }

        // ============= RENDER COMPANIES =============
        function renderCompanies() {
            const grid = document.getElementById('companiesGrid');
            const listView = document.getElementById('companiesList');
            const empty = document.getElementById('companiesEmpty');
            const list = getFilteredCompanies();

            if (companies.length === 0) {
                grid.innerHTML = '';
                if (listView) listView.innerHTML = '';
                empty.style.display = 'block';
                return;
            }

            if (list.length === 0) {
                grid.innerHTML = '';
                if (listView) listView.innerHTML = '';
                empty.style.display = 'block';
                empty.querySelector('h3').textContent = 'Brak wyników';
                empty.querySelector('p').textContent = 'Brak firm dla aktualnego wyszukiwania.';
                return;
            }

            empty.style.display = 'none';

            if (companiesViewMode === 'list' && listView) {
                listView.innerHTML = `
                    <table class="list-view-table">
                        <thead>
                            <tr>
                                <th style="width: 40px;">
                                    <input type="checkbox" 
                                           id="selectAllCompaniesCheckbox" 
                                           onchange="handleSelectAllCompanies(this)"
                                           ${selectedCompanyIds.length > 0 && selectedCompanyIds.length === list.length ? 'checked' : ''}>
                                </th>
                                <th>Nazwa firmy</th>
                                <th>Branża</th>
                                <th>Miasto</th>
                                <th>Telefon</th>
                                <th>Kontakty</th>
                                <th style="width: 100px;">Akcje</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map(company => {
                                const companyContacts = contacts.filter(c => c.companyId === company.id);
                                const idx = companies.indexOf(company);
                                const isSelected = selectedCompanyIds.includes(company.id);
                                return `
                                    <tr onclick="viewCompanyDetail('${company.id}')">
                                        <td onclick="event.stopPropagation()">
                                            <input type="checkbox" 
                                                   onchange="toggleCompanySelection('${company.id}', event)"
                                                   ${isSelected ? 'checked' : ''}>
                                        </td>
                                        <td><strong>${escapeHtml(company.name)}</strong></td>
                                        <td>${company.industry ? escapeHtml(company.industry) : '-'}</td>
                                        <td>${company.city ? escapeHtml(company.city) : '-'}</td>
                                        <td>${company.phone ? escapeHtml(company.phone) : '-'}</td>
                                        <td>👥 ${companyContacts.length}</td>
                                        <td onclick="event.stopPropagation()">
                                            <div class="actions-cell">
                                                <button class="icon-btn" onclick="editCompany(${idx})" title="Edytuj">✏️</button>
                                                <button class="icon-btn delete" onclick="deleteCompany(${idx})" title="Usuń">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                grid.innerHTML = list.map(company => {
                    const companyContacts = contacts.filter(c => c.companyId === company.id);
                    const isSelected = selectedCompanyIds.includes(company.id);
                    let infoRows = '';

                    if (company.website) {
                        infoRows += `<div class="card-info-row"><span class="emoji">🌐</span><span>${escapeHtml(company.website)}</span></div>`;
                    }
                    if (company.phone) {
                        infoRows += `<div class="card-info-row"><span class="emoji">📞</span><span>${escapeHtml(company.phone)}</span></div>`;
                    }
                    if (company.city || company.country) {
                        const loc = [company.city, company.country].filter(Boolean).join(', ');
                        infoRows += `<div class="card-info-row"><span class="emoji">📍</span><span>${escapeHtml(loc)}</span></div>`;
                    }

                    const idx = companies.indexOf(company);
                    return `
                        <div class="card clickable ${isSelected ? 'selected' : ''}" onclick="viewCompanyDetail('${company.id}')">
                            <div class="card-checkbox" onclick="event.stopPropagation()">
                                <input type="checkbox" 
                                       onchange="toggleCompanySelection('${company.id}', event)"
                                       ${isSelected ? 'checked' : ''}>
                            </div>
                            <div class="card-header">
                                <div>
                                    <div class="card-title">${escapeHtml(company.name)}</div>
                                    ${company.industry ? `<div class="card-meta">${escapeHtml(company.industry)}</div>` : ''}
                                </div>
                                <div class="card-actions" onclick="event.stopPropagation()">
                                    <button class="icon-btn" onclick="editCompany(${idx})" title="Edytuj">✏️</button>
                                    <button class="icon-btn delete" onclick="deleteCompany(${idx})" title="Usuń">🗑️</button>
                                </div>
                            </div>
                            ${infoRows ? `<div class="card-body">${infoRows}</div>` : ''}

                            ${renderEntityTags(company.id, 'company')}
                            <div class="card-badge"><span>👥</span><span>${companyContacts.length} kontaktów</span></div>
                        </div>
                    `;
                }).join('');
            }
        }

        function handleSelectAllCompanies(checkbox) {
            if (checkbox.checked) {
                selectAllCompanies();
            } else {
                deselectAllCompanies();
            }
        }


// ============= RENDER CONTACTS =============
        function renderAllContacts() {
            const grid = document.getElementById('contactsGrid');
            const listView = document.getElementById('contactsList');
            const empty = document.getElementById('contactsEmpty');
            const list = getFilteredContacts();

            if (contacts.length === 0) {
                grid.innerHTML = '';
                if (listView) listView.innerHTML = '';
                empty.style.display = 'block';
                return;
            }

            if (list.length === 0) {
                grid.innerHTML = '';
                if (listView) listView.innerHTML = '';
                empty.style.display = 'block';
                empty.querySelector('h3').textContent = 'Brak wyników';
                empty.querySelector('p').textContent = 'Brak kontaktów dla aktualnego wyszukiwania.';
                return;
            }

            empty.style.display = 'none';

            if (contactsViewMode === 'list' && listView) {
                listView.innerHTML = `
                    <table class="list-view-table">
                        <thead>
                            <tr>
                                <th style="width: 40px;">
                                    <input type="checkbox" 
                                           id="selectAllContactsCheckbox" 
                                           onchange="handleSelectAllContacts(this)"
                                           ${selectedContactIds.length > 0 && selectedContactIds.length === list.length ? 'checked' : ''}>
                                </th>
                                <th>Imię i nazwisko</th>
                                <th>Firma</th>
                                <th>Stanowisko</th>
                                <th>Email</th>
                                <th>Telefon</th>
                                <th style="width: 100px;">Akcje</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map(contact => {
                                const index = contacts.findIndex(c => c.id === contact.id);
                                const company = companies.find(c => c.id === contact.companyId);
                                const isSelected = selectedContactIds.includes(contact.id);
                                return `
                                    <tr onclick="viewContactDetail('${contact.id}')">
                                        <td onclick="event.stopPropagation()">
                                            <input type="checkbox" 
                                                   onchange="toggleContactSelection('${contact.id}', event)"
                                                   ${isSelected ? 'checked' : ''}>
                                        </td>
                                        <td><strong>${escapeHtml(contact.name)}</strong></td>
                                        <td>${company ? escapeHtml(company.name) : '<span style="color: var(--text-secondary);">Brak</span>'}</td>
                                        <td>${contact.position ? escapeHtml(contact.position) : '-'}</td>
                                        <td>${contact.email ? escapeHtml(contact.email) : '-'}</td>
                                        <td>${contact.phone ? escapeHtml(contact.phone) : '-'}</td>
                                        <td onclick="event.stopPropagation()">
                                            <div class="actions-cell">
                                                <button class="icon-btn" onclick="editContact(${index})" title="Edytuj">✏️</button>
                                                <button class="icon-btn delete" onclick="deleteContact(${index})" title="Usuń">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                grid.innerHTML = list.map(contact => {
                    const index = contacts.findIndex(c => c.id === contact.id);
                    const company = companies.find(c => c.id === contact.companyId);
                    const isSelected = selectedContactIds.includes(contact.id);
                    return `
                        <div class="card clickable ${isSelected ? 'selected' : ''}" onclick="viewContactDetail('${contact.id}')">
                            <div class="card-checkbox" onclick="event.stopPropagation()">
                                <input type="checkbox" 
                                       onchange="toggleContactSelection('${contact.id}', event)"
                                       ${isSelected ? 'checked' : ''}>
                            </div>
                            <div class="card-header">
                                <div>
                                    <div class="card-title">${escapeHtml(contact.name)}</div>
                                    ${contact.position ? `<div class="card-meta">${escapeHtml(contact.position)}</div>` : ''}
                                </div>
                                <div class="card-actions" onclick="event.stopPropagation()">
                                    <button class="icon-btn" onclick="editContact(${index})" title="Edytuj">✏️</button>
                                    <button class="icon-btn delete" onclick="deleteContact(${index})" title="Usuń">🗑️</button>
                                </div>
                            </div>
                            <div class="card-body">
                                ${company ? `<div class="card-info-row"><span class="emoji">🏢</span><span>${escapeHtml(company.name)}</span></div>` : `<div class="card-badge no-company"><span>⚠️</span><span>Brak firmy</span></div>`}
                                ${contact.email ? `<div class="card-info-row"><span class="emoji">📧</span><span>${escapeHtml(contact.email)}</span></div>` : ''}
                                ${contact.phone ? `<div class="card-info-row"><span class="emoji">📱</span><span>${escapeHtml(contact.phone)}</span></div>` : ''}

                            ${renderEntityTags(contact.id, 'contact')}
                        </div>
                        </div>
                    `;
                }).join('');
            }
        }

        function handleSelectAllContacts(checkbox) {
            if (checkbox.checked) {
                selectAllContacts();
            } else {
                deselectAllContacts();
            }
        }


// ============= COMPANY DETAIL =============
        function viewCompanyDetail(companyId) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelector('[data-tab="companies"]').classList.add('active');
            document.getElementById('companiesTab').classList.add('active');

            currentCompanyId = companyId;
            const company = companies.find(c => c.id === companyId);
            if (!company) return;

            document.getElementById('companiesListView').style.display = 'none';
            document.getElementById('companyDetailView').classList.add('active');

            let infoHtml = '';
            if (company.website) {
                const url = company.website.startsWith('http') ? company.website : 'https://' + company.website;
                infoHtml += `<div class="detail-info-row"><div class="detail-info-label">Strona WWW</div><div class="detail-info-value"><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(company.website)}</a></div></div>`;
            }
            if (company.phone) infoHtml += `<div class="detail-info-row"><div class="detail-info-label">Telefon</div><div class="detail-info-value">${escapeHtml(company.phone)}</div></div>`;
            if (company.city || company.country) {
                const loc = [company.city, company.country].filter(Boolean).join(', ');
                infoHtml += `<div class="detail-info-row"><div class="detail-info-label">Lokalizacja</div><div class="detail-info-value">${escapeHtml(loc)}</div></div>`;
            }
            if (company.notes) infoHtml += `<div class="detail-info-row"><div class="detail-info-label">Notatki</div><div class="detail-info-value">${escapeHtml(company.notes)}</div></div>`;

            document.getElementById('companyDetailContent').innerHTML = `
                <div style="position: relative;">
                    <button class="icon-btn" onclick="editCompanyFromDetail('${company.id}')" title="Edytuj firmę" style="position: absolute; top: 0; right: 0;">✏️</button>
                    <div class="detail-title">${escapeHtml(company.name)}</div>
                </div>
                ${company.industry ? `<div class="detail-meta">${escapeHtml(company.industry)}</div>` : ''}
                
                <div class="detail-info">
                    ${infoHtml || '<div class="detail-info-row"><div class="detail-info-label">Informacje</div><div class="detail-info-value">Brak dodatkowych informacji.</div></div>'}
                    
                    ${renderDetailTags(company.id, 'company')}
                </div>
            `;
            
            // Setup tag dropdown toggle
            const addBtn = document.getElementById('addCompanyTagBtn');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleTagDropdown('companyTagDropdown', 'addCompanyTagBtn');
                });
            }

            renderCompanyContacts(companyId);
            renderCompanyHistory(companyId);
        }

        function backToCompaniesList() {
            document.getElementById('companyDetailView').classList.remove('active');
            document.getElementById('companiesListView').style.display = 'block';
            currentCompanyId = null;
        }

        function renderCompanyContacts(companyId) {
            const companyContacts = contacts.filter(c => c.companyId === companyId);
            const list = document.getElementById('companyContactsList');
            const empty = document.getElementById('companyContactsEmpty');

            if (companyContacts.length === 0) {
                list.innerHTML = '';
                empty.style.display = 'block';
                return;
            }

            empty.style.display = 'none';
            list.innerHTML = companyContacts.map(contact => {
                const index = contacts.findIndex(c => c.id === contact.id);
                return `
                    <div class="card clickable" onclick="viewContactDetail('${contact.id}')">
                        <div class="card-header">
                            <div>
                                <div class="card-title">${escapeHtml(contact.name)}</div>
                                ${contact.position ? `<div class="card-meta">${escapeHtml(contact.position)}</div>` : ''}
                            </div>
                            <div class="card-actions" onclick="event.stopPropagation()">
                                <button class="icon-btn" onclick="editContact(${index})" title="Edytuj">✏️</button>
                                <button class="icon-btn delete" onclick="deleteContact(${index})" title="Usuń">🗑️</button>
                            </div>
                        </div>
                        <div class="card-body">
                            ${contact.email ? `<div class="card-info-row"><span class="emoji">📧</span><span>${escapeHtml(contact.email)}</span></div>` : ''}
                            ${contact.phone ? `<div class="card-info-row"><span class="emoji">📱</span><span>${escapeHtml(contact.phone)}</span></div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // ============= CONTACT DETAIL =============
        function viewContactDetail(contactId) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelector('[data-tab="contacts"]').classList.add('active');
            document.getElementById('contactsTab').classList.add('active');

            currentContactId = contactId;
            const contact = contacts.find(c => c.id === contactId);
            if (!contact) return;

            document.getElementById('contactsListView').style.display = 'none';
            document.getElementById('contactDetailView').classList.add('active');

            const company = companies.find(c => c.id === contact.companyId);
            let infoHtml = '';
            if (contact.email) infoHtml += `<div class="detail-info-row"><div class="detail-info-label">Email</div><div class="detail-info-value">${escapeHtml(contact.email)}</div></div>`;
            if (contact.phone) infoHtml += `<div class="detail-info-row"><div class="detail-info-label">Telefon</div><div class="detail-info-value">${escapeHtml(contact.phone)}</div></div>`;
            if (company) infoHtml += `<div class="detail-info-row"><div class="detail-info-label">Firma</div><div class="detail-info-value"><span style="cursor:pointer;text-decoration:underline;" onclick="viewCompanyDetail('${company.id}')">${escapeHtml(company.name)}</span></div></div>`;

            document.getElementById('contactDetailContent').innerHTML = `
                <div style="position: relative;">
                    <button class="icon-btn" onclick="editContactFromDetail('${contact.id}')" title="Edytuj kontakt" style="position: absolute; top: 0; right: 0;">✏️</button>
                    <div class="detail-title">${escapeHtml(contact.name)}</div>
                </div>
                ${contact.position ? `<div class="detail-meta">${escapeHtml(contact.position)}</div>` : ''}
                
                <div class="detail-info">
                    ${infoHtml || '<div class="detail-info-row"><div class="detail-info-label">Informacje</div><div class="detail-info-value">Brak dodatkowych informacji.</div></div>'}
                    
                    ${renderDetailTags(contact.id, 'contact')}
                </div>
            `;
            
            // Setup tag dropdown toggle
            const addBtn = document.getElementById('addContactTagBtn');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleTagDropdown('contactTagDropdown', 'addContactTagBtn');
                });
            }

            const companyContainer = document.getElementById('contactCompanyCardContainer');
            const companyEmpty = document.getElementById('contactCompanyEmpty');
            if (company) {
                companyEmpty.style.display = 'none';
                companyContainer.innerHTML = `
                    <div class="card clickable" onclick="viewCompanyDetail('${company.id}')">
                        <div class="card-header">
                            <div>
                                <div class="card-title">${escapeHtml(company.name)}</div>
                                ${company.industry ? `<div class="card-meta">${escapeHtml(company.industry)}</div>` : ''}
                            </div>
                        </div>
                        <div class="card-body">
                            ${company.website ? `<div class="card-info-row"><span class="emoji">🌐</span><span>${escapeHtml(company.website)}</span></div>` : ''}
                            ${company.phone ? `<div class="card-info-row"><span class="emoji">📞</span><span>${escapeHtml(company.phone)}</span></div>` : ''}
                        </div>
                    </div>
                `;
            } else {
                companyContainer.innerHTML = '';
                companyEmpty.style.display = 'block';
            }

            renderContactHistory(contactId);
        }

        function backToContactsList() {
            document.getElementById('contactDetailView').classList.remove('active');
            document.getElementById('contactsListView').style.display = 'block';
            currentContactId = null;
        }

        // ============= COMPANY CRUD =============
        function openCompanyModal() {
            editingCompanyIndex = null;
            document.getElementById('companyModalTitle').textContent = 'Dodaj firmę';
            document.getElementById('companyForm').reset();
            document.getElementById('companyModal').classList.add('active');
        }

function editCompany(index) {
            editingCompanyIndex = index;
            const company = companies[index];
            document.getElementById('companyModalTitle').textContent = 'Edytuj firmę';
            document.getElementById('companyName').value = company.name;
            document.getElementById('companyIndustry').value = company.industry || '';
            
            // Obsługa pola Website (jeśli istnieje w HTML)
            if(document.getElementById('companyWebsite')) {
                document.getElementById('companyWebsite').value = company.website || '';
            }
            
            document.getElementById('companyPhone').value = company.phone || '';
            document.getElementById('companyCity').value = company.city || '';
            document.getElementById('companyCountry').value = company.country || '';
            document.getElementById('companyDomain').value = company.domain || '';
            document.getElementById('companyNotes').value = company.notes || '';
            
            // Tagi - ważne dla zachowania danych
            if (typeof renderTagSelector === 'function') {
                renderTagSelector('companyTagsSelector', 'company', company.tags || '');
            }
            
            document.getElementById('companyModal').classList.add('active');
        }

        function editCompanyFromDetail(companyId) {
            const index = companies.findIndex(c => c.id === companyId);
            if (index !== -1) editCompany(index);
        }

async function saveCompany(e) {
            e.preventDefault();

            // 1. Pobierz wartości
            const name = document.getElementById('companyName').value.trim();
            const domain = document.getElementById('companyDomain').value.trim();
            const phone = document.getElementById('companyPhone').value.trim();
            const industry = document.getElementById('companyIndustry').value.trim();
            const city = document.getElementById('companyCity').value.trim();
            const country = document.getElementById('companyCountry').value.trim();
            const notes = document.getElementById('companyNotes').value.trim();
            
            // 2. Obsługa WWW (Pobierz z inputa lub wygeneruj z domeny)
            let website = document.getElementById('companyWebsite') ? document.getElementById('companyWebsite').value.trim() : '';
            if (!website && domain) {
                website = domain.startsWith('http') ? domain : `https://${domain}`;
            }

            // === DEDUPLIKACJA START ===
            const cleanUrl = (url) => url ? url.toLowerCase().replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').replace(/\/$/, '') : '';
            const cleanPhone = (ph) => ph ? ph.replace(/[\s-]/g, '') : '';
            const cleanName = (str) => str ? str.toLowerCase().replace(/\b(sp\.? ?z ?o\.?o\.?|s\.?a\.?|inc\.?|ltd\.?|gmbh)\b/g, '').replace(/[.,"\-]/g, '').replace(/\s+/g, ' ').trim() : '';

            if (!window.skipDuplicateCheck) {
                const currentId = editingCompanyIndex !== null ? companies[editingCompanyIndex].id : null;
                const inputCleanWeb = cleanUrl(website);
                const inputCleanDomain = cleanUrl(domain);
                const inputCleanPhone = cleanPhone(phone);
                const inputCleanName = cleanName(name);

                const duplicate = companies.find(c => {
                    if (c.id === currentId) return false;
                    
                    // A. Nazwa (inteligentne dopasowanie)
                    const storedCleanName = cleanName(c.name);
                    const matchName = inputCleanName && storedCleanName && inputCleanName === storedCleanName;

                    // B. WWW / Domena (krzyżowe sprawdzanie)
                    const storedWeb = cleanUrl(c.website);
                    const storedDomain = cleanUrl(c.domain);
                    const matchWeb = (inputCleanWeb && (inputCleanWeb === storedWeb || inputCleanWeb === storedDomain)) ||
                                     (inputCleanDomain && (inputCleanDomain === storedWeb || inputCleanDomain === storedDomain));

                    // C. Telefon
                    const matchPhone = inputCleanPhone && cleanPhone(c.phone) === inputCleanPhone;

                    return matchName || matchWeb || matchPhone;
                });

                if (duplicate) {
                    const modal = document.getElementById('duplicateModal');
                    const content = document.getElementById('duplicateContent');
                    const saveAnywayBtn = document.getElementById('saveAnywayBtn');
                    const backBtn = document.getElementById('backToEditBtn');

                    content.innerHTML = `
                        <div>Znaleziono firmę o podobnych danych:</div>
                        <div style="background:rgba(15,23,42,0.05); padding:12px; border-radius:8px; margin-top:10px; border:1px solid var(--border-subtle);">
                            <div style="font-size:1.1em; font-weight:600;">🏢 ${escapeHtml(duplicate.name)}</div>
                            ${duplicate.domain ? `<div>🌐 ${escapeHtml(duplicate.domain)}</div>` : ''}
                            ${duplicate.phone ? `<div>📞 ${escapeHtml(duplicate.phone)}</div>` : ''}
                        </div>
                        <div style="margin-top:15px; font-size:0.9rem;">Czy na pewno chcesz utworzyć nową?</div>
                    `;
                    modal.classList.add('active');
                    
                    saveAnywayBtn.onclick = () => { 
                        window.skipDuplicateCheck = true; 
                        modal.classList.remove('active'); 
                        document.getElementById('companyForm').requestSubmit(); 
                    };
                    backBtn.onclick = () => { 
                        modal.classList.remove('active'); 
                        window.skipDuplicateCheck = false; 
                    };
                    return; // STOP
                }
            }
            window.skipDuplicateCheck = false;
            // === DEDUPLIKACJA KONIEC ===

            // Pobierz tagi (Logic from your latest file)
            let tagsIds = '';
            if (typeof getSelectedTagsFromSelector === 'function') {
                tagsIds = getSelectedTagsFromSelector('companyTagsSelector');
            } else if (editingCompanyIndex !== null) {
                tagsIds = companies[editingCompanyIndex].tags || '';
            }

            const company = {
                id: editingCompanyIndex !== null ? companies[editingCompanyIndex].id : DataService.generateId(),
                name, industry, website, phone, city, country, domain, notes,
                tags: tagsIds
            };

            try {
                await DataService.saveCompany(company, editingCompanyIndex);
                
                if (editingCompanyIndex !== null) {
                    companies[editingCompanyIndex] = company;
                    await DataService.logCompanyHistory(company.id, 'event', 'Firma zaktualizowana');
                    showStatus('Firma zaktualizowana', 'success');
                } else {
                    companies.push(company);
                    await DataService.logCompanyHistory(company.id, 'event', 'Firma utworzona');
                    showStatus('Firma dodana', 'success');
                }

                renderCompanies();
                if (currentCompanyId === company.id) viewCompanyDetail(company.id);
                closeCompanyModal();
                await loadCompanyHistory();
            } catch (err) {
                console.error('Błąd zapisu firmy:', err);
                showStatus('Błąd zapisu firmy', 'error');
            }
        }

        async function deleteCompany(index) {
            if (!confirm('Czy na pewno chcesz usunąć tę firmę?')) return;
            try {
                const companyId = companies[index].id;
                await DataService.logCompanyHistory(companyId, 'event', 'Firma usunięta');
                await DataService.deleteCompany(index);

                const detachPromises = [];
                contacts.forEach((contact, cIndex) => {
                    if (contact.companyId === companyId) {
                        contact.companyId = '';
                        detachPromises.push(DataService.saveContact(contact, cIndex));
                        DataService.logContactHistory(contact.id, 'event', `Kontakt odpięty od usuniętej firmy`);
                    }
                });
                if (detachPromises.length) await Promise.all(detachPromises);

                companies.splice(index, 1);
                renderCompanies();
                renderAllContacts();
                if (currentCompanyId === companyId) backToCompaniesList();
                showStatus('Firma usunięta', 'success');
                await loadCompanyHistory();
            } catch (err) {
                console.error('Błąd usuwania firmy:', err);
                showStatus('Błąd usuwania firmy', 'error');
            }
        }

        function closeCompanyModal() {
            document.getElementById('companyModal').classList.remove('active');
            document.getElementById('companyForm').reset();
            editingCompanyIndex = null;
        }

        // ============= CONTACT CRUD =============
        function openContactModal(preselectedCompanyId = null) {
            editingContactIndex = null;
            document.getElementById('contactModalTitle').textContent = 'Dodaj kontakt';
            document.getElementById('contactForm').reset();
            fillCompanyField(preselectedCompanyId);
            hideCompanySuggestions();
            document.getElementById('contactModal').classList.add('active');
        }

        function editContact(index) {
            editingContactIndex = index;
            const contact = contacts[index];
            document.getElementById('contactModalTitle').textContent = 'Edytuj kontakt';
            document.getElementById('contactName').value = contact.name;
            document.getElementById('contactPosition').value = contact.position;
            document.getElementById('contactEmail').value = contact.email;
            document.getElementById('contactPhone').value = contact.phone;
            fillCompanyField(contact.companyId || null);
            hideCompanySuggestions();
            document.getElementById('contactModal').classList.add('active');
        }

        function editContactFromDetail(contactId) {
            const index = contacts.findIndex(c => c.id === contactId);
            if (index !== -1) editContact(index);
        }

        function fillCompanyField(companyId) {
            if (!companyInputEl || !companyIdEl) return;
            if (!companyId) {
                companyInputEl.value = '';
                companyIdEl.value = '';
                return;
            }
            const company = companies.find(c => c.id === companyId);
            if (company) {
                companyInputEl.value = company.name;
                companyIdEl.value = company.id;
            }
        }

        async function saveContact(e) {
            e.preventDefault();
            const typedCompanyName = (companyInputEl?.value || '').trim();
            let selectedCompanyId = companyIdEl?.value || '';
            
            const name = document.getElementById('contactName').value.trim();
            const email = document.getElementById('contactEmail').value.trim();
            const phone = document.getElementById('contactPhone').value.trim();
            const position = document.getElementById('contactPosition').value.trim();

            // === DEDUPLIKACJA START ===
            if (!window.skipDuplicateCheck) {
                const currentId = editingContactIndex !== null ? contacts[editingContactIndex].id : null;
                const duplicate = contacts.find(c => {
                    if (c.id === currentId) return false;
                    
                    const matchName = name && c.name && c.name.toLowerCase() === name.toLowerCase();
                    const matchEmail = email && c.email && c.email.toLowerCase() === email.toLowerCase();
                    const clean = (p) => (p || '').replace(/[\s-]/g, '');
                    const matchPhone = phone && c.phone && clean(phone) === clean(c.phone);
                    
                    return matchName || matchEmail || matchPhone;
                });

                if (duplicate) {
                    const modal = document.getElementById('duplicateModal');
                    const content = document.getElementById('duplicateContent');
                    const saveAnywayBtn = document.getElementById('saveAnywayBtn');
                    const backBtn = document.getElementById('backToEditBtn');

                    content.innerHTML = `
                        <div>Znaleziono kontakt o podobnych danych:</div>
                        <div style="background:rgba(15,23,42,0.05); padding:12px; border-radius:8px; margin-top:10px; border:1px solid var(--border-subtle);">
                            <div style="font-size:1.1em; font-weight:600;">${escapeHtml(duplicate.name)}</div>
                            ${duplicate.email ? `<div>📧 ${escapeHtml(duplicate.email)}</div>` : ''}
                            ${duplicate.phone ? `<div>📱 ${escapeHtml(duplicate.phone)}</div>` : ''}
                        </div>
                        <div style="margin-top:15px; font-size:0.9rem;">Czy na pewno chcesz utworzyć ten kontakt?</div>
                    `;
                    modal.classList.add('active');
                    saveAnywayBtn.onclick = () => {
                        window.skipDuplicateCheck = true;
                        modal.classList.remove('active');
                        document.getElementById('contactForm').requestSubmit(); 
                    };
                    backBtn.onclick = () => {
                        modal.classList.remove('active');
                        window.skipDuplicateCheck = false;
                    };
                    return; // STOP
                }
            }
            window.skipDuplicateCheck = false;
            // === DEDUPLIKACJA KONIEC ===

            // Auto-match by domain
            if (!typedCompanyName && !selectedCompanyId && email) {
                const domain = DataService.extractDomain(email);
                const matchedCompany = DataService.findCompanyByDomain(companies, domain);
                if (matchedCompany) {
                    selectedCompanyId = matchedCompany.id;
                    companyInputEl.value = matchedCompany.name;
                    showStatus(`🎯 Auto-dopasowano firmę: ${matchedCompany.name}`, 'success');
                }
            }

            try {
                // LOGIKA TWORZENIA FIRMY "W LOCIE"
                if (typedCompanyName && !selectedCompanyId) {
                    const existing = companies.find(c => c.name && c.name.toLowerCase() === typedCompanyName.toLowerCase());
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
                        companies.push(newCompany);
                        selectedCompanyId = newCompany.id;
                        await DataService.logCompanyHistory(newCompany.id, 'event', 'Firma utworzona (z poziomu kontaktu)');
                        await loadCompanyHistory(); // Odśwież dane
                        showStatus(`Utworzono nową firmę "${newCompany.name}"`, 'success');
                        renderCompanies();
                    }
                }

                // Pobierz tagi (Logic from your latest file)
                let tagsIds = '';
                if (typeof getSelectedTagsFromSelector === 'function') {
                    tagsIds = getSelectedTagsFromSelector('contactTagsSelector');
                } else if (editingContactIndex !== null) {
                    tagsIds = contacts[editingContactIndex].tags || '';
                }

                const contact = {
                    id: editingContactIndex !== null ? contacts[editingContactIndex].id : DataService.generateId(),
                    companyId: selectedCompanyId || '',
                    name, position, email, phone,
                    tags: tagsIds
                };

                await DataService.saveContact(contact, editingContactIndex);

                if (editingContactIndex !== null) {
                    contacts[editingContactIndex] = contact;
                    await DataService.logContactHistory(contact.id, 'event', 'Kontakt zaktualizowany');
                    showStatus('Kontakt zaktualizowany', 'success');
                } else {
                    contacts.push(contact);
                    await DataService.logContactHistory(contact.id, 'event', 'Kontakt utworzony');
                    if (contact.companyId) await DataService.logCompanyHistory(contact.companyId, 'event', `Kontakt "${contact.name}" powiązany z firmą`);
                    showStatus('Kontakt dodany', 'success');
                }

                renderAllContacts();
                renderCompanies();
                if (currentCompanyId) {
                    renderCompanyContacts(currentCompanyId);
                    renderCompanyHistory(currentCompanyId);
                }
                if (currentContactId === contact.id) viewContactDetail(contact.id);
                closeContactModal();
                await loadContactHistory();
            } catch (err) {
                console.error('Błąd zapisu kontaktu:', err);
                showStatus('Błąd zapisu kontaktu', 'error');
            }
        }

        async function deleteContact(index) {
            if (!confirm('Czy na pewno chcesz usunąć ten kontakt?')) return;
            try {
                const contact = contacts[index];
                await DataService.logContactHistory(contact.id, 'event', 'Kontakt usunięty');
                if (contact.companyId) await DataService.logCompanyHistory(contact.companyId, 'event', `Kontakt "${contact.name}" usunięty`);
                await DataService.deleteContact(index);

                contacts.splice(index, 1);
                renderAllContacts();
                renderCompanies();
                if (currentCompanyId) {
                    renderCompanyContacts(currentCompanyId);
                    renderCompanyHistory(currentCompanyId);
                }
                if (currentContactId === contact.id) backToContactsList();
                showStatus('Kontakt usunięty', 'success');
                await loadContactHistory();
            } catch (err) {
                console.error('Błąd usuwania kontaktu:', err);
                showStatus('Błąd usuwania kontaktu', 'error');
            }
        }

        function closeContactModal() {
            document.getElementById('contactModal').classList.remove('active');
            document.getElementById('contactForm').reset();
            hideCompanySuggestions();
            editingContactIndex = null;
        }

        // ============= COMPANY PICKER =============
        function showCompanySuggestions(query) {
            if (!companySuggestionsEl || !companyInputEl) return;
            const q = (query || '').trim().toLowerCase();
            let filtered = q ? companies.filter(c => (c.name || '').toLowerCase().includes(q)) : companies;

            let html = '';
            filtered.slice(0, 8).forEach(c => {
                const meta = [c.industry, c.city].filter(Boolean).join(' • ');
                html += `<div class="company-suggestion-item" data-id="${c.id}"><span>${escapeHtml(c.name)}</span>${meta ? `<span class="suggestion-meta">${escapeHtml(meta)}</span>` : ''}</div>`;
            });

            const exactExists = companies.some(c => c.name && c.name.toLowerCase() === q && q.length > 0);
            if (q && !exactExists) {
                html += `<div class="company-suggestion-item company-suggestion-new"><span>➕ Utwórz nową firmę "<strong>${escapeHtml(query.trim())}</strong>"</span></div>`;
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

        // ============= HISTORY =============
        function renderCompanyHistory(companyId) {
            const list = document.getElementById('companyHistoryList');
            const empty = document.getElementById('companyHistoryEmpty');
            if (!list || !empty) return;

            const scope = currentCompanyHistoryScope;
            
            // Dla scope 'all' - pobierz aktywności + notatki (bez events)
            if (scope === 'all') {
                renderCompanyAll(companyId);
                return;
            }
            
            // Dla scope 'activities' - renderuj aktywności
            if (scope === 'activities') {
                renderCompanyActivities(companyId);
                return;
            }
            
            // Dla scope 'notes' lub 'full'
            const all = companyHistory.filter(h => h.companyId === companyId).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
            const shown = scope === 'notes' ? all.filter(h => h.type === 'note') : all;

            if (shown.length === 0) {
                list.innerHTML = '';
                empty.style.display = 'block';
                return;
            }

            empty.style.display = 'none';
            list.innerHTML = shown.map(entry => `
                <div class="history-item ${entry.type === 'note' ? 'note' : 'event'}">
                    <div class="history-item-header">
                        <span class="history-item-type">${entry.type === 'note' ? 'NOTATKA' : 'ZDARZENIE'}</span>
                        <span class="history-item-meta">${DataService.formatDateTime(entry.timestamp)}${entry.user ? ' • ' + escapeHtml(formatUserName(entry.user)) : ''}</span>
                    </div>
                    <div class="history-item-body">${escapeHtml(entry.content || '')}</div>
                </div>
            `).join('');
        }

        function renderContactHistory(contactId) {
            const list = document.getElementById('contactHistoryList');
            const empty = document.getElementById('contactHistoryEmpty');
            if (!list || !empty) return;

            const scope = currentContactHistoryScope;
            
            // Dla scope 'all' - pobierz aktywności + notatki (bez events)
            if (scope === 'all') {
                renderContactAll(contactId);
                return;
            }
            
            // Dla scope 'activities' - renderuj aktywności
            if (scope === 'activities') {
                renderContactActivities(contactId);
                return;
            }
            
            // Dla scope 'notes' lub 'full'
            const all = contactHistory.filter(h => h.contactId === contactId).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
            const shown = scope === 'notes' ? all.filter(h => h.type === 'note') : all;

            if (shown.length === 0) {
                list.innerHTML = '';
                empty.style.display = 'block';
                return;
            }

            empty.style.display = 'none';
            list.innerHTML = shown.map(entry => `
                <div class="history-item ${entry.type === 'note' ? 'note' : 'event'}">
                    <div class="history-item-header">
                        <span class="history-item-type">${entry.type === 'note' ? 'NOTATKA' : 'ZDARZENIE'}</span>
                        <span class="history-item-meta">${DataService.formatDateTime(entry.timestamp)}${entry.user ? ' • ' + escapeHtml(formatUserName(entry.user)) : ''}</span>
                    </div>
                    <div class="history-item-body">${escapeHtml(entry.content || '')}</div>
                </div>
            `).join('');
        }
/**
         * Renderuj "Wszystko" dla firmy - aktywności + notatki (bez events)
         */
        function renderCompanyAll(companyId) {
            const list = document.getElementById('companyHistoryList');
            const empty = document.getElementById('companyHistoryEmpty');
            
            // Pobierz aktywności
            const activities = companyActivities.filter(a => a.companyId === companyId);
            
            // Pobierz notatki (tylko type==='note', bez events)
            const notes = companyHistory.filter(h => h.companyId === companyId && h.type === 'note');
            
            // Połącz i sortuj chronologicznie
            const combined = [
                ...activities.map(a => ({ ...a, itemType: 'activity' })),
                ...notes.map(n => ({ ...n, itemType: 'note' }))
            ].sort((a, b) => {
                const dateA = a.itemType === 'activity' ? a.date : a.timestamp;
                const dateB = b.itemType === 'activity' ? b.date : b.timestamp;
                return (dateB || '').localeCompare(dateA || '');
            });
            
            if (combined.length === 0) {
                list.innerHTML = '';
                empty.style.display = 'block';
                empty.querySelector('h3').textContent = 'Brak aktywności';
                empty.querySelector('p').textContent = 'Nie dodano jeszcze żadnych aktywności ani notatek.';
                return;
            }
            
            empty.style.display = 'none';
            list.innerHTML = combined.map(item => {
                if (item.itemType === 'activity') {
                    // Render aktywności
                    const formatted = ActivitiesService.formatActivity(item);
                    return `
                        <div class="activity-item" style="border-left-color: ${formatted.typeColor}">
                            <div class="activity-item-header">
                                <span class="activity-item-icon">${formatted.typeIcon}</span>
                                <span class="activity-item-type">${formatted.typeLabel}</span>
                                <span class="activity-status ${item.status}">${formatted.statusLabel}</span>
                            </div>
                            <div class="activity-item-title">${escapeHtml(formatted.title)}</div>
                            <div class="activity-item-date">${formatted.formattedDate}</div>
                            ${formatted.notes ? `<div class="activity-item-notes">${escapeHtml(formatted.notes)}</div>` : ''}
                            <div class="activity-item-actions">
                                ${item.status === 'planned' ? `<button onclick="completeActivity('${item.id}')">✓ Ukończ</button>` : ''}
                                <button onclick="deleteActivity('${item.id}')">🗑️ Usuń</button>
                            </div>
                        </div>
                    `;
                } else {
                    // Render notatki
                    return `
                        <div class="history-item note">
                            <div class="history-item-header">
                                <span class="history-item-type">NOTATKA</span>
                                <span class="history-item-meta">${DataService.formatDateTime(item.timestamp)}${item.user ? ' • ' + escapeHtml(formatUserName(item.user)) : ''}</span>
                            </div>
                            <div class="history-item-body">${escapeHtml(item.content || '')}</div>
                        </div>
                    `;
                }
            }).join('');
        }

        /**
         * Renderuj "Wszystko" dla kontaktu - aktywności + notatki (bez events)
         */
        function renderContactAll(contactId) {
            const list = document.getElementById('contactHistoryList');
            const empty = document.getElementById('contactHistoryEmpty');
            
            // Pobierz aktywności
            const activities = contactActivities.filter(a => a.contactId === contactId);
            
            // Pobierz notatki (tylko type==='note', bez events)
            const notes = contactHistory.filter(h => h.contactId === contactId && h.type === 'note');
            
            // Połącz i sortuj chronologicznie
            const combined = [
                ...activities.map(a => ({ ...a, itemType: 'activity' })),
                ...notes.map(n => ({ ...n, itemType: 'note' }))
            ].sort((a, b) => {
                const dateA = a.itemType === 'activity' ? a.date : a.timestamp;
                const dateB = b.itemType === 'activity' ? b.date : b.timestamp;
                return (dateB || '').localeCompare(dateA || '');
            });
            
            if (combined.length === 0) {
                list.innerHTML = '';
                empty.style.display = 'block';
                empty.querySelector('h3').textContent = 'Brak aktywności';
                empty.querySelector('p').textContent = 'Nie dodano jeszcze żadnych aktywności ani notatek.';
                return;
            }
            
            empty.style.display = 'none';
            list.innerHTML = combined.map(item => {
                if (item.itemType === 'activity') {
                    // Render aktywności
                    const formatted = ActivitiesService.formatActivity(item);
                    return `
                        <div class="activity-item" style="border-left-color: ${formatted.typeColor}">
                            <div class="activity-item-header">
                                <span class="activity-item-icon">${formatted.typeIcon}</span>
                                <span class="activity-item-type">${formatted.typeLabel}</span>
                                <span class="activity-status ${item.status}">${formatted.statusLabel}</span>
                            </div>
                            <div class="activity-item-title">${escapeHtml(formatted.title)}</div>
                            <div class="activity-item-date">${formatted.formattedDate}</div>
                            ${formatted.notes ? `<div class="activity-item-notes">${escapeHtml(formatted.notes)}</div>` : ''}
                            <div class="activity-item-actions">
                                ${item.status === 'planned' ? `<button onclick="completeActivity('${item.id}')">✓ Ukończ</button>` : ''}
                                <button onclick="deleteActivity('${item.id}')">🗑️ Usuń</button>
                            </div>
                        </div>
                    `;
                } else {
                    // Render notatki
                    return `
                        <div class="history-item note">
                            <div class="history-item-header">
                                <span class="history-item-type">NOTATKA</span>
                                <span class="history-item-meta">${DataService.formatDateTime(item.timestamp)}${item.user ? ' • ' + escapeHtml(formatUserName(item.user)) : ''}</span>
                            </div>
                            <div class="history-item-body">${escapeHtml(item.content || '')}</div>
                        </div>
                    `;
                }
            }).join('');
        }
        function openNoteModal(entityType, entityId) {
            if (!entityId) {
                showStatus('Najpierw wybierz rekord', 'error');
                return;
            }
            noteEntityTypeEl.value = entityType;
            noteEntityIdEl.value = entityId;
            noteContentEl.value = '';
            document.getElementById('noteModalTitle').textContent = entityType === 'company' ? 'Nowa notatka – firma' : 'Nowa notatka – kontakt';
            document.getElementById('noteModal').classList.add('active');
            noteContentEl.focus();
        }

        function closeNoteModal() {
            document.getElementById('noteModal').classList.remove('active');
            noteContentEl.value = '';
        }

        async function saveNote(e) {
            e.preventDefault();
            const entityType = noteEntityTypeEl.value;
            const entityId = noteEntityIdEl.value;
            const content = noteContentEl.value.trim();
            if (!content) {
                noteContentEl.focus();
                return;
            }

            try {
                if (entityType === 'company') {
                    await DataService.logCompanyHistory(entityId, 'note', content);
                    if (currentCompanyId === entityId) {
                        await loadCompanyHistory();
                        renderCompanyHistory(entityId);
                    }
                } else if (entityType === 'contact') {
                    await DataService.logContactHistory(entityId, 'note', content);
                    if (currentContactId === entityId) {
                        await loadContactHistory();
                        renderContactHistory(entityId);
                    }
                }
                showStatus('Notatka dodana', 'success');
                closeNoteModal();
            } catch (err) {
                console.error('Błąd dodawania notatki:', err);
                showStatus('Błąd dodawania notatki', 'error');
            }
        }

        // ============= VIEW SWITCHING =============
        window.switchContactsView = function(mode) {
            contactsViewMode = mode;
            document.querySelectorAll('#contactsTab .view-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === mode);
            });
            const grid = document.getElementById('contactsGrid');
            const list = document.getElementById('contactsList');
            if (mode === 'grid') {
                grid.style.display = 'grid';
                list.style.display = 'none';
            } else {
                grid.style.display = 'none';
                list.style.display = 'block';
            }
            renderAllContacts();
        };

        window.switchCompaniesView = function(mode) {
            companiesViewMode = mode;
            document.querySelectorAll('#companiesListView .view-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === mode);
            });
            const grid = document.getElementById('companiesGrid');
            const list = document.getElementById('companiesList');
            if (mode === 'grid') {
                grid.style.display = 'grid';
                list.style.display = 'none';
            } else {
                grid.style.display = 'none';
                list.style.display = 'block';
            }
            renderCompanies();
        };

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


        /**
         * Konwertuje email na display name jeśli to jest aktualny użytkownik
         */
        function formatUserName(userName) {
            if (!userName) return '';
            
            const currentEmail = AuthService.getUserEmail();
            const displayName = AuthService.getDisplayName();
            
            // Jeśli userName to email aktualnego użytkownika i mamy display name
            if (userName === currentEmail && displayName) {
                return displayName;
            }
            
            // Jeśli userName to email aktualnego użytkownika ale nie ma display name
            if (userName === currentEmail) {
                return currentEmail.split('@')[0];
            }
            
            // Dla innych użytkowników - zwróć jak jest (może być email lub już display name)
            return userName;
        }

// ============= ACTIVITIES =============

        async function loadActivitiesData() {
            try {
                companyActivities = await DataService.loadActivities();
                contactActivities = companyActivities;
                console.log('✓ Aktywności załadowane:', companyActivities.length);
            } catch (error) {
                console.warn('Nie udało się załadować aktywności:', error);
                companyActivities = [];
                contactActivities = [];
            }
        }

        function openActivityModal(entityType, entityId) {
            if (!entityId) {
                showStatus('Najpierw wybierz rekord', 'error');
                return;
            }
            
            document.getElementById('activityEntityType').value = entityType;
            document.getElementById('activityEntityId').value = entityId;
            document.getElementById('activityType').value = 'EMAIL';
            currentActivityType = 'EMAIL';
            
            // Reset form
            document.getElementById('activityForm').reset();
            document.getElementById('activityTitle').value = '';
            document.getElementById('activityNotes').value = '';
            
            // Set default date (now)
            const now = new Date();
            const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
            document.getElementById('activityDate').value = localDateTime;
            
            // Show/hide contact selector
            const contactSelectorGroup = document.getElementById('activityContactSelectorGroup');
            if (entityType === 'company') {
                const companyContacts = contacts.filter(c => c.companyId === entityId);
                const select = document.getElementById('activityContactSelect');
                select.innerHTML = '<option value="">Tylko firma</option>' +
                    companyContacts.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
                contactSelectorGroup.style.display = 'block';
            } else {
                contactSelectorGroup.style.display = 'none';
            }
            
            document.getElementById('activityModal').classList.add('active');
            document.getElementById('activityTitle').focus();
        }

        function closeActivityModal() {
            document.getElementById('activityModal').classList.remove('active');
            document.getElementById('activityForm').reset();
        }

        async function saveActivity(e) {
            e.preventDefault();
            
            const entityType = document.getElementById('activityEntityType').value;
            const entityId = document.getElementById('activityEntityId').value;
            const type = currentActivityType;
            const title = document.getElementById('activityTitle').value;
            const date = document.getElementById('activityDate').value;
            const notes = document.getElementById('activityNotes').value;
            
            let companyId = '';
            let contactId = '';
            
            if (entityType === 'company') {
                companyId = entityId;
                const selectedContactId = document.getElementById('activityContactSelect').value;
                if (selectedContactId) {
                    contactId = selectedContactId;
                }
            } else if (entityType === 'contact') {
                contactId = entityId;
                const contact = contacts.find(c => c.id === contactId);
                if (contact && contact.companyId) {
                    companyId = contact.companyId;
                }
            }
            
            try {
                await ActivitiesService.createActivity({
                    type,
                    title,
                    date: new Date(date).toISOString(),
                    notes,
                    companyId,
                    contactId,
                    status: 'planned'
                });
                
                showStatus('Aktywność dodana', 'success');
                
                await loadActivitiesData();
                
                if (currentCompanyId) {
                    renderCompanyActivities(currentCompanyId);
                    await loadCompanyHistory();
                    renderCompanyHistory(currentCompanyId);
                }
                
                if (currentContactId) {
                    renderContactActivities(currentContactId);
                    await loadContactHistory();
                    renderContactHistory(currentContactId);
                }
                
                closeActivityModal();
            } catch (error) {
                console.error('Błąd zapisu aktywności:', error);
                showStatus('Błąd zapisu: ' + error.message, 'error');
            }
        }

        function renderCompanyActivities(companyId) {
            const list = document.getElementById('companyHistoryList');
            const empty = document.getElementById('companyHistoryEmpty');
            if (!list || !empty) return;
            
            const activities = companyActivities.filter(a => a.companyId === companyId);
            
            if (activities.length === 0) {
                list.innerHTML = '';
                empty.style.display = 'block';
                empty.querySelector('h3').textContent = 'Brak aktywności';
                empty.querySelector('p').textContent = 'Nie dodano jeszcze żadnych aktywności dla tej firmy.';
                return;
            }
            
            empty.style.display = 'none';
            list.innerHTML = activities
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(activity => {
                    const formatted = ActivitiesService.formatActivity(activity);
                    return `
                        <div class="activity-item" style="border-left-color: ${formatted.typeColor}">
                            <div class="activity-item-header">
                                <span class="activity-item-icon">${formatted.typeIcon}</span>
                                <span class="activity-item-type">${formatted.typeLabel}</span>
                                <span class="activity-status ${activity.status}">${formatted.statusLabel}</span>
                            </div>
                            <div class="activity-item-title">${escapeHtml(formatted.title)}</div>
                            <div class="activity-item-date">${formatted.formattedDate}</div>
                            ${formatted.notes ? `<div class="activity-item-notes">${escapeHtml(formatted.notes)}</div>` : ''}
                            <div class="activity-item-actions">
                                ${activity.status === 'planned' ? `<button onclick="completeActivity('${activity.id}')">✓ Ukończ</button>` : ''}
                                <button onclick="deleteActivity('${activity.id}')">🗑️ Usuń</button>
                            </div>
                        </div>
                    `;
                }).join('');
        }

        function renderContactActivities(contactId) {
            const list = document.getElementById('contactHistoryList');
            const empty = document.getElementById('contactHistoryEmpty');
            if (!list || !empty) return;
            
            const activities = contactActivities.filter(a => a.contactId === contactId);
            
            if (activities.length === 0) {
                list.innerHTML = '';
                empty.style.display = 'block';
                empty.querySelector('h3').textContent = 'Brak aktywności';
                empty.querySelector('p').textContent = 'Nie dodano jeszcze żadnych aktywności dla tego kontaktu.';
                return;
            }
            
            empty.style.display = 'none';
            list.innerHTML = activities
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(activity => {
                    const formatted = ActivitiesService.formatActivity(activity);
                    return `
                        <div class="activity-item" style="border-left-color: ${formatted.typeColor}">
                            <div class="activity-item-header">
                                <span class="activity-item-icon">${formatted.typeIcon}</span>
                                <span class="activity-item-type">${formatted.typeLabel}</span>
                                <span class="activity-status ${activity.status}">${formatted.statusLabel}</span>
                            </div>
                            <div class="activity-item-title">${escapeHtml(formatted.title)}</div>
                            <div class="activity-item-date">${formatted.formattedDate}</div>
                            ${formatted.notes ? `<div class="activity-item-notes">${escapeHtml(formatted.notes)}</div>` : ''}
                            <div class="activity-item-actions">
                                ${activity.status === 'planned' ? `<button onclick="completeActivity('${activity.id}')">✓ Ukończ</button>` : ''}
                                <button onclick="deleteActivity('${activity.id}')">🗑️ Usuń</button>
                            </div>
                        </div>
                    `;
                }).join('');
        }

        async function completeActivity(activityId) {
            try {
                await ActivitiesService.completeActivity(activityId);
                showStatus('Aktywność ukończona', 'success');
                
                await loadActivitiesData();
                
                if (currentCompanyId) renderCompanyActivities(currentCompanyId);
                if (currentContactId) renderContactActivities(currentContactId);
            } catch (error) {
                console.error('Błąd:', error);
                showStatus('Błąd: ' + error.message, 'error');
            }
        }

        async function deleteActivity(activityId) {
            if (!confirm('Czy na pewno chcesz usunąć tę aktywność?')) return;
            
            try {
                await ActivitiesService.deleteActivity(activityId);
                showStatus('Aktywność usunięta', 'success');
                
                await loadActivitiesData();
                
                if (currentCompanyId) {
                    renderCompanyActivities(currentCompanyId);
                    await loadCompanyHistory();
                    renderCompanyHistory(currentCompanyId);
                }
                
                if (currentContactId) {
                    renderContactActivities(currentContactId);
                    await loadContactHistory();
                    renderContactHistory(currentContactId);
                }
            } catch (error) {
                console.error('Błąd:', error);
                showStatus('Błąd: ' + error.message, 'error');
            }
        }
        
        // ============= TAGS JAVASCRIPT =============
// Ten kod należy dodać do relationships.html w sekcji 
// ========== TAGS MANAGER MODAL ==========

function openTagsManager(initialType = 'companies') {
    currentTagType = initialType;
    renderColorPickers();
    renderCompanyTagsList();
    renderContactTagsList();
    switchTagsTab(initialType);
    document.getElementById('tagsManagerModal').classList.add('active');
}

function closeTagsManager() {
    document.getElementById('tagsManagerModal').classList.remove('active');
    resetCompanyTagForm();
    resetContactTagForm();
}

function switchTagsTab(type) {
    currentTagType = type;
    
    // Update tabs
    document.querySelectorAll('.tags-modal-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === type);
    });
    
    // Update sections
    document.getElementById('companiesTagsSection').style.display = 
        type === 'companies' ? 'block' : 'none';
    document.getElementById('contactsTagsSection').style.display = 
        type === 'contacts' ? 'block' : 'none';
}

// ========== COLOR PICKER ==========

function renderColorPickers() {
    const colors = CONFIG.TAGS.DEFAULT_COLORS;
    
    // Company tags color picker
    const companyPicker = document.getElementById('companyTagColorPicker');
    companyPicker.innerHTML = colors.map(color => `
        <div class="color-option" 
             style="background-color: ${color}" 
             data-color="${color}"
             onclick="selectColor('company', '${color}')">
        </div>
    `).join('');
    
    // Contact tags color picker
    const contactPicker = document.getElementById('contactTagColorPicker');
    contactPicker.innerHTML = colors.map(color => `
        <div class="color-option" 
             style="background-color: ${color}" 
             data-color="${color}"
             onclick="selectColor('contact', '${color}')">
        </div>
    `).join('');
    
    // Select default color
    selectColor('company', '#3b82f6');
    selectColor('contact', '#3b82f6');
}

function selectColor(type, color) {
    const pickerId = type === 'company' ? 'companyTagColorPicker' : 'contactTagColorPicker';
    const inputId = type === 'company' ? 'companyTagColor' : 'contactTagColor';
    
    // Update hidden input
    document.getElementById(inputId).value = color;
    
    // Update visual selection
    const picker = document.getElementById(pickerId);
    picker.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.color === color);
    });
}

// ========== COMPANY TAGS ==========

async function saveCompanyTag(event) {
    event.preventDefault();
    
    const tagId = document.getElementById('companyTagId').value;
    const rowIndex = document.getElementById('companyTagRowIndex').value;
    
    const tag = {
        id: tagId || DataService.generateId(),
        name: document.getElementById('companyTagName').value.trim(),
        color: document.getElementById('companyTagColor').value,
        description: document.getElementById('companyTagDescription').value.trim()
    };
    
    try {
        await DataService.saveCompanyTag(tag, rowIndex ? parseInt(rowIndex) : null);
        showStatus(tagId ? 'Etykieta zaktualizowana' : 'Etykieta dodana', 'success');
        
        // Reload
        await loadTagsData();
        renderCompanyTagsList();
        renderCompanies();
        renderTagFilterDropdowns();
        
        // Reset form
        resetCompanyTagForm();
    } catch (error) {
        console.error('Error saving company tag:', error);
        showStatus('Błąd przy zapisie etykiety', 'error');
    }
}

function resetCompanyTagForm() {
    document.getElementById('companyTagForm').reset();
    document.getElementById('companyTagId').value = '';
    document.getElementById('companyTagRowIndex').value = '';
    document.getElementById('companyTagSubmitText').textContent = 'Dodaj etykietę';
    selectColor('company', '#3b82f6');
}

function editCompanyTag(tag, rowIndex) {
    document.getElementById('companyTagId').value = tag.id;
    document.getElementById('companyTagRowIndex').value = rowIndex;
    document.getElementById('companyTagName').value = tag.name;
    document.getElementById('companyTagDescription').value = tag.description || '';
    document.getElementById('companyTagSubmitText').textContent = 'Zapisz zmiany';
    selectColor('company', tag.color);
    
    // Scroll to form
    document.querySelector('#companiesTagsSection .tag-form-section').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

async function deleteCompanyTag(tagId, rowIndex) {
    if (!confirm('Czy na pewno chcesz usunąć tę etykietę? Zostanie ona usunięta ze wszystkich firm.')) {
        return;
    }
    
    try {
        await DataService.deleteCompanyTag(rowIndex);
        showStatus('Etykieta usunięta', 'success');
        
        // Clear filter if deleted tag was active
        if (currentTagFilter && currentTagFilter.id === tagId) {
            clearTagFilter();
        }
        
        // Reload
        await loadTagsData();
        renderCompanyTagsList();
        renderCompanies();
        renderTagFilterDropdowns();
    } catch (error) {
        console.error('Error deleting company tag:', error);
        showStatus('Błąd przy usuwaniu etykiety', 'error');
    }
}

function renderCompanyTagsList() {
    const container = document.getElementById('companyTagsList');
    
    if (!companyTags || companyTags.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <p>Brak etykiet dla firm. Dodaj pierwszą etykietę używając formularza powyżej.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = companyTags.map((tag, index) => `
        <div class="tag-list-item">
            <div class="tag-list-item-left">
                <div class="tag-list-item-color" style="background-color: ${tag.color}"></div>
                <div class="tag-list-item-info">
                    <div class="tag-list-item-name">${escapeHtml(tag.name)}</div>
                    ${tag.description ? `<div class="tag-list-item-desc">${escapeHtml(tag.description)}</div>` : ''}
                </div>
            </div>
            <div class="tag-list-item-actions">
                <button class="tag-action-btn" onclick='editCompanyTag(${JSON.stringify(tag)}, ${index})' title="Edytuj">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="tag-action-btn" onclick="deleteCompanyTag('${tag.id}', ${index})" title="Usuń">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

// ========== CONTACT TAGS ==========

async function saveContactTag(event) {
    event.preventDefault();
    
    const tagId = document.getElementById('contactTagId').value;
    const rowIndex = document.getElementById('contactTagRowIndex').value;
    
    const tag = {
        id: tagId || DataService.generateId(),
        name: document.getElementById('contactTagName').value.trim(),
        color: document.getElementById('contactTagColor').value,
        description: document.getElementById('contactTagDescription').value.trim()
    };
    
    try {
        await DataService.saveContactTag(tag, rowIndex ? parseInt(rowIndex) : null);
        showStatus(tagId ? 'Etykieta zaktualizowana' : 'Etykieta dodana', 'success');
        
        // Reload
        await loadTagsData();
        renderContactTagsList();
        renderAllContacts();
        renderTagFilterDropdowns();
        
        // Reset form
        resetContactTagForm();
    } catch (error) {
        console.error('Error saving contact tag:', error);
        showStatus('Błąd przy zapisie etykiety', 'error');
    }
}

function resetContactTagForm() {
    document.getElementById('contactTagForm').reset();
    document.getElementById('contactTagId').value = '';
    document.getElementById('contactTagRowIndex').value = '';
    document.getElementById('contactTagSubmitText').textContent = 'Dodaj etykietę';
    selectColor('contact', '#3b82f6');
}

function editContactTag(tag, rowIndex) {
    document.getElementById('contactTagId').value = tag.id;
    document.getElementById('contactTagRowIndex').value = rowIndex;
    document.getElementById('contactTagName').value = tag.name;
    document.getElementById('contactTagDescription').value = tag.description || '';
    document.getElementById('contactTagSubmitText').textContent = 'Zapisz zmiany';
    selectColor('contact', tag.color);
    
    // Scroll to form
    document.querySelector('#contactsTagsSection .tag-form-section').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

async function deleteContactTag(tagId, rowIndex) {
    if (!confirm('Czy na pewno chcesz usunąć tę etykietę? Zostanie ona usunięta ze wszystkich kontaktów.')) {
        return;
    }
    
    try {
        await DataService.deleteContactTag(rowIndex);
        showStatus('Etykieta usunięta', 'success');
        
        // Clear filter if deleted tag was active
        if (currentTagFilter && currentTagFilter.id === tagId) {
            clearTagFilter();
        }
        
        // Reload
        await loadTagsData();
        renderContactTagsList();
        renderAllContacts();
        renderTagFilterDropdowns();
    } catch (error) {
        console.error('Error deleting contact tag:', error);
        showStatus('Błąd przy usuwaniu etykiety', 'error');
    }
}

function renderContactTagsList() {
    const container = document.getElementById('contactTagsList');
    
    if (!contactTags || contactTags.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <p>Brak etykiet dla osób. Dodaj pierwszą etykietę używając formularza powyżej.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = contactTags.map((tag, index) => `
        <div class="tag-list-item">
            <div class="tag-list-item-left">
                <div class="tag-list-item-color" style="background-color: ${tag.color}"></div>
                <div class="tag-list-item-info">
                    <div class="tag-list-item-name">${escapeHtml(tag.name)}</div>
                    ${tag.description ? `<div class="tag-list-item-desc">${escapeHtml(tag.description)}</div>` : ''}
                </div>
            </div>
            <div class="tag-list-item-actions">
                <button class="tag-action-btn" onclick='editContactTag(${JSON.stringify(tag)}, ${index})' title="Edytuj">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="tag-action-btn" onclick="deleteContactTag('${tag.id}', ${index})" title="Usuń">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

// ========== TAG FILTERING ==========

function filterByTag(tagId, tagName, tagColor, type) {
    currentTagFilter = { id: tagId, name: tagName, color: tagColor, type: type };
    
    if (type === 'company') {
        renderCompanies();
    } else {
        renderAllContacts();
    }
}

function clearTagFilter() {
    currentTagFilter = null;
    
    // Hide filter chips
    const contactsFilter = document.getElementById('contactsActiveFilter');
    const companiesFilter = document.getElementById('companiesActiveFilter');
    if (contactsFilter) contactsFilter.style.display = 'none';
    if (companiesFilter) companiesFilter.style.display = 'none';
    
    // Show filter buttons again
    const contactsBtn = document.getElementById('contactsTagFilterBtn');
    const companiesBtn = document.getElementById('companiesTagFilterBtn');
    if (contactsBtn) contactsBtn.style.display = '';
    if (companiesBtn) companiesBtn.style.display = '';
    
    // Update dropdown selection state
    document.querySelectorAll('.tag-filter-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    renderCompanies();
    renderAllContacts();
}

// ========== TAG FILTER UI ==========

function renderTagFilterDropdowns() {
    renderTagFilterDropdown('contacts');
    renderTagFilterDropdown('companies');
}

function renderTagFilterDropdown(type) {
    const dropdownId = type === 'contacts' ? 'contactsTagFilterDropdown' : 'companiesTagFilterDropdown';
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    const tags = type === 'contacts' ? contactTags : companyTags;
    const relations = type === 'contacts' ? contactTagRelations : companyTagRelations;
    const tagType = type === 'contacts' ? 'contact' : 'company';
    
    if (!tags || tags.length === 0) {
        dropdown.innerHTML = `
            <div class="tag-filter-empty">
                <div class="tag-filter-empty-icon">🏷️</div>
                <span>Brak etykiet</span>
                <small>Utwórz etykiety w ustawieniach</small>
            </div>
        `;
        return;
    }
    
    // Calculate tag usage counts
    const tagCounts = {};
    tags.forEach(tag => {
        tagCounts[tag.id] = relations.filter(r => r.tagId === tag.id).length;
    });
    
    // Sort by usage (most used first)
    const sortedTags = [...tags].sort((a, b) => tagCounts[b.id] - tagCounts[a.id]);
    
    dropdown.innerHTML = `
        <div class="tag-filter-dropdown-header">
            <h4>Filtruj po etykiecie</h4>
        </div>
        ${sortedTags.map(tag => `
            <div class="tag-filter-item ${currentTagFilter && currentTagFilter.id === tag.id ? 'selected' : ''}" 
                 onclick="selectTagFilter('${tag.id}', '${escapeHtml(tag.name)}', '${tag.color}', '${tagType}')">
                <span class="tag-filter-item-color" style="background-color: ${tag.color}"></span>
                <span class="tag-filter-item-name">${escapeHtml(tag.name)}</span>
                <span class="tag-filter-item-count">${tagCounts[tag.id]}</span>
            </div>
        `).join('')}
    `;
}

function toggleTagFilterDropdown(type) {
    const dropdownId = type === 'contacts' ? 'contactsTagFilterDropdown' : 'companiesTagFilterDropdown';
    const btnId = type === 'contacts' ? 'contactsTagFilterBtn' : 'companiesTagFilterBtn';
    const dropdown = document.getElementById(dropdownId);
    const btn = document.getElementById(btnId);
    
    if (!dropdown || !btn) return;
    
    // Close other dropdowns first
    document.querySelectorAll('.tag-filter-dropdown.visible').forEach(d => {
        if (d.id !== dropdownId) {
            d.classList.remove('visible');
        }
    });
    document.querySelectorAll('.tag-filter-btn.active').forEach(b => {
        if (b.id !== btnId) {
            b.classList.remove('active');
        }
    });
    
    const isVisible = dropdown.classList.contains('visible');
    
    if (isVisible) {
        dropdown.classList.remove('visible');
        btn.classList.remove('active');
    } else {
        dropdown.classList.add('visible');
        btn.classList.add('active');
        
        // Close on click outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                    dropdown.classList.remove('visible');
                    btn.classList.remove('active');
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 10);
    }
}

function selectTagFilter(tagId, tagName, tagColor, tagType) {
    currentTagFilter = { id: tagId, name: tagName, color: tagColor, type: tagType };
    
    // Close dropdown
    document.querySelectorAll('.tag-filter-dropdown.visible').forEach(d => d.classList.remove('visible'));
    document.querySelectorAll('.tag-filter-btn.active').forEach(b => b.classList.remove('active'));
    
    // Update dropdown selection state
    document.querySelectorAll('.tag-filter-item.selected').forEach(item => item.classList.remove('selected'));
    
    // Update active filter UI
    updateActiveFilterUI();
    
    // Re-render the appropriate list
    if (tagType === 'company') {
        renderCompanies();
    } else {
        renderAllContacts();
    }
    
    // Update dropdown to show selection
    renderTagFilterDropdowns();
}

function updateActiveFilterUI() {
    const contactsFilter = document.getElementById('contactsActiveFilter');
    const companiesFilter = document.getElementById('companiesActiveFilter');
    const contactsBtn = document.getElementById('contactsTagFilterBtn');
    const companiesBtn = document.getElementById('companiesTagFilterBtn');
    
    // Reset both
    if (contactsFilter) contactsFilter.style.display = 'none';
    if (companiesFilter) companiesFilter.style.display = 'none';
    if (contactsBtn) contactsBtn.style.display = '';
    if (companiesBtn) companiesBtn.style.display = '';
    
    if (!currentTagFilter) return;
    
    // Show appropriate filter chip
    if (currentTagFilter.type === 'contact') {
        if (contactsFilter) {
            contactsFilter.style.display = 'flex';
            contactsFilter.innerHTML = `
                <span class="filter-color" style="background-color: ${currentTagFilter.color}"></span>
                <span class="filter-name">${escapeHtml(currentTagFilter.name)}</span>
                <button class="filter-clear" onclick="clearTagFilter()" title="Usuń filtr">×</button>
            `;
        }
        if (contactsBtn) contactsBtn.style.display = 'none';
    } else {
        if (companiesFilter) {
            companiesFilter.style.display = 'flex';
            companiesFilter.innerHTML = `
                <span class="filter-color" style="background-color: ${currentTagFilter.color}"></span>
                <span class="filter-name">${escapeHtml(currentTagFilter.name)}</span>
                <button class="filter-clear" onclick="clearTagFilter()" title="Usuń filtr">×</button>
            `;
        }
        if (companiesBtn) companiesBtn.style.display = 'none';
    }
}

// ========== RENDER TAGS IN VIEWS ==========

function renderEntityTags(entityId, type) {
    const tags = type === 'company' 
        ? DataService.getCompanyTags(entityId, companyTags, companyTagRelations)
        : DataService.getContactTags(entityId, contactTags, contactTagRelations);
    
    if (!tags || tags.length === 0) return '';
    
    // Render minimal color bars for cards
    return `
        <div class="tags-container">
            ${tags.map(tag => `
                <div class="tag-badge" 
                     style="background-color: ${tag.color}"
                     data-tag-name="${escapeHtml(tag.name)}"
                     title="${escapeHtml(tag.description || tag.name)}">
                </div>
            `).join('')}
        </div>
    `;
}

// ========== ASSIGN/REMOVE TAGS ==========

async function assignTagToEntity(entityId, tagId, type) {
    try {
        if (type === 'company') {
            await DataService.assignTagToCompany(entityId, tagId);
        } else {
            await DataService.assignTagToContact(entityId, tagId);
        }
        
        showStatus('Etykieta przypisana', 'success');
        
        // Reload
        await loadTagsData();
        
        // Refresh current view
        if (type === 'company' && currentCompanyId === entityId) {
            viewCompanyDetail(entityId);
        } else if (type === 'contact' && currentContactId === entityId) {
            viewContactDetail(entityId);
        }
    } catch (error) {
        console.error('Błąd przypisywania etykiety:', error);
        showStatus('Błąd przypisywania etykiety', 'error');
    }
}

/**
 * Render tags in detail view (inline with other info)
 */
function renderDetailTags(entityId, type) {
    const allTags = type === 'company' ? companyTags : contactTags;
    const allRelations = type === 'company' ? companyTagRelations : contactTagRelations;
    
    const entityTags = type === 'company' 
        ? DataService.getCompanyTags(entityId, allTags, allRelations)
        : DataService.getContactTags(entityId, allTags, allRelations);
    
    const availableTags = allTags.filter(tag => 
        !entityTags.find(et => et.id === tag.id)
    );
    
    const dropdownId = type === 'company' ? 'companyTagDropdown' : 'contactTagDropdown';
    const addBtnId = type === 'company' ? 'addCompanyTagBtn' : 'addContactTagBtn';
    
    return `
        <div class="detail-info-row">
            <div class="detail-info-label">Etykiety</div>
            <div class="detail-info-value" style="position: relative;">
                <div class="detail-tags-inline">
                    ${entityTags.length > 0 ? entityTags.map(tag => `
                        <div class="detail-tag-item" style="background-color: ${tag.color}">
                            ${escapeHtml(tag.name)}
                            <button 
                                class="remove-tag-btn" 
                                onclick="event.stopPropagation(); removeTagFromDetail('${entityId}', '${tag.id}', '${type}')"
                                title="Usuń">×</button>
                        </div>
                    `).join('') : '<span style="color: var(--text-secondary); font-style: italic; font-size: 0.85rem;">Brak etykiet</span>'}
                    
                    <button class="add-tag-btn" id="${addBtnId}" title="Dodaj etykietę">+</button>
                </div>
                
                <!-- Dropdown for adding tags -->
                <div class="tag-dropdown" id="${dropdownId}">
                    ${availableTags.length > 0 ? availableTags.map(tag => `
                        <div class="tag-dropdown-item" onclick="quickAssignTag('${entityId}', '${tag.id}', '${type}')">
                            <div class="tag-dropdown-color" style="background-color: ${tag.color}"></div>
                            <span>${escapeHtml(tag.name)}</span>
                        </div>
                    `).join('') : '<div class="tag-dropdown-empty">Wszystkie etykiety przypisane</div>'}
                </div>
            </div>
        </div>
    `;
}

/**
 * Quick assign tag from dropdown
 */
async function quickAssignTag(entityId, tagId, type) {
    try {
        // Find tag name for logging
        const allTags = type === 'company' ? companyTags : contactTags;
        const tag = allTags.find(t => t.id === tagId);
        const tagName = tag ? tag.name : 'etykieta';
        
        await assignTagToEntity(entityId, tagId, type);
        
        // Log to history
        if (type === 'company') {
            await DataService.logCompanyHistory(entityId, 'event', `Dodano etykietę: ${tagName}`);
        } else {
            await DataService.logContactHistory(entityId, 'event', `Dodano etykietę: ${tagName}`);
        }
        
        // Reload tags and history
        await loadTagsData();
        if (type === 'company') {
            await loadCompanyHistory();
            viewCompanyDetail(entityId);
            renderCompanyHistory(entityId);
        } else {
            await loadContactHistory();
            viewContactDetail(entityId);
            renderContactHistory(entityId);
        }
        
        showStatus('Etykieta przypisana', 'success');
    } catch (error) {
        console.error('Błąd przypisywania etykiety:', error);
        showStatus('Błąd przypisywania etykiety', 'error');
    }
}

/**
 * Toggle tag dropdown visibility
 */
function toggleTagDropdown(dropdownId, buttonId) {
    const dropdown = document.getElementById(dropdownId);
    const button = document.getElementById(buttonId);
    
    if (!dropdown || !button) return;
    
    const isVisible = dropdown.classList.contains('visible');
    
    // Close all other dropdowns
    document.querySelectorAll('.tag-dropdown').forEach(dd => {
        dd.classList.remove('visible');
    });
    
    // Toggle this dropdown
    if (!isVisible) {
        dropdown.classList.add('visible');
        
        // Close on click outside
        setTimeout(() => {
            const closeOnClickOutside = (e) => {
                if (!dropdown.contains(e.target) && !button.contains(e.target)) {
                    dropdown.classList.remove('visible');
                    document.removeEventListener('click', closeOnClickOutside);
                }
            };
            document.addEventListener('click', closeOnClickOutside);
        }, 10);
    }
}

/**
 * Remove tag from entity in detail view
 */
async function removeTagFromDetail(entityId, tagId, type) {
    if (!confirm('Czy na pewno chcesz usunąć tę etykietę?')) {
        return;
    }
    
    try {
        // Find tag name for logging
        const allTags = type === 'company' ? companyTags : contactTags;
        const tag = allTags.find(t => t.id === tagId);
        const tagName = tag ? tag.name : 'etykieta';
        
        // Remove tag
        await removeTagFromEntity(entityId, tagId, type);
        
        // Log to history
        if (type === 'company') {
            await DataService.logCompanyHistory(entityId, 'event', `Usunięto etykietę: ${tagName}`);
        } else {
            await DataService.logContactHistory(entityId, 'event', `Usunięto etykietę: ${tagName}`);
        }
        
        // Reload tags
        await loadTagsData();
        
        // Reload history
        if (type === 'company') {
            await loadCompanyHistory();
            viewCompanyDetail(entityId);
            renderCompanyHistory(entityId);
        } else {
            await loadContactHistory();
            viewContactDetail(entityId);
            renderContactHistory(entityId);
        }
        
        showStatus('Etykieta usunięta', 'success');
    } catch (error) {
        console.error('Błąd usuwania etykiety:', error);
        showStatus('Błąd usuwania etykiety', 'error');
    }
}

async function removeTagFromEntity(entityId, tagId, type) {
    try {
        // Reload relations from sheet to get accurate row indices
        let allRelationsFromSheet;
        if (type === 'company') {
            allRelationsFromSheet = await DataService.loadCompanyTagRelations(null, false);
        } else {
            allRelationsFromSheet = await DataService.loadContactTagRelations(null, false);
        }
        
        // Find relation in fresh data
        const relation = allRelationsFromSheet.find(r => 
            (type === 'company' ? r.companyId : r.contactId) === entityId && r.tagId === tagId
        );
        
        if (!relation) {
            showStatus('Nie znaleziono relacji', 'error');
            return;
        }
        
        // Row index is position in array (0-based)
        // DataService will add +2 for header row
        const rowIndex = allRelationsFromSheet.indexOf(relation);
        
        if (type === 'company') {
            await DataService.removeTagFromCompany(relation.id, rowIndex);
        } else {
            await DataService.removeTagFromContact(relation.id, rowIndex);
        }
        
        // Reload local cache
        await loadTagsData();
        
        console.log('✓ Tag removed successfully');
    } catch (error) {
        console.error('Error removing tag:', error);
        throw error; // Re-throw to be caught by caller
    }
}

// ========== LOAD TAGS DATA ==========

async function loadTagsData() {
    try {
        [companyTags, contactTags, companyTagRelations, contactTagRelations] = await Promise.all([
            DataService.loadCompanyTags(),
            DataService.loadContactTags(),
            DataService.loadCompanyTagRelations(),
            DataService.loadContactTagRelations()
        ]);
        console.log('✓ Etykiety załadowane:', {
            companyTags: companyTags.length,
            contactTags: contactTags.length,
            companyRelations: companyTagRelations.length,
            contactRelations: contactTagRelations.length
        });
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}


        

        
        
        // ============= SELECTION FUNCTIONS - CONTACTS =============

function toggleContactSelection(contactId, event) {
    if (event) event.stopPropagation();
    
    const index = selectedContactIds.indexOf(contactId);
    if (index > -1) {
        selectedContactIds.splice(index, 1);
    } else {
        selectedContactIds.push(contactId);
    }
    
    updateContactSelectionUI();
    renderAllContacts(); // Re-render to update visual state
}

            // Toggle visual state on card (grid view)
            if (event && event.target) {
                const card = event.target.closest('.card');
                if (card) card.classList.toggle('selected', selectedContactIds.includes(contactId));
            }
        }

        function selectAllContacts() {
            const filtered = getFilteredContacts();
            selectedContactIds = filtered.map(c => c.id);
            updateContactSelectionUI();
            renderAllContacts(); // Re-render with checkboxes checked
        }

        function deselectAllContacts() {
            selectedContactIds = [];
            updateContactSelectionUI();
            renderAllContacts(); // Re-render with checkboxes unchecked
        }

        function updateContactSelectionUI() {
            const count = selectedContactIds.length;
            const counter = document.getElementById('contactsSelectionCount');
            const controls = document.getElementById('contactsSelectionControls');
            const exportBtn = document.getElementById('exportSelectedContactsBtn');
            const exportBtnText = exportBtn ? exportBtn.querySelector('span') : null;

            // Update counter
            if (counter) counter.textContent = `Zaznaczono: ${count}`;

            // Show/hide controls
            if (controls) {
                controls.style.display = count > 0 ? 'flex' : 'none';
            }

            // Update export button
            if (exportBtn) {
                exportBtn.disabled = count === 0;
            }
            if (exportBtnText) {
                exportBtnText.textContent = `Eksportuj (${count})`;
            }
        }

        // ============= SELECTION FUNCTIONS - COMPANIES =============

function toggleCompanySelection(companyId, event) {
    if (event) event.stopPropagation();
    
    const index = selectedCompanyIds.indexOf(companyId);
    if (index > -1) {
        selectedCompanyIds.splice(index, 1);
    } else {
        selectedCompanyIds.push(companyId);
    }
    
    updateCompanySelectionUI();
    renderCompanies(); // Re-render to update visual state
}

            // Toggle visual state on card (grid view)
            if (event && event.target) {
                const card = event.target.closest('.card');
                if (card) card.classList.toggle('selected', selectedCompanyIds.includes(companyId));
            }
        }

        function selectAllCompanies() {
            const filtered = getFilteredCompanies();
            selectedCompanyIds = filtered.map(c => c.id);
            updateCompanySelectionUI();
            renderCompanies(); // Re-render with checkboxes checked
        }

        function deselectAllCompanies() {
            selectedCompanyIds = [];
            updateCompanySelectionUI();
            renderCompanies(); // Re-render with checkboxes unchecked
        }

        function updateCompanySelectionUI() {
            const count = selectedCompanyIds.length;
            const counter = document.getElementById('companiesSelectionCount');
            const controls = document.getElementById('companiesSelectionControls');
            const exportBtn = document.getElementById('exportSelectedCompaniesBtn');
            const exportBtnText = exportBtn ? exportBtn.querySelector('span') : null;

            // Update counter
            if (counter) counter.textContent = `Zaznaczono: ${count}`;

            // Show/hide controls
            if (controls) {
                controls.style.display = count > 0 ? 'flex' : 'none';
            }

            // Update export button
            if (exportBtn) {
                exportBtn.disabled = count === 0;
            }
            if (exportBtnText) {
                exportBtnText.textContent = `Eksportuj (${count})`;
            }
        }

        // ============= EXPORT FUNCTIONS - CONTACTS =============

        function exportSelectedContacts() {
    if (selectedContactIds.length === 0) {
        showStatus('Zaznacz przynajmniej jeden kontakt', 'error');
        return;
    }
    
    const selectedContacts = contacts.filter(c => selectedContactIds.includes(c.id));
    generateContactsCSV(selectedContacts, `kontakty_zaznaczone_${getCurrentDateString()}.csv`);
    showStatus(`Wyeksportowano ${selectedContacts.length} kontaktów`, 'success');
    
    // Zamknij dropdown
    document.getElementById('contactsExportDropdown').classList.remove('visible');
}

function exportAllContacts() {
    if (contacts.length === 0) {
        showStatus('Brak kontaktów do eksportu', 'error');
        return;
    }
    
    generateContactsCSV(contacts, `kontakty_wszystkie_${getCurrentDateString()}.csv`);
    showStatus(`Wyeksportowano ${contacts.length} kontaktów`, 'success');
    
    // Zamknij dropdown
    document.getElementById('contactsExportDropdown').classList.remove('visible');
}

function exportSelectedCompanies() {
    if (selectedCompanyIds.length === 0) {
        showStatus('Zaznacz przynajmniej jedną firmę', 'error');
        return;
    }
    
    const selectedCompanies = companies.filter(c => selectedCompanyIds.includes(c.id));
    generateCompaniesCSV(selectedCompanies, `firmy_zaznaczone_${getCurrentDateString()}.csv`);
    showStatus(`Wyeksportowano ${selectedCompanies.length} firm`, 'success');
    
    // Zamknij dropdown
    document.getElementById('companiesExportDropdown').classList.remove('visible');
}

function exportAllCompanies() {
    if (companies.length === 0) {
        showStatus('Brak firm do eksportu', 'error');
        return;
    }
    
    generateCompaniesCSV(companies, `firmy_wszystkie_${getCurrentDateString()}.csv`);
    showStatus(`Wyeksportowano ${companies.length} firm`, 'success');
    
    // Zamknij dropdown
    document.getElementById('companiesExportDropdown').classList.remove('visible');
}

        function exportAllContacts() {
            if (contacts.length === 0) {
                showStatus('Brak kontaktów do eksportu', 'error');
                return;
            }

            generateContactsCSV(contacts, `kontakty_wszystkie_${getCurrentDateString()}.csv`);
            showStatus(`Wyeksportowano ${contacts.length} kontaktów`, 'success');
        }

        function generateContactsCSV(contactsList, filename) {
            // CSV Header (stałe kolumny)
            let csv = 'Imię i nazwisko,Firma,Stanowisko,E-mail,Numer telefonu\n';

            // CSV Rows
            contactsList.forEach(contact => {
                const company = companies.find(c => c.id === contact.companyId);
                const companyName = company ? company.name : '';

                // Escape values for CSV (handle commas, quotes)
                const escapeCsv = (value) => {
                    if (!value) return '';
                    const str = String(value);
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                };

                csv += `${escapeCsv(contact.name)},`;
                csv += `${escapeCsv(companyName)},`;
                csv += `${escapeCsv(contact.position)},`;
                csv += `${escapeCsv(contact.email)},`;
                csv += `${escapeCsv(contact.phone)}\n`;
            });

            downloadCSV(csv, filename);
        }

        // ============= EXPORT FUNCTIONS - COMPANIES =============

        function exportSelectedCompanies() {
            if (selectedCompanyIds.length === 0) {
                showStatus('Zaznacz przynajmniej jedną firmę', 'error');
                return;
            }

            const selectedCompanies = companies.filter(c => selectedCompanyIds.includes(c.id));
            generateCompaniesCSV(selectedCompanies, `firmy_zaznaczone_${getCurrentDateString()}.csv`);
            showStatus(`Wyeksportowano ${selectedCompanies.length} firm`, 'success');
        }

        function exportAllCompanies() {
            if (companies.length === 0) {
                showStatus('Brak firm do eksportu', 'error');
                return;
            }

            generateCompaniesCSV(companies, `firmy_wszystkie_${getCurrentDateString()}.csv`);
            showStatus(`Wyeksportowano ${companies.length} firm`, 'success');
        }

        function generateCompaniesCSV(companiesList, filename) {
            // CSV Header (stałe kolumny)
            let csv = 'Nazwa firmy,Branża,Telefon firmowy,Domena\n';

            // CSV Rows
            companiesList.forEach(company => {
                // Escape values for CSV
                const escapeCsv = (value) => {
                    if (!value) return '';
                    const str = String(value);
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                };

                csv += `${escapeCsv(company.name)},`;
                csv += `${escapeCsv(company.industry)},`;
                csv += `${escapeCsv(company.phone)},`;
                csv += `${escapeCsv(company.domain)}\n`;
            });

            downloadCSV(csv, filename);
        }

        // ============= CSV DOWNLOAD HELPER =============

        function downloadCSV(csvContent, filename) {
            // Add BOM for proper UTF-8 encoding in Excel
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');

            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        }

        function getCurrentDateString() {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

// ============= MAKE FUNCTIONS GLOBAL =============
        // Make all functions available for onclick handlers
        
        // Basic functions
        window.viewCompanyDetail = viewCompanyDetail;
        window.viewContactDetail = viewContactDetail;
        window.editCompany = editCompany;
        window.editContact = editContact;
        window.deleteCompany = deleteCompany;
        window.deleteContact = deleteContact;
        window.editCompanyFromDetail = editCompanyFromDetail;
        window.editContactFromDetail = editContactFromDetail;
        window.closeDuplicateModal = () => document.getElementById('duplicateModal').classList.remove('active');
        
        // ============= EXPOSE FUNCTIONS TO WINDOW =============
        // To jest konieczne, aby przyciski w HTML (onclick=...) widziały te funkcje
        
        // Tags functions
        window.openTagsManager = openTagsManager;
        window.closeTagsManager = closeTagsManager;
        window.switchTagsTab = switchTagsTab;
        window.selectColor = selectColor;
        window.saveCompanyTag = saveCompanyTag;
        window.editCompanyTag = editCompanyTag;
        window.deleteCompanyTag = deleteCompanyTag;
        window.saveContactTag = saveContactTag;
        window.editContactTag = editContactTag;
        window.deleteContactTag = deleteContactTag;
        window.filterByTag = filterByTag;
        window.clearTagFilter = clearTagFilter;
        window.toggleTagFilterDropdown = toggleTagFilterDropdown;
        window.selectTagFilter = selectTagFilter;
        window.renderDetailTags = renderDetailTags;
        window.quickAssignTag = quickAssignTag;
        window.toggleTagDropdown = toggleTagDropdown;
        window.removeTagFromDetail = removeTagFromDetail;
        window.openActivityModal = openActivityModal;
        window.completeActivity = completeActivity;
        window.deleteActivity = deleteActivity;

        // Export & selection functions
        window.toggleContactSelection = toggleContactSelection;
        window.selectAllContacts = selectAllContacts;
        window.deselectAllContacts = deselectAllContacts;
        window.updateContactSelectionUI = updateContactSelectionUI;
        window.handleSelectAllContacts = handleSelectAllContacts;

        window.toggleCompanySelection = toggleCompanySelection;
        window.selectAllCompanies = selectAllCompanies;
        window.deselectAllCompanies = deselectAllCompanies;
        window.updateCompanySelectionUI = updateCompanySelectionUI;
        window.handleSelectAllCompanies = handleSelectAllCompanies;

        window.exportSelectedContacts = exportSelectedContacts;
        window.exportAllContacts = exportAllContacts;
        window.exportSelectedCompanies = exportSelectedCompanies;
        window.exportAllCompanies = exportAllCompanies;



        // ============= EVENT LISTENERS =============
        document.addEventListener('DOMContentLoaded', () => {

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.tab === 'contacts') backToContactsList();
            else if (btn.dataset.tab === 'companies') backToCompaniesList();
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
        });
    });

    // Search
    const globalSearchInput = document.getElementById('globalSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value || '';
            renderAllContacts();
            renderCompanies();
            if (currentCompanyId) renderCompanyContacts(currentCompanyId);
        });
    }
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            currentSearchTerm = '';
            if (globalSearchInput) globalSearchInput.value = '';
            renderAllContacts();
            renderCompanies();
        });
    }

    // Companies
    document.getElementById('addCompanyBtn').addEventListener('click', openCompanyModal);
    document.getElementById('closeCompanyModalBtn').addEventListener('click', closeCompanyModal);
    document.getElementById('cancelCompanyBtn').addEventListener('click', closeCompanyModal);
    document.getElementById('companyForm').addEventListener('submit', saveCompany);
    document.getElementById('backToCompaniesBtn').addEventListener('click', backToCompaniesList);

    // Contacts
    document.getElementById('addContactBtn').addEventListener('click', () => openContactModal());
    document.getElementById('addCompanyContactBtn').addEventListener('click', () => openContactModal(currentCompanyId));
    document.getElementById('closeContactModalBtn').addEventListener('click', closeContactModal);
    document.getElementById('cancelContactBtn').addEventListener('click', closeContactModal);
    document.getElementById('contactForm').addEventListener('submit', saveContact);
    document.getElementById('backToContactsBtn').addEventListener('click', backToContactsList);

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
                const company = companies.find(c => c.id === item.dataset.id);
                if (company) {
                    companyInputEl.value = company.name;
                    companyIdEl.value = company.id;
                }
            }
            hideCompanySuggestions();
        });
    }

    // Auto-match company by email domain
    const contactEmailEl = document.getElementById('contactEmail');
    if (contactEmailEl && companyInputEl && companyIdEl) {
        contactEmailEl.addEventListener('blur', () => {
            const email = contactEmailEl.value.trim();
            if (!email || !email.includes('@')) return;
            if (companyInputEl.value.trim() || companyIdEl.value) return;
            const domain = DataService.extractDomain(email);
            const matchedCompany = DataService.findCompanyByDomain(companies, domain);
            if (matchedCompany) {
                companyInputEl.value = matchedCompany.name;
                companyIdEl.value = matchedCompany.id;
                showStatus(`🎯 Auto-dopasowano firmę: ${matchedCompany.name}`, 'success');
            }
        });
    }

    // Note modal
    noteEntityTypeEl = document.getElementById('noteEntityType');
    noteEntityIdEl = document.getElementById('noteEntityId');
    noteContentEl = document.getElementById('noteContent');

    document.getElementById('closeNoteModalBtn').addEventListener('click', closeNoteModal);
    document.getElementById('cancelNoteBtn').addEventListener('click', closeNoteModal);
    document.getElementById('noteForm').addEventListener('submit', saveNote);

    // Note buttons - używamy event delegation
    document.addEventListener('click', (e) => {
        // Company note button
        if (e.target.closest('#addCompanyNoteBtn')) {
            e.preventDefault();
            e.stopPropagation();
            openNoteModal('company', currentCompanyId);
        }
        // Contact note button
        if (e.target.closest('#addContactNoteBtn')) {
            e.preventDefault();
            e.stopPropagation();
            openNoteModal('contact', currentContactId);
        }
    });

    // History tabs
    document.querySelectorAll('.history-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const entity = btn.dataset.entity;
            const scope = btn.dataset.scope;
            document.querySelectorAll(`.history-tab-btn[data-entity="${entity}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (entity === 'company') {
                currentCompanyHistoryScope = scope;
                if (currentCompanyId) {
                    if (scope === 'activities') {
                        renderCompanyActivities(currentCompanyId);
                    } else {
                        renderCompanyHistory(currentCompanyId);
                    }
                }
            } else if (entity === 'contact') {
                currentContactHistoryScope = scope;
                if (currentContactId) {
                    if (scope === 'activities') {
                        renderContactActivities(currentContactId);
                    } else {
                        renderContactHistory(currentContactId);
                    }
                }
            }
        });
    });

    // Activity modal
    document.getElementById('closeActivityModalBtn').addEventListener('click', closeActivityModal);
    document.getElementById('cancelActivityBtn').addEventListener('click', closeActivityModal);
    document.getElementById('activityForm').addEventListener('submit', saveActivity);
    
    // Activity buttons - używamy event delegation
    document.addEventListener('click', (e) => {
        // Company activity button
        if (e.target.closest('#addCompanyActivityBtn')) {
            e.preventDefault();
            e.stopPropagation();
            openActivityModal('company', currentCompanyId);
        }
        // Contact activity button
        if (e.target.closest('#addContactActivityBtn')) {
            e.preventDefault();
            e.stopPropagation();
            openActivityModal('contact', currentContactId);
        }
    });

    // Activity type selector
    document.querySelectorAll('.activity-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.activity-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentActivityType = btn.dataset.type;
            document.getElementById('activityType').value = btn.dataset.type;
        });
    });


    // AI buttons - event delegation
    document.addEventListener('click', (e) => {
        // Company AI buttons
        if (e.target.closest('#aiSummarizeCompanyBtn')) {
            e.preventDefault();
            e.stopPropagation();
            summarizeCompany();
        }
        if (e.target.closest('#aiSuggestStepsBtn')) {
            e.preventDefault();
            e.stopPropagation();
            suggestNextSteps();
        }
        
        // Contact AI buttons (NOWE)
        if (e.target.closest('#aiSummarizeContactBtn')) {
            e.preventDefault();
            e.stopPropagation();
            summarizeContact();
        }
        if (e.target.closest('#aiSuggestContactStepsBtn')) {
            e.preventDefault();
            e.stopPropagation();
            suggestContactNextSteps();
        }
        
        // AI Settings & Modal buttons
        if (e.target.closest('#aiSettingsBtn')) {
            e.preventDefault();
            e.stopPropagation();
            showAiSettings();
        }
        if (e.target.closest('#closeAiModalBtn')) {
            e.preventDefault();
            e.stopPropagation();
            closeAiModal();
        }
        if (e.target.closest('#regenerateAiBtn')) {
            e.preventDefault();
            e.stopPropagation();
            regenerateLastAiRequest();
        }
        if (e.target.closest('#saveAiNoteBtn')) {
            e.preventDefault();
            e.stopPropagation();
            saveAiResponseAsNote();
        }
    });
    // Close modals on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // Hide company suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (companyInputEl && companyInputEl.closest('.company-picker') && companySuggestionsEl) {
            if (!companyInputEl.closest('.company-picker').contains(e.target)) {
                hideCompanySuggestions();
            }
        }
    });
});



// ============= AI FUNCTIONS =============

async function summarizeCompany() {
    if (!currentCompanyId) return;
    if (!AIService.enabled) {
        showAiSettings();
        return;
    }

    const company = companies.find(c => c.id === currentCompanyId);
    const history = companyHistory.filter(h => h.companyId === currentCompanyId);
    const companyContacts = contacts.filter(c => c.companyId === currentCompanyId);
    const activities = companyActivities.filter(a => a.companyId === currentCompanyId);

    // Zapisz info o requescie (do regeneracji)
    lastAiRequest = {
        type: 'summary',
        entityType: 'company',
        entityId: currentCompanyId,
        data: { company, history, companyContacts, activities }
    };

    showAiModal('Podsumowanie firmy', null);

    try {
        const summary = await AIService.summarizeCompany(company, history, companyContacts, activities);
        lastAiResponse = summary;
        showAiModal('Podsumowanie: ' + company.name, summary);
    } catch (error) {
        console.error('AI Error:', error);
        lastAiRequest = null;
        lastAiResponse = null;
        showAiModal('Błąd AI', `Nie udało się wygenerować podsumowania:\n\n${error.message}`);
    }
}

async function summarizeContact() {
    if (!currentContactId) return;
    if (!AIService.enabled) {
        showAiSettings();
        return;
    }

    const contact = contacts.find(c => c.id === currentContactId);
    const history = contactHistory.filter(h => h.contactId === currentContactId);
    const activities = contactActivities.filter(a => a.contactId === currentContactId);

    // Zapisz info o requescie (do regeneracji)
    lastAiRequest = {
        type: 'summary',
        entityType: 'contact',
        entityId: currentContactId,
        data: { contact, history, activities }
    };

    showAiModal('Podsumowanie kontaktu', null);

    try {
        const summary = await AIService.summarizeCompany(contact, history, [], activities);
        lastAiResponse = summary;
        showAiModal('Podsumowanie: ' + contact.name, summary);
    } catch (error) {
        console.error('AI Error:', error);
        lastAiRequest = null;
        lastAiResponse = null;
        showAiModal('Błąd AI', `Nie udało się wygenerować podsumowania:\n\n${error.message}`);
    }
}

async function suggestNextSteps() {
    if (!currentCompanyId) return;
    if (!AIService.enabled) {
        showAiSettings();
        return;
    }

    const company = companies.find(c => c.id === currentCompanyId);
    const history = companyHistory.filter(h => h.companyId === currentCompanyId);
    const activities = companyActivities.filter(a => a.companyId === currentCompanyId);

    // Zapisz info o requescie (do regeneracji)
    lastAiRequest = {
        type: 'suggestions',
        entityType: 'company',
        entityId: currentCompanyId,
        data: { company, history, activities }
    };

    showAiModal('Sugestie działań', null);

    try {
        const suggestions = await AIService.suggestNextSteps(company, history, activities);
        lastAiResponse = suggestions;
        showAiModal('Sugestie dla: ' + company.name, suggestions);
    } catch (error) {
        console.error('AI Error:', error);
        lastAiRequest = null;
        lastAiResponse = null;
        showAiModal('Błąd AI', `Nie udało się wygenerować sugestii:\n\n${error.message}`);
    }
}

async function suggestContactNextSteps() {
    if (!currentContactId) return;
    if (!AIService.enabled) {
        showAiSettings();
        return;
    }

    const contact = contacts.find(c => c.id === currentContactId);
    const history = contactHistory.filter(h => h.contactId === currentContactId);
    const activities = contactActivities.filter(a => a.contactId === currentContactId);

    // Zapisz info o requescie (do regeneracji)
    lastAiRequest = {
        type: 'suggestions',
        entityType: 'contact',
        entityId: currentContactId,
        data: { contact, history, activities }
    };

    showAiModal('Sugestie działań', null);

    try {
        const suggestions = await AIService.suggestNextSteps(contact, history, activities);
        lastAiResponse = suggestions;
        showAiModal('Sugestie dla: ' + contact.name, suggestions);
    } catch (error) {
        console.error('AI Error:', error);
        lastAiRequest = null;
        lastAiResponse = null;
        showAiModal('Błąd AI', `Nie udało się wygenerować sugestii:\n\n${error.message}`);
    }
}

function showAiModal(title, content) {
    const modal = document.getElementById('aiModal');
    const titleEl = document.getElementById('aiModalTitle');
    const bodyEl = document.getElementById('aiModalBody');
    const actionsEl = document.getElementById('aiModalActions');

    titleEl.textContent = '✨ ' + title;

    if (content === null) {
        bodyEl.innerHTML = `
            <div class="ai-loading">
                <div class="spinner"></div>
                <p>AI analizuje dane...</p>
            </div>
        `;
        actionsEl.style.display = 'none';
    } else {
        bodyEl.innerHTML = `<div class="ai-response">${content.replace(/\n/g, '<br>')}</div>`;
        actionsEl.style.display = 'flex';
    }

    modal.classList.add('active');
}

function closeAiModal() {
    document.getElementById('aiModal').classList.remove('active');
}

function copyAiResponse() {
    const response = document.querySelector('.ai-response');
    if (!response) return;
    const text = response.innerText;
    navigator.clipboard.writeText(text).then(() => {
        showStatus('Skopiowano do schowka', 'success');
    });
}

/**
 * Regeneruj ostatnie AI zapytanie (bypass cache)
 */
async function regenerateLastAiRequest() {
    if (!lastAiRequest) {
        showStatus('Brak poprzedniego zapytania do regeneracji', 'error');
        return;
    }

    const { type, entityType, entityId, data } = lastAiRequest;

    // Pokaż loading state
    const titleText = type === 'summary' ? 'Podsumowanie' : 'Sugestie działań';
    showAiModal(titleText, null);

    try {
        let response;
        
        // Wywołaj odpowiednią funkcję z forceRefresh=true
        if (type === 'summary') {
            if (entityType === 'company') {
                response = await AIService.summarizeCompany(
                    data.company, 
                    data.history, 
                    data.companyContacts, 
                    data.activities,
                    true // forceRefresh - pomija cache
                );
            } else {
                response = await AIService.summarizeCompany(
                    data.contact, 
                    data.history, 
                    [], 
                    data.activities,
                    true // forceRefresh
                );
            }
        } else if (type === 'suggestions') {
            if (entityType === 'company') {
                response = await AIService.suggestNextSteps(
                    data.company, 
                    data.history, 
                    data.activities,
                    true // forceRefresh
                );
            } else {
                response = await AIService.suggestNextSteps(
                    data.contact, 
                    data.history, 
                    data.activities,
                    true // forceRefresh
                );
            }
        }

        lastAiResponse = response;
        const entityName = data.company?.name || data.contact?.name || 'Entity';
        const fullTitle = type === 'summary' 
            ? `Podsumowanie: ${entityName}` 
            : `Sugestie dla: ${entityName}`;
        showAiModal(fullTitle, response);
        showStatus('✨ Wygenerowano nową odpowiedź', 'success');
        
    } catch (error) {
        console.error('Regenerate AI Error:', error);
        showAiModal('Błąd AI', `Nie udało się wygenerować odpowiedzi:\n\n${error.message}`);
        showStatus('Błąd podczas regeneracji', 'error');
    }
}

/**
 * Zapisz odpowiedź AI jako notatkę w CRM
 */
async function saveAiResponseAsNote() {
    if (!lastAiResponse || !lastAiRequest) {
        showStatus('Brak odpowiedzi AI do zapisania', 'error');
        return;
    }

    const { entityType, entityId } = lastAiRequest;

    try {
        // Zapisz notatkę w odpowiednim miejscu używając logHistory
        if (entityType === 'company') {
            await DataService.logCompanyHistory(entityId, 'note', `[AI] ${lastAiResponse}`);
            // Przeładuj CAŁĄ historię firm z backendu (bez cache)
            companyHistory = await DataService.loadCompanyHistory(null, false);
            renderCompanyHistory(entityId);
            showStatus('💾 Zapisano jako notatkę w firmie', 'success');
        } else if (entityType === 'contact') {
            await DataService.logContactHistory(entityId, 'note', `[AI] ${lastAiResponse}`);
            // Przeładuj CAŁĄ historię kontaktów z backendu (bez cache)
            contactHistory = await DataService.loadContactHistory(null, false);
            renderContactHistory(entityId);
            showStatus('💾 Zapisano jako notatkę w kontakcie', 'success');
        }

        // Zamknij modal po zapisaniu
        setTimeout(() => {
            closeAiModal();
        }, 1000);

    } catch (error) {
        console.error('Save AI Note Error:', error);
        showStatus('Błąd podczas zapisywania notatki', 'error');
    }
}

// ========== AI SETTINGS LOGIC ==========

function showAiSettings() {
    const modal = document.getElementById('aiSettingsModal');
    const apiKeyInput = document.getElementById('aiApiKey');
    const providerSelect = document.getElementById('aiProvider');
    const consentCheckbox = document.getElementById('aiConsent');
    
    // Wczytaj zapisane dane
    apiKeyInput.value = localStorage.getItem('ai_api_key') || '';
    providerSelect.value = localStorage.getItem('ai_provider') || 'gemini';
    consentCheckbox.checked = localStorage.getItem('ai_consent') === 'true';
    
    // Zaktualizuj wygląd linków w zależności od wybranego dostawcy
    updateAiProviderUI();
    
    modal.classList.add('active');
}

function updateAiProviderUI() {
    const provider = document.getElementById('aiProvider').value;
    const label = document.getElementById('aiApiKeyLabel');
    const link = document.getElementById('aiApiKeyLink');
    
    if (provider === 'gemini') {
        label.childNodes[0].textContent = 'Gemini API Key ';
        link.href = 'https://aistudio.google.com/app/apikey';
    } else if (provider === 'openai') {
        label.childNodes[0].textContent = 'OpenAI API Key ';
        link.href = 'https://platform.openai.com/api-keys';
    } else if (provider === 'llm7') {
        label.childNodes[0].textContent = 'LLM7 API Key ';
        link.href = 'https://token.llm7.io/'; // Zakładany link do konsoli
    }
}

function closeAiSettings() {
    document.getElementById('aiSettingsModal').classList.remove('active');
}

function saveAiSettings() {
    const apiKey = document.getElementById('aiApiKey').value.trim();
    const provider = document.getElementById('aiProvider').value;
    const consent = document.getElementById('aiConsent').checked;

    if (!consent && apiKey) {
        alert('Musisz wyrazić zgodę na przetwarzanie danych przez AI.');
        return;
    }

    if (apiKey && consent) {
        localStorage.setItem('ai_api_key', apiKey);
        localStorage.setItem('ai_provider', provider);
        localStorage.setItem('ai_consent', 'true');
        
        // Re-inicjalizacja serwisu z nowymi danymi
        AIService.init(apiKey, provider);
        
        showStatus('Ustawienia AI zapisane', 'success');
    } else {
        localStorage.removeItem('ai_api_key');
        localStorage.removeItem('ai_provider');
        localStorage.removeItem('ai_consent');
        AIService.enabled = false;
        showStatus('AI wyłączone', 'success');
    }

    closeAiSettings();
}
async function testAiConnection() {
    const apiKey = document.getElementById('aiApiKey').value.trim();
    const provider = document.getElementById('aiProvider').value;
    const btn = document.getElementById('testAiBtn');
    
    if (!apiKey) {
        alert('Wprowadź API key');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Testuję...';

    // Tymczasowa inicjalizacja do testu
    const prevKey = AIService.API_KEY;
    const prevProvider = AIService.PROVIDER;
    
    AIService.init(apiKey, provider);

    try {
        const works = await AIService.testConnection();
        if (works) {
            showStatus(`✅ Połączenie z ${provider} działa!`, 'success');
        } else {
            showStatus('❌ Test nie powiódł się', 'error');
        }
    } catch (error) {
        showStatus('❌ Błąd: ' + error.message, 'error');
    }

    // Przywrócenie stanu (jeśli nie zapisano)
    if (!localStorage.getItem('ai_api_key')) {
        AIService.init(prevKey, prevProvider); 
    }
    
    btn.disabled = false;
    btn.textContent = '🧪 Testuj połączenie';
}

window.summarizeCompany = summarizeCompany;
window.summarizeContact = summarizeContact;
window.suggestNextSteps = suggestNextSteps;
window.suggestContactNextSteps = suggestContactNextSteps;
window.showAiSettings = showAiSettings;
window.closeAiSettings = closeAiSettings;
window.saveAiSettings = saveAiSettings;
window.testAiConnection = testAiConnection;
window.updateAiProviderUI = updateAiProviderUI;

// ============= EXPORT DROPDOWN =============

function toggleExportDropdown(type) {
    const dropdown = document.getElementById(`${type}ExportDropdown`);
    const btn = document.getElementById(`${type}ExportBtn`);
    const isVisible = dropdown.classList.contains('visible');
    
    // Zamknij wszystkie inne dropdown'y
    document.querySelectorAll('.export-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('visible');
    });
    document.querySelectorAll('.export-icon').forEach(b => {
        if (b !== btn && !b.classList.contains('active')) b.classList.remove('active');
    });
    
    // Toggle current dropdown
    if (isVisible) {
        dropdown.classList.remove('visible');
    } else {
        dropdown.classList.add('visible');
    }
}

// Zamknij dropdown po kliknięciu poza nim
document.addEventListener('click', (e) => {
    if (!e.target.closest('.export-wrapper')) {
        document.querySelectorAll('.export-dropdown').forEach(d => {
            d.classList.remove('visible');
        });
    }
});

// ============= SELECTION MODE =============

function toggleSelectionMode(type) {
    if (type === 'contacts') {
        contactsSelectionMode = !contactsSelectionMode;
        
        // Update checkbox
        const toggle = document.getElementById('contactsSelectionModeToggle');
        if (toggle) toggle.checked = contactsSelectionMode;
        
        // Update icon
        const btn = document.getElementById('contactsExportBtn');
        if (contactsSelectionMode) {
            btn.classList.add('active');
            document.body.setAttribute('data-contacts-selection-mode', 'true');
        } else {
            btn.classList.remove('active');
            document.body.removeAttribute('data-contacts-selection-mode');
            // Reset selections when turning off
            selectedContactIds = [];
            updateContactSelectionUI();
        }
        
        // Re-render to show/hide checkboxes
        renderAllContacts();
        
    } else if (type === 'companies') {
        companiesSelectionMode = !companiesSelectionMode;
        
        // Update checkbox
        const toggle = document.getElementById('companiesSelectionModeToggle');
        if (toggle) toggle.checked = companiesSelectionMode;
        
        // Update icon
        const btn = document.getElementById('companiesExportBtn');
        if (companiesSelectionMode) {
            btn.classList.add('active');
            document.body.setAttribute('data-companies-selection-mode', 'true');
        } else {
            btn.classList.remove('active');
            document.body.removeAttribute('data-companies-selection-mode');
            // Reset selections when turning off
            selectedCompanyIds = [];
            updateCompanySelectionUI();
        }
        
        // Re-render to show/hide checkboxes
        renderCompanies();
    }
}

// ============= SELECTION UI UPDATE =============

function updateContactSelectionUI() {
    const count = selectedContactIds.length;
    const countSpan = document.getElementById('contactsExportCount');
    const exportItem = document.getElementById('contactsExportSelectedItem');
    
    if (countSpan) {
        countSpan.textContent = `(${count})`;
    }
    
    if (exportItem) {
        if (count === 0) {
            exportItem.classList.add('disabled');
        } else {
            exportItem.classList.remove('disabled');
        }
    }
}

function updateCompanySelectionUI() {
    const count = selectedCompanyIds.length;
    const countSpan = document.getElementById('companiesExportCount');
    const exportItem = document.getElementById('companiesExportSelectedItem');
    
    if (countSpan) {
        countSpan.textContent = `(${count})`;
    }
    
    if (exportItem) {
        if (count === 0) {
            exportItem.classList.add('disabled');
        } else {
            exportItem.classList.remove('disabled');
        }
    }
}

// ============= START =============
if (typeof gapi !== 'undefined') {
    init();
} else {
    window.addEventListener('load', () => {
        setTimeout(init, 1000);
    });
}
