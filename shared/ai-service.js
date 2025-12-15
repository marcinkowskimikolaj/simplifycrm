// AI Service - Supports Gemini, OpenAI, and LLM7.io
// Full business logic preserved

export class AIService {
    static API_KEY = null;
    static PROVIDER = 'gemini'; // 'gemini', 'openai', 'llm7'
    static enabled = false;

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
        return true;
    }

    /**
     * CENTRALNA METODA: Wybiera odpowiedniego dostawcę i wysyła zapytanie
     */
    static async generateContent(prompt, systemPrompt = '', temperature = 0.7) {
        if (!this.enabled || !this.API_KEY) {
            throw new Error('AI is not enabled. Please check settings.');
        }

        console.log(`🤖 AI Request via: ${this.PROVIDER}`);

        if (this.PROVIDER === 'openai') {
            return await this.callOpenAI(prompt, systemPrompt, temperature);
        } else if (this.PROVIDER === 'llm7') {
            return await this.callLLM7(prompt, systemPrompt, temperature);
        } else {
            return await this.callGemini(prompt, systemPrompt, temperature);
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
     */
    static async summarizeCompany(entity, history, contacts, activities) {
        const entityType = this.detectEntityType(entity, contacts);
        const dateContext = this.getCurrentDateContext();
        
        if (entityType === 'contact') {
            // PROMPT DLA OSOBY
            const systemPrompt = `Jesteś empatycznym doradcą relacji biznesowych. 
Analizujesz historię kontaktu z OSOBĄ KONTAKTOWĄ.

Twoje podejście:
- Miękkie, relacyjne, kontekstowe
- Skupiasz się na potencjale relacji interpersonalnej
- Analizujesz historię i dynamikę kontaktu
- Sugerujesz możliwe okazje do podtrzymania lub pogłębienia relacji

Ton: empatyczny, partnerski, naturalny, nienachalny.
Odpowiadaj TYLKO po polsku.`;

            const contactInfo = `Osoba: ${entity.name}
${entity.position ? `Stanowisko: ${entity.position}` : ''}
${entity.email ? `Email: [EMAIL]` : ''}
${entity.phone ? `Telefon: [TELEFON]` : ''}
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
1. Jakość i potencjał relacji z tą osobą
2. Dynamikę kontaktu (czy jest regularny, czy ustał)
3. Subtelne sugestie jak podtrzymać lub pogłębić relację
4. Jeśli kontekst czasowy sprzyja kontaktowi - wspomnij o tym naturalnie`;

            // UŻYWA GENERIC LOADERA
            return await this.generateContent(prompt, systemPrompt, 0.8);
            
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
            return await this.generateContent(prompt, systemPrompt, 0.7);
        }
    }

    /**
     * Funkcja 2: Zaproponuj następne kroki
     */
    static async suggestNextSteps(entity, history, activities) {
        const entityType = this.detectEntityType(entity, []);
        const dateContext = this.getCurrentDateContext();
        
        if (entityType === 'contact') {
            // SUGESTIE DLA KONTAKTU
            const systemPrompt = `Jesteś empatycznym doradcą relacji biznesowych.
Proponujesz subtelne, naturalne kroki do podtrzymania lub pogłębienia relacji z OSOBĄ KONTAKTOWĄ.

Twoje sugestie:
- Są naturalne i nienachalne
- Koncentrują się na budowaniu relacji, nie na sprzedaży
- Uwzględniają kontekst czasowy i okoliczności
- Są wykonalne i konkretne

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

            const prompt = `${dateContext}

Osoba kontaktowa: ${entity.name}
${entity.position ? `Stanowisko: ${entity.position}` : ''}

${lastActivityInfo}

Ostatnie notatki:
${recentNotes || 'Brak notatek'}

Zaproponuj 3 subtelne, naturalne kroki na najbliższe 7-14 dni.`;

            return await this.generateContent(prompt, systemPrompt, 0.8);
            
        } else {
            // SUGESTIE DLA FIRMY
            const systemPrompt = `Jesteś strategicznym doradcą biznesowym CRM.
Proponujesz konkretne, logiczne kroki do rozwoju współpracy z FIRMĄ.

Twoje sugestie:
- Są strategiczne i biznesowe
- Koncentrują się na potencjale współpracy
- Są oparte na faktach i danych
- Uwzględniają ryzyka i szanse

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

            return await this.generateContent(prompt, systemPrompt, 0.7);
        }
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
