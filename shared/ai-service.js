// AI Service - Supports Gemini, OpenAI, and LLM7.io
// Full business logic preserved

export class AIService {
    static API_KEY = null;
    static PROVIDER = 'gemini'; // 'gemini', 'openai', 'llm7'
    static enabled = false;
    static CACHE_TTL = 10 * 60 * 1000; // 10 minut w milisekundach
    static CACHE_STORAGE_KEY = 'ai_response_cache'; // localStorage key

    /**
     * Initialize AI service with user's settings
     */
    static init(apiKey, provider = 'gemini') {
        if (!apiKey) {
            this.enabled = false;
            return false;
        }
        this.API_KEY = apiKey;
        this.PROVIDER = provider;
        this.enabled = true;
        
        // Wyczyść wygasłe cache entries przy inicjalizacji
        this.cleanExpiredCache();
        
        return true;
    }

    /**
     * CENTRALNA METODA: Wybiera odpowiedniego dostawcę i wysyła zapytanie
     * @param {boolean} forceRefresh - Jeśli true, pomija cache i generuje nową odpowiedź
     */
    static async generateContent(prompt, systemPrompt = '', temperature = 0.7, forceRefresh = false) {
        if (!this.enabled || !this.API_KEY) {
            throw new Error('AI is not enabled. Please check settings.');
        }

        // Generuj klucz cache na podstawie prompta i system prompta
        const cacheKey = this.generateCacheKey(prompt, systemPrompt, temperature);

        // Sprawdź cache (jeśli nie force refresh)
        if (!forceRefresh) {
            const cached = this.getCachedResponse(cacheKey);
            if (cached) {
                console.log('📦 AI Response loaded from cache');
                return cached;
            }
        }

        console.log(`🤖 AI Request via: ${this.PROVIDER}${forceRefresh ? ' (force refresh)' : ''}`);

        // Wywołaj odpowiedniego providera
        let response;
        if (this.PROVIDER === 'openai') {
            response = await this.callOpenAI(prompt, systemPrompt, temperature);
        } else if (this.PROVIDER === 'llm7') {
            response = await this.callLLM7(prompt, systemPrompt, temperature);
        } else {
            response = await this.callGemini(prompt, systemPrompt, temperature);
        }

        // Zapisz do cache (localStorage)
        this.setCachedResponse(cacheKey, response);

        return response;
    }

    /**
     * Pobierz odpowiedź z localStorage cache
     */
    static getCachedResponse(cacheKey) {
        try {
            const cacheData = localStorage.getItem(this.CACHE_STORAGE_KEY);
            if (!cacheData) return null;

            const cache = JSON.parse(cacheData);
            const entry = cache[cacheKey];

            if (!entry) return null;

            const now = Date.now();
            
            // Sprawdź czy cache nie wygasł (10 minut)
            if (now - entry.timestamp < this.CACHE_TTL) {
                return entry.response;
            } else {
                // Cache wygasł, usuń go
                delete cache[cacheKey];
                localStorage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(cache));
                return null;
            }
        } catch (error) {
            console.error('Cache read error:', error);
            return null;
        }
    }

    /**
     * Zapisz odpowiedź do localStorage cache
     */
    static setCachedResponse(cacheKey, response) {
        try {
            const cacheData = localStorage.getItem(this.CACHE_STORAGE_KEY);
            const cache = cacheData ? JSON.parse(cacheData) : {};

            cache[cacheKey] = {
                response: response,
                timestamp: Date.now()
            };

            localStorage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(cache));
        } catch (error) {
            console.error('Cache write error:', error);
        }
    }

    /**
     * Wyczyść wygasłe cache entries (wywołane przy init)
     */
    static cleanExpiredCache() {
        try {
            const cacheData = localStorage.getItem(this.CACHE_STORAGE_KEY);
            if (!cacheData) return;

            const cache = JSON.parse(cacheData);
            const now = Date.now();
            let cleaned = false;

            Object.keys(cache).forEach(key => {
                if (now - cache[key].timestamp >= this.CACHE_TTL) {
                    delete cache[key];
                    cleaned = true;
                }
            });

            if (cleaned) {
                localStorage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(cache));
                console.log('🧹 Expired cache entries cleaned');
            }
        } catch (error) {
            console.error('Cache cleanup error:', error);
        }
    }

    /**
     * Generuje unikalny klucz cache na podstawie parametrów
     */
    static generateCacheKey(prompt, systemPrompt, temperature) {
        const combined = `${systemPrompt}|${prompt}|${temperature}`;
        return this.simpleHash(combined);
    }

    /**
     * Prosty hash function dla cache keys
     */
    static simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * Wyczyść cały cache (opcjonalnie)
     */
    static clearCache() {
        try {
            localStorage.removeItem(this.CACHE_STORAGE_KEY);
            console.log('🗑️ AI Cache cleared');
        } catch (error) {
            console.error('Cache clear error:', error);
        }
    }

    /**
     * Pobierz statystyki cache (do debugowania)
     */
    static getCacheStats() {
        try {
            const cacheData = localStorage.getItem(this.CACHE_STORAGE_KEY);
            if (!cacheData) return { entries: 0, size: 0 };

            const cache = JSON.parse(cacheData);
            const entries = Object.keys(cache).length;
            const size = new Blob([cacheData]).size;

            return { entries, size };
        } catch (error) {
            console.error('Cache stats error:', error);
            return { entries: 0, size: 0 };
        }
    }

    // ==========================================
    // SEKCJA 1: IMPLEMENTACJE DOSTAWCÓW (PROVIDERS)
    // ==========================================

    /**
     * Google Gemini API Implementation
     */
    static async callGemini(prompt, systemPrompt, temperature) {
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: systemPrompt + '\n\n' + prompt }]
                        }],
                        generationConfig: {
                            temperature: temperature,
                            maxOutputTokens: 1500
                        }
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Gemini API failed');
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Gemini Error:', error);
            throw error;
        }
    }

    /**
     * OpenAI API Implementation (GPT-4o-mini)
     */
    static async callOpenAI(prompt, systemPrompt, temperature) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ],
                    temperature: temperature,
                    max_tokens: 1500
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'OpenAI API failed');
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI Error:', error);
            throw error;
        }
    }

    /**
     * LLM7.io API Implementation
     */
    static async callLLM7(prompt, systemPrompt, temperature) {
        try {
            const response = await fetch('https://api.llm7.io/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.API_KEY}`
                },
                body: JSON.stringify({
                    model: "llm7-chat",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ],
                    temperature: temperature,
                    max_tokens: 1500
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'LLM7 API failed');
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('LLM7 Error:', error);
            throw error;
        }
    }

    /**
     * Test połączenia z wybranym API
     */
    static async testConnection() {
        try {
            const response = await this.generateContent(
                'Napisz tylko słowo: OK', 
                'Jesteś botem testowym.', 
                0.1
            );
            return response && response.length > 0;
        } catch (error) {
            console.error('Test connection failed:', error);
            throw error;
        }
    }

    // ==========================================
    // SEKCJA 2: NARZĘDZIA (HELPERS)
    // ==========================================

    static anonymize(text) {
        if (!text) return '';
        return text
            .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[EMAIL]')
            .replace(/(\+48)?\s?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g, '[TELEFON]')
            .replace(/\d{11}/g, '[PESEL]')
            .replace(/\d{10}/g, '[NIP]')
            .replace(/https?:\/\/[^\s]+/gi, '[URL]');
    }

    static getCurrentDateContext() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const dayOfWeek = now.getDay();
        
        const dateStr = now.toLocaleDateString('pl-PL', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        let context = `Dzisiaj jest: ${dateStr}\n`;
        
        if (month === 12 && day >= 20) context += 'Kontekst: Okres przedświąteczny. Ludzie są zabiegani, ale otwarci na życzenia.\n';
        else if (month === 1 && day <= 15) context += 'Kontekst: Początek nowego roku. Okres planowania.\n';
        else if (month >= 6 && month <= 8) context += 'Kontekst: Okres wakacyjny. Działania mogą być wolniejsze.\n';
        else if ((month === 3 || month === 6 || month === 9 || month === 12) && day >= 25) context += 'Kontekst: Koniec kwartału. Czas zamykania spraw.\n';
        
        if (dayOfWeek === 1) context += 'To poniedziałek - początek tygodnia pracy.\n';
        else if (dayOfWeek === 5) context += 'To piątek - koniec tygodnia pracy.\n';
        
        return context;
    }

    static detectEntityType(entity, contacts = []) {
        if (entity.companyId !== undefined) return 'contact';
        if (entity.industry !== undefined) return 'company';
        if (contacts.length === 0 && entity.email) return 'contact';
        return 'company';
    }

    // ==========================================
    // SEKCJA 3: LOGIKA BIZNESOWA (ORYGINALNE PROMPTY)
    // ==========================================

    /**
     * Funkcja 1: Podsumuj historię (Firma lub Kontakt)
     * @param {boolean} forceRefresh - Jeśli true, pomija cache
     */
    static async summarizeCompany(entity, history, contacts, activities, forceRefresh = false) {
        const entityType = this.detectEntityType(entity, contacts);
        const dateContext = this.getCurrentDateContext();
        
        if (entityType === 'contact') {
            // PROMPT DLA OSOBY
            const systemPrompt = `Jesteś empatycznym doradcą relacji biznesowych. 
Analizujesz historię kontaktu z OSOBĄ KONTAKTOWĄ.

Twoje podejście:
- Miękkie, relacyjne, kontekstowe
- Skupiasz się na potencjale relacji interpersonalnej
- Bierzesz pod uwagę, czy osoba jest powiązana z firmą i jaką rolę w niej pełni
- Analizujesz historię i dynamikę kontaktu
- Sugerujesz możliwe okazje do podtrzymania lub pogłębienia relacji
- Swoją rekomendację kierujesz do handlowca pracującego w CRM, który właśnie jest w widoku tej osoby kontaktowej w CRM

Ton: empatyczny, partnerski, naturalny, nienachalny.
Odpowiadaj TYLKO po polsku.`;

            const companyLine = (() => {
                const c = entity.linkedCompany;
                if (c && (c.name || c.id)) {
                    const loc = [c.city, c.country].filter(Boolean).join(', ');
                    const meta = [c.industry, loc].filter(Boolean).join(' • ');
                    return `Powiązana firma: ${c.name || 'Nieznana'}${meta ? ` (${meta})` : ''}`;
                }
                if (entity.companyId) return 'Powiązana firma: Tak (brak szczegółów)';
                return 'Powiązana firma: Brak';
            })();

            const contactInfo = `Osoba: ${entity.name}
${entity.position ? `Stanowisko: ${entity.position}` : ''}
${entity.email ? `Email: [EMAIL]` : ''}
${entity.phone ? `Telefon: [TELEFON]` : ''}
${companyLine}
Liczba aktywności: ${activities.length}`;

            const recentHistory = history
                .filter(h => h.type === 'note')
                .slice(0, 5)
                .map(h => `- ${this.anonymize(h.content)}`)
                .join('\n');

            const recentActivities = activities
                .slice(0, 5)
                .map(a => {
                    const date = new Date(a.date);
                    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
                    return `- ${a.type}: ${this.anonymize(a.title)} (${daysAgo} dni temu)`;
                })
                .join('\n');

            const prompt = `${dateContext}

Przeanalizuj historię kontaktu z tą osobą:

${contactInfo}

Ostatnie notatki:
${recentHistory || 'Brak notatek'}

Ostatnie aktywności:
${recentActivities || 'Brak aktywności'}

Napisz ciepłe, empatyczne podsumowanie (3-4 zdania) zawierające:
1. Jakość i potencjał relacji z tą osobą (uwzględnij powiązaną firmę, jeśli jest)
2. Dynamikę kontaktu (czy jest regularny, czy ustał)
3. Subtelne sugestie jak podtrzymać lub pogłębić relację
4. Jeśli kontekst czasowy sprzyja kontaktowi - wspomnij o tym naturalnie`;

            // UŻYWA GENERIC LOADERA
            return await this.generateContent(prompt, systemPrompt, 0.8, forceRefresh);
            
        } else {
            // PROMPT DLA FIRMY
            const systemPrompt = `Jesteś strategicznym analitykiem biznesowym CRM.
Analizujesz historię współpracy z FIRMĄ / ORGANIZACJĄ.

Twoje podejście:
- Analityczne, surowe, strukturalne
- Oceniasz organizację jako całość
- Oceniasz potencjał biznesowy relacji
- Identyfikujesz sygnały aktywności lub stagnacji
- Wskazujesz możliwe ryzyka i szanse współpracy
- Swoją rekomendację kierujesz do handlowca pracującego w CRM, który właśnie jest w widoku tej firmy w CRM

Ton: rzeczowy, strategiczny, profesjonalny.
Odpowiadaj TYLKO po polsku.`;

            const companyInfo = `Firma: ${entity.name}
Branża: ${entity.industry || 'brak informacji'}
Liczba powiązanych kontaktów: ${contacts.length}
Liczba aktywności: ${activities.length}`;

            const contactsList = contacts.length > 0 
                ? contacts.slice(0, 5).map(c => `- ${c.name}${c.position ? ` (${c.position})` : ''}`).join('\n')
                : 'Brak przypisanych osób kontaktowych';

            const recentHistory = history
                .filter(h => h.type === 'note')
                .slice(0, 5)
                .map(h => `- ${this.anonymize(h.content)}`)
                .join('\n');

            const recentActivities = activities
                .slice(0, 5)
                .map(a => {
                    const date = new Date(a.date);
                    const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
                    return `- ${a.type}: ${this.anonymize(a.title)} (${daysAgo} dni temu)`;
                })
                .join('\n');

            const prompt = `${dateContext}

Przeanalizuj historię współpracy z tą organizacją:

${companyInfo}

Kluczowe osoby:
${contactsList}

Ostatnie notatki:
${recentHistory || 'Brak notatek'}

Ostatnie aktywności:
${recentActivities || 'Brak aktywności'}

Napisz rzeczowe, analityczne podsumowanie (3-4 zdania) zawierające:
1. Ocenę organizacji jako całości i status współpracy
2. Strukturę relacji (kto jest kluczowy, jaka jest dynamika)
3. Potencjał biznesowy i możliwe ryzyka
4. Konkretne, logiczne rekomendacje dalszych kroków`;

            // UŻYWA GENERIC LOADERA
            return await this.generateContent(prompt, systemPrompt, 0.7, forceRefresh);
        }
    }

    /**
     * Funkcja 2: Zaproponuj następne kroki
     * @param {boolean} forceRefresh - Jeśli true, pomija cache
     */
    static async suggestNextSteps(entity, history, activities, forceRefresh = false) {
        const entityType = this.detectEntityType(entity, []);
        const dateContext = this.getCurrentDateContext();
        
        if (entityType === 'contact') {
            // SUGESTIE DLA KONTAKTU
            const systemPrompt = `Jesteś empatycznym doradcą relacji biznesowych.
Proponujesz subtelne, naturalne kroki do podtrzymania lub pogłębienia relacji z OSOBĄ KONTAKTOWĄ.

Twoje sugestie:
- Są naturalne i nienachalne
- Koncentrują się na budowaniu relacji, nie na sprzedaży
- Uwzględniają powiązanie osoby z firmą (jeśli istnieje) i wynikające z tego możliwości
- Uwzględniają kontekst czasowy i okoliczności
- Są wykonalne i konkretne
- Swoją rekomendację kierujesz do handlowca pracującego w CRM, który właśnie jest w widoku tej osoby kontaktowej w CRM

Ton: partnerski, ciepły, pomocny.
Format: numerowana lista (3 kroki).
Odpowiadaj TYLKO po polsku.`;

            const lastActivity = activities[0];
            const lastActivityInfo = lastActivity 
                ? `Ostatnia aktywność: ${lastActivity.type} - "${this.anonymize(lastActivity.title)}" (${new Date(lastActivity.date).toLocaleDateString('pl-PL')})`
                : 'Brak ostatniej aktywności';

            const recentNotes = history
                .filter(h => h.type === 'note')
                .slice(0, 3)
                .map(h => this.anonymize(h.content))
                .join('\n');

            const companyLine = (() => {
                const c = entity.linkedCompany;
                if (c && (c.name || c.id)) {
                    const loc = [c.city, c.country].filter(Boolean).join(', ');
                    const meta = [c.industry, loc].filter(Boolean).join(' • ');
                    return `Firma: ${c.name || 'Nieznana'}${meta ? ` (${meta})` : ''}`;
                }
                if (entity.companyId) return 'Firma: Tak (brak szczegółów)';
                return 'Firma: Brak';
            })();

            const prompt = `${dateContext}

Osoba kontaktowa: ${entity.name}
${entity.position ? `Stanowisko: ${entity.position}` : ''}
${companyLine}

${lastActivityInfo}

Ostatnie notatki:
${recentNotes || 'Brak notatek'}

Zaproponuj 3 subtelne, naturalne kroki na najbliższe 7-14 dni.`;

            return await this.generateContent(prompt, systemPrompt, 0.8, forceRefresh);
            
        } else {
            // SUGESTIE DLA FIRMY
            const systemPrompt = `Jesteś strategicznym doradcą biznesowym CRM.
Proponujesz konkretne, logiczne kroki do rozwoju współpracy z FIRMĄ.

Twoje sugestie:
- Są strategiczne i biznesowe
- Koncentrują się na potencjale współpracy
- Są oparte na faktach i danych
- Uwzględniają ryzyka i szanse
- Swoją rekomendację kierujesz do handlowca pracującego w CRM, który właśnie jest w widoku tej firmy w CRM

Ton: rzeczowy, profesjonalny, strategiczny.
Format: numerowana lista (3 kroki).
Odpowiadaj TYLKO po polsku.`;

            const lastActivity = activities[0];
            const lastActivityInfo = lastActivity 
                ? `Ostatnia aktywność: ${lastActivity.type} - "${this.anonymize(lastActivity.title)}" (${new Date(lastActivity.date).toLocaleDateString('pl-PL')})`
                : 'Brak ostatniej aktywności';

            const recentNotes = history
                .filter(h => h.type === 'note')
                .slice(0, 3)
                .map(h => this.anonymize(h.content))
                .join('\n');

            const prompt = `${dateContext}

Firma: ${entity.name}
Branża: ${entity.industry || 'brak informacji'}

${lastActivityInfo}

Ostatnie notatki:
${recentNotes || 'Brak notatek'}

Zaproponuj 3 konkretne, strategiczne kroki na najbliższe 7-14 dni.`;

            return await this.generateContent(prompt, systemPrompt, 0.7, forceRefresh);
        }
    }


    /**
     * Funkcja 3: Enrichment notatki o firmie (bez przeglądania internetu)
     * Tworzy notatkę gotową do wklejenia do CRM: czym firma może się zajmować,
     * potencjalne potrzeby, pytania discovery i pomysły na pierwszy kontakt.
     *
     * WAŻNE:
     * - Nie przeglądasz internetu i nie weryfikujesz faktów.
     * - Nie wymyślaj twardych danych (np. przychody, klienci, liczba pracowników),
     *   chyba że są w danych wejściowych.
     *
     * @param {Object} company
     * @param {Array} contacts
     * @param {Array} history
     * @param {Array} activities
     * @param {boolean} forceRefresh - Jeśli true, pomija cache
     */
    static async enrichCompanyNote(company, contacts = [], history = [], activities = [], forceRefresh = false) {
        const dateContext = this.getCurrentDateContext();

        const systemPrompt = `Jesteś asystentem handlowca w CRM.
Tworzysz "enrichment notatki" o firmie na podstawie DANYCH Z CRM przekazanych w promptcie.

Zasady:
- NIE przeglądasz internetu i NIE masz dostępu do zewnętrznych źródeł.
- Jeśli brakuje danych, nie zmyślaj faktów. Zamiast tego podaj HIPOTEZY i PYTANIA do weryfikacji.
- Odpowiadaj TYLKO po polsku.
- Format: zwięzła notatka gotowa do wklejenia do CRM (nagłówki + punktory).`;

        const loc = [company.city, company.country].filter(Boolean).join(', ');
        const website = company.website ? (company.website.startsWith('http') ? company.website : `https://${company.website}`) : '';

        const keyPeople = contacts && contacts.length
            ? contacts.slice(0, 6).map(c => `- ${c.name}${c.position ? ` (${c.position})` : ''}`).join('\n')
            : 'Brak przypisanych osób kontaktowych';

        const recentNotes = (history || [])
            .filter(h => h.type === 'note')
            .slice(0, 3)
            .map(h => `- ${this.anonymize(h.content)}`)
            .join('\n');

        const recentActivities = (activities || [])
            .slice(0, 3)
            .map(a => `- ${a.type}: ${this.anonymize(a.title)} (${new Date(a.date).toLocaleDateString('pl-PL')})`)
            .join('\n');

        const prompt = `${dateContext}

Dane firmy (z CRM, mogą być niepełne):
- Nazwa: ${company.name}
- Branża: ${company.industry || 'brak'}
- WWW: ${website || 'brak'}
- Lokalizacja: ${loc || 'brak'}
- Notatki wewnętrzne: ${company.notes ? this.anonymize(company.notes) : 'brak'}

Kluczowe osoby:
${keyPeople}

Ostatnie notatki:
${recentNotes || 'Brak'}

Ostatnie aktywności:
${recentActivities || 'Brak'}

Wygeneruj "enrichment notatkę" w tym układzie:
1) PROFIL (1–2 zdania): czym firma może się zajmować. Jeśli nie masz danych — podaj 2–3 HIPOTEZY (wyraźnie oznaczone jako hipotezy).
2) MOŻLIWE POTRZEBY / PAIN POINTS (3–5 punktów): dopasowane do branży i kontekstu z CRM.
3) PYTANIA DISCOVERY (3 krótkie pytania).
4) POMYSŁY NA PIERWSZY KONTAKT (3 propozycje: mail / telefon / LinkedIn).
5) DALSZE KROKI W CRM (2–3 bardzo konkretne działania).

Nie podawaj "twardych faktów" ani nazw klientów/produktów firmy, jeśli nie wynikają z danych wejściowych.`;

        return await this.generateContent(prompt, systemPrompt, 0.7, forceRefresh);
    }

    /**
     * Funkcja 3: Generuj draft emaila (Przywrócona!)
     */
    static async generateEmailDraft(contact, company, purpose, context = '') {
        const systemPrompt = `Jesteś asystentem biznesowym. Piszesz profesjonalne emaile biznesowe.
Odpowiadaj TYLKO po polsku. Email powinien być zwięzły, konkretny i profesjonalny.`;

        const contactInfo = contact.position 
            ? `${contact.position}` 
            : 'Kontakt';

        const prompt = `Napisz profesjonalny email do osoby:
Firma: ${company.name}
Branża: ${company.industry || 'brak'}
Stanowisko odbiorcy: ${contactInfo}

Cel emaila: ${purpose}

${context ? `Dodatkowy kontekst:\n${this.anonymize(context)}` : ''}

Wygeneruj kompletny email zawierający:
- Temat emaila (poprzedź znakiem "TEMAT:")
- Treść emaila (grzecznie, profesjonalnie, bez zbędnego gadania)
- Zakończ stosownym podpisem

NIE używaj placeholderów typu [Twoje imię] - po prostu zakończ email.
Email powinien być gotowy do wysłania (max 150 słów).`;

        return await this.generateContent(prompt, systemPrompt, 0.8);
    }
}
