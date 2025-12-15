// AI Service using Google Gemini API
// MVP: Company summaries, suggestions, email drafts

export class AIService {
    static API_KEY = null;
    static enabled = false;

    /**
     * Initialize AI service with user's API key
     */
    static init(apiKey) {
        if (!apiKey) {
            this.enabled = false;
            return false;
        }
        this.API_KEY = apiKey;
        this.enabled = true;
        return true;
    }

    /**
     * Main Gemini API call
     */
    static async callGemini(prompt, systemPrompt = '', temperature = 0.7) {
        if (!this.enabled || !this.API_KEY) {
            throw new Error('AI is not enabled. Please add API key in settings.');
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-12b-it:generateContent?key=${this.API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: systemPrompt + '\n\n' + prompt }]
                        }],
                        generationConfig: {
                            temperature: temperature,
                            maxOutputTokens: 1500,
                            topK: 40,
                            topP: 0.95,
                        },
                        safetySettings: [
                            {
                                category: "HARM_CATEGORY_HARASSMENT",
                                threshold: "BLOCK_MEDIUM_AND_ABOVE"
                            },
                            {
                                category: "HARM_CATEGORY_HATE_SPEECH",
                                threshold: "BLOCK_MEDIUM_AND_ABOVE"
                            }
                        ]
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'API call failed');
            }

            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0]) {
                throw new Error('No response from AI');
            }

            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    }

    /**
     * Anonimizacja danych przed wysłaniem do AI (GDPR)
     */
    static anonymize(text) {
        if (!text) return '';
        
        return text
            // Email addresses
            .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[EMAIL]')
            // Phone numbers (PL format)
            .replace(/(\+48)?\s?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g, '[TELEFON]')
            // PESEL-like numbers
            .replace(/\d{11}/g, '[PESEL]')
            // NIP numbers
            .replace(/\d{10}/g, '[NIP]')
            // URLs
            .replace(/https?:\/\/[^\s]+/gi, '[URL]');
    }

    /**
     * Pobierz aktualną datę i kontekst czasowy
     */
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
        
        // Święta i specjalne okresy
        if (month === 12 && day >= 20) {
            context += 'Kontekst: Okres przedświąteczny (Boże Narodzenie). Ludzie są zabiegani, ale otwarci na życzenia i ciepłe kontakty.\n';
        } else if (month === 12 && day <= 31) {
            context += 'Kontekst: Koniec roku. Czas podsumowań, planowania budżetów na nowy rok i zamykania spraw.\n';
        } else if (month === 1 && day <= 15) {
            context += 'Kontekst: Początek nowego roku. Okres planowania, stawiania celów i nowych inicjatyw.\n';
        } else if (month === 3 && day === 8) {
            context += 'Kontekst: Dzień Kobiet. Dobry moment na ciepły kontakt z kobietami w biznesie.\n';
        } else if (month === 4 && day >= 1 && day <= 20) {
            context += 'Kontekst: Okres wielkanocny. Ludzie są bardziej refleksyjni, otwarci na kontakty.\n';
        } else if (month >= 6 && month <= 8) {
            context += 'Kontekst: Okres wakacyjny/urlopowy. Działania biznesowe mogą być wolniejsze.\n';
        } else if (month === 11 && day >= 20) {
            context += 'Kontekst: Black Friday. Okres intensywnych zakupów i promocji.\n';
        } else if ((month === 3 || month === 6 || month === 9 || month === 12) && day >= 25) {
            context += 'Kontekst: Koniec kwartału. Czas zamykania spraw, podejmowania decyzji budżetowych.\n';
        } else if ((month === 1 || month === 4 || month === 7 || month === 10) && day <= 10) {
            context += 'Kontekst: Początek kwartału. Dobry moment na nowe inicjatywy i planowanie.\n';
        }
        
        // Dzień tygodnia
        if (dayOfWeek === 1) {
            context += 'To poniedziałek - początek tygodnia pracy.\n';
        } else if (dayOfWeek === 5) {
            context += 'To piątek - koniec tygodnia pracy, ludzie myślą o weekendzie.\n';
        }
        
        return context;
    }

    /**
     * Rozpoznaj typ podmiotu (firma vs osoba kontaktowa)
     */
    static detectEntityType(entity, contacts = []) {
        // Jeśli ma właściwość 'companyId' to jest to kontakt
        if (entity.companyId !== undefined) {
            return 'contact';
        }
        // Jeśli ma właściwość 'industry' to jest to firma
        if (entity.industry !== undefined) {
            return 'company';
        }
        // Jeśli podano contacts i są puste, to najprawdopodobniej to kontakt
        if (contacts.length === 0 && entity.email) {
            return 'contact';
        }
        // Domyślnie firma
        return 'company';
    }

    /**
     * MVP Funkcja 1: Podsumuj historię firmy lub osoby kontaktowej
     */
    static async summarizeCompany(entity, history, contacts, activities) {
        const entityType = this.detectEntityType(entity, contacts);
        const dateContext = this.getCurrentDateContext();
        
        if (entityType === 'contact') {
            // ANALIZA OSOBY KONTAKTOWEJ - miękkie, relacyjne podejście
            const systemPrompt = `Jesteś empatycznym doradcą relacji biznesowych. 
Analizujesz historię kontaktu z OSOBĄ KONTAKTOWĄ.

Twoje podejście:
- Miękkie, relacyjne, kontekstowe
- Skupiasz się na potencjale relacji interpersonalnej
- Analizujesz historię i dynamikę kontaktu
- Oceniasz częstotliwość i jakość interakcji
- Sugerujesz możliwe okazje do podtrzymania lub pogłębienia relacji
- Rekomendacje są subtelne, bez nachalnej sprzedaży

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
4. Jeśli kontekst czasowy (święta, koniec kwartału itp.) sprzyja kontaktowi - wspomnij o tym naturalnie

Pamiętaj: To analiza OSOBY, nie firmy. Bądź ciepły, partnerski i nienachalny.`;

            return await this.callGemini(prompt, systemPrompt, 0.8);
            
        } else {
            // ANALIZA FIRMY - analityczne, strukturalne podejście
            const systemPrompt = `Jesteś strategicznym analitykiem biznesowym CRM.
Analizujesz historię współpracy z FIRMĄ / ORGANIZACJĄ.

Twoje podejście:
- Analityczne, surowe, strukturalne
- Oceniasz organizację jako całość
- Analizujesz powiązane osoby kontaktowe i ich role
- Oceniasz potencjał biznesowy relacji
- Identyfikujesz sygnały aktywności lub stagnacji
- Wskazujesz możliwe ryzyka i szanse współpracy
- Dajesz logiczne i konkretne rekomendacje

Ton: rzeczowy, strategiczny, profesjonalny, bez emocjonalnych sugestii.
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

Kluczowe osoby w organizacji:
${contactsList}

Ostatnie notatki:
${recentHistory || 'Brak notatek'}

Ostatnie aktywności:
${recentActivities || 'Brak aktywności'}

Napisz rzeczowe, analityczne podsumowanie (3-4 zdania) zawierające:
1. Ocenę organizacji jako całości i status współpracy
2. Strukturę relacji (kto jest kluczowy, jaka jest dynamika)
3. Potencjał biznesowy i możliwe ryzyka
4. Konkretne, logiczne rekomendacje dalszych kroków
5. Jeśli kontekst czasowy (koniec kwartału, budżety) jest istotny biznesowo - uwzględnij to

Pamiętaj: To analiza FIRMY, nie osoby. Bądź analityczny, strategiczny i konkretny.`;

            return await this.callGemini(prompt, systemPrompt, 0.7);
        }
    }

    /**
     * MVP Funkcja 2: Zaproponuj następne kroki
     */
    static async suggestNextSteps(entity, history, activities) {
        const entityType = this.detectEntityType(entity, []);
        const dateContext = this.getCurrentDateContext();
        
        if (entityType === 'contact') {
            // SUGESTIE DLA OSOBY KONTAKTOWEJ - miękkie, relacyjne
            const systemPrompt = `Jesteś empatycznym doradcą relacji biznesowych.
Proponujesz subtelne, naturalne kroki do podtrzymania lub pogłębienia relacji z OSOBĄ KONTAKTOWĄ.

Twoje sugestie:
- Są naturalne i nienachalne
- Koncentrują się na budowaniu relacji, nie na sprzedaży
- Uwzględniają kontekst czasowy i okoliczności
- Są wykonalne i konkretne
- Szanują drugą osobę i jej czas

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

Zaproponuj 3 subtelne, naturalne kroki na najbliższe 7-14 dni, które pomogą podtrzymać lub pogłębić relację z tą osobą.

Każdy krok powinien:
- Być naturalny i nienachalny
- Budować relację, nie forsować sprzedaży
- Uwzględniać kontekst czasowy (święta, ważne momenty)
- Być konkretny i wykonalny

Format odpowiedzi:
1. [Pierwszy krok - subtelny i naturalny]
2. [Drugi krok - budujący relację]
3. [Trzeci krok - długoterminowy]`;

            return await this.callGemini(prompt, systemPrompt, 0.8);
            
        } else {
            // SUGESTIE DLA FIRMY - strategiczne, biznesowe
            const systemPrompt = `Jesteś strategicznym doradcą biznesowym CRM.
Proponujesz konkretne, logiczne kroki do rozwoju współpracy z FIRMĄ.

Twoje sugestie:
- Są strategiczne i biznesowe
- Koncentrują się na potencjale współpracy
- Są oparte na faktach i danych
- Uwzględniają ryzyka i szanse
- Są wykonalne i mierzalne

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

Zaproponuj 3 konkretne, strategiczne kroki na najbliższe 7-14 dni, które pomogą rozwinąć współpracę z tą firmą.

Każdy krok powinien:
- Być konkretny i mierzalny
- Mieć jasny cel biznesowy
- Uwzględniać kontekst czasowy (budżety, kwartały)
- Być logiczny i wykonalny

Format odpowiedzi:
1. [Pierwszy krok - strategiczny i konkretny]
2. [Drugi krok - biznesowy i mierzalny]
3. [Trzeci krok - długoterminowy]`;

            return await this.callGemini(prompt, systemPrompt, 0.7);
        }
    }

    /**
     * MVP Funkcja 3: Generuj draft emaila
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

        return await this.callGemini(prompt, systemPrompt, 0.8);
    }

    /**
     * Test połączenia z API
     */
    static async testConnection() {
        try {
            const response = await this.callGemini(
                'Odpowiedz jednym słowem: "działa"',
                '',
                0.1
            );
            return response.toLowerCase().includes('działa');
        } catch (error) {
            return false;
        }
    }
}
