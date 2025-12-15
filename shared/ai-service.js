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
                `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${this.API_KEY}`,
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
     * MVP Funkcja 1: Podsumuj historię firmy
     */
    static async summarizeCompany(company, history, contacts, activities) {
        const systemPrompt = `Jesteś asystentem CRM. Twoim zadaniem jest zwięzłe podsumowanie historii współpracy z firmą.
Odpowiadaj TYLKO po polsku. Bądź konkretny i profesjonalny.`;

        // Przygotuj dane (anonimizowane)
        const companyInfo = `Nazwa: ${company.name}
Branża: ${company.industry || 'brak'}
Liczba kontaktów: ${contacts.length}
Liczba aktywności: ${activities.length}`;

        const recentHistory = history
            .filter(h => h.type === 'note')
            .slice(0, 5)
            .map(h => `- ${this.anonymize(h.content)}`)
            .join('\n');

        const recentActivities = activities
            .slice(0, 5)
            .map(a => `- ${a.type}: ${this.anonymize(a.title)}`)
            .join('\n');

        const prompt = `Podsumuj historię współpracy z tą firmą:

${companyInfo}

Ostatnie notatki:
${recentHistory || 'Brak notatek'}

Ostatnie aktywności:
${recentActivities || 'Brak aktywności'}

Napisz krótkie podsumowanie (3-4 zdania) zawierające:
1. Główny obszar współpracy
2. Status relacji
3. Kluczowe informacje`;

        return await this.callGemini(prompt, systemPrompt);
    }

    /**
     * MVP Funkcja 2: Zaproponuj następne kroki
     */
    static async suggestNextSteps(company, history, activities) {
        const systemPrompt = `Jesteś doświadczonym menedżerem sprzedaży. Proponujesz konkretne, wykonalne kroki.
Odpowiadaj TYLKO po polsku. Format: numerowana lista.`;

        const lastActivity = activities[0];
        const lastActivityInfo = lastActivity 
            ? `Ostatnia aktywność: ${lastActivity.type} - "${this.anonymize(lastActivity.title)}" (${new Date(lastActivity.date).toLocaleDateString('pl-PL')})`
            : 'Brak ostatniej aktywności';

        const recentNotes = history
            .filter(h => h.type === 'note')
            .slice(0, 3)
            .map(h => this.anonymize(h.content))
            .join('\n');

        const prompt = `Firma: ${company.name}
Branża: ${company.industry || 'brak'}

${lastActivityInfo}

Ostatnie notatki:
${recentNotes || 'Brak notatek'}

Zaproponuj 3 konkretne kroki na najbliższe 7 dni, które pomogą rozwijać relację z tą firmą.
Każdy krok powinien być konkretny i wykonalny.

Format odpowiedzi:
1. [Krok pierwszy]
2. [Krok drugi]
3. [Krok trzeci]`;

        return await this.callGemini(prompt, systemPrompt);
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
