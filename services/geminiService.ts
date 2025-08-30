import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { GeminiAnalysisResult, Document, DocumentStatus, InvoiceType, Rule, ChatMessage, UserProfile, FundingOpportunity } from '../types';

const handleGeminiError = (error: unknown): string => {
    console.error("Gemini API Error:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
            return "Ihr Gemini API-Schlüssel ist ungültig. Bitte überprüfen Sie ihn in den Einstellungen.";
        }
        if (error.message.includes('429')) { // Too Many Requests
            return "Das API-Anfragelimit wurde erreicht. Bitte versuchen Sie es später erneut.";
        }
        if (typeof error === 'object' && error && 'message' in error) {
            const message = (error as { message: string }).message;
            if (message.includes('SAFETY')) {
                return "Die Anfrage wurde aufgrund von Sicherheitseinstellungen blockiert. Versuchen Sie eine andere Formulierung.";
            }
        }
    }
    return "Ein unerwarteter Fehler ist bei der Kommunikation mit der KI aufgetreten. Bitte versuchen Sie es später erneut.";
};

const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

export const createSuggestedFileName = (result: GeminiAnalysisResult, originalExtension: string): string => {
    const { vendor, totalAmount, documentDate } = result;
    const date = new Date(documentDate);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const formattedAmount = (totalAmount ?? 0).toFixed(2).replace('.', ',');
    const cleanVendor = (vendor || 'unbekannt').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'unbekannt';

    return `re_${cleanVendor}_${formattedAmount}€_${month}_${year}.${originalExtension}`;
};

// Applies rules created by the user in the UI.
const applyRules = (result: GeminiAnalysisResult, rules: Rule[]): GeminiAnalysisResult => {
    const textLower = result.textContent.toLowerCase();
    const vendorLower = (result.vendor || "").toLowerCase();
    
    for (const rule of rules) {
        const targetText = rule.conditionType === 'vendor' ? vendorLower : textLower;
        const keywords = rule.conditionValue.split(',').map(k => k.trim().toLowerCase()).filter(Boolean); // Handle multiple keywords with OR logic

        if (keywords.some(keyword => targetText.includes(keyword))) {
            result.invoiceType = rule.invoiceType;
            result.taxCategory = rule.resultCategory;
            return result; // First matching user rule wins
        }
    }
    return result;
};


export const analyzeDocument = async (file: File, rules: Rule[], apiKey: string): Promise<GeminiAnalysisResult> => {
    if (!apiKey) {
        console.warn("API key not found. Using a mock response for document analysis.");
        await new Promise(resolve => setTimeout(resolve, 1500));
        const randomAmount = Math.random() * 200 + 10;
        let mockResult: GeminiAnalysisResult = {
            isInvoice: !file.name.toLowerCase().includes('bestätigung'),
            isOrderConfirmation: file.name.toLowerCase().includes('bestätigung'),
            isEmailBody: file.name.toLowerCase().includes('email'),
            documentDate: new Date().toISOString(),
            textContent: `Dies ist ein simulierter OCR-Text für die Datei ${file.name}.\nRechnungsnummer: 12345\nBetrag: ${randomAmount.toFixed(2)} EUR\nDatum: ${new Date().toLocaleDateString('de-DE')}\nFirma: ${file.name.toLowerCase().includes('zoe') ? 'ZOE Solar' : 'Bauhaus' }`,
            vendor: file.name.toLowerCase().includes('zoe') ? 'ZOE Solar' : 'Bauhaus',
            totalAmount: randomAmount,
            vatAmount: file.name.toLowerCase().includes('zoe') ? 0 : randomAmount * 0.19,
            invoiceNumber: `RE-${Math.floor(Math.random() * 100000)}`,
            invoiceType: InvoiceType.INCOMING,
            taxCategory: 'Sonstiges',
        };
        return applyRules(mockResult, rules);
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';

    try {
        const imagePart = await fileToGenerativePart(file);

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    imagePart,
                    { text: `Analysiere das Dokument sorgfältig. Führe eine OCR durch, um den gesamten Text zu extrahieren. Identifiziere Rechnungsdatum, Rechnungsnummer, Verkäufer, Bruttobetrag und MwSt.-Betrag. Klassifiziere als Eingangsrechnung (Ausgabe) oder Ausgangsrechnung (Einnahme). Basierend auf dem Verkäufer und dem Inhalt, schlage eine passende Steuerkategorie vor. Beispiele: 'Material/Waren' für Baumärkte, 'Kraftstoff' für Tankstellen, 'Photovoltaik' für Solaranlagen ohne MwSt., 'Einnahmen' für Rechnungen mit MwSt. von Energieunternehmen. Nutze 'Sonstiges' nur, wenn keine spezifischere Kategorie passt. Gib ausschließlich das JSON-Objekt zurück.` }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isInvoice: { type: Type.BOOLEAN },
                        isOrderConfirmation: { type: Type.BOOLEAN },
                        isEmailBody: { type: Type.BOOLEAN },
                        documentDate: { type: Type.STRING },
                        textContent: { type: Type.STRING },
                        vendor: { type: Type.STRING },
                        totalAmount: { type: Type.NUMBER },
                        vatAmount: { type: Type.NUMBER },
                        invoiceNumber: { type: Type.STRING },
                        invoiceType: { type: Type.STRING, enum: [InvoiceType.INCOMING, InvoiceType.OUTGOING] },
                        taxCategory: { type: Type.STRING }
                    },
                    required: ["isInvoice", "isOrderConfirmation", "isEmailBody", "documentDate", "textContent", "vendor", "totalAmount", "vatAmount", "invoiceNumber", "invoiceType", "taxCategory"],
                },
            },
        });
        
        const jsonStr = response.text.trim();
        const rawResult: GeminiAnalysisResult = JSON.parse(jsonStr);
        
        const finalResult = applyRules(rawResult, rules);

        if (!finalResult.invoiceType) finalResult.invoiceType = InvoiceType.INCOMING;
        if (!finalResult.taxCategory || finalResult.taxCategory === '') finalResult.taxCategory = 'Sonstiges';

        return finalResult;
    } catch (error) {
        throw new Error(handleGeminiError(error));
    }
};

export const getDocumentStatusFromAnalysis = (analysis: GeminiAnalysisResult, existingDocuments: Document[] = []): DocumentStatus => {
    const analysisDate = new Date(analysis.documentDate).toDateString();
    
    for (const doc of existingDocuments) {
        if (analysis.invoiceNumber && doc.invoiceNumber && analysis.invoiceNumber.trim().length > 2 &&
            analysis.invoiceNumber.trim().toLowerCase() === doc.invoiceNumber.trim().toLowerCase()) {
            return DocumentStatus.POTENTIAL_DUPLICATE;
        }
        
        const docDate = doc.date.toDateString();
        if (doc.totalAmount && analysis.totalAmount &&
            doc.totalAmount.toFixed(2) === analysis.totalAmount.toFixed(2) &&
            docDate === analysisDate) {
            return DocumentStatus.POTENTIAL_DUPLICATE;
        }
    }

    if (analysis.isOrderConfirmation && !analysis.isInvoice) return DocumentStatus.MISSING_INVOICE;
    if (analysis.isEmailBody && !analysis.isInvoice) return DocumentStatus.SCREENSHOT;
    return DocumentStatus.OK;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

// New function for the Chat Panel
export const getChatResponse = async (apiKey: string, history: ChatMessage[], documents: Document[], rules: Rule[], userProfile: UserProfile, userMessage: string, systemPrompt: string): Promise<string> => {
    if (!apiKey) {
        return "Bitte geben Sie zuerst einen gültigen API-Schlüssel in den Einstellungen ein.";
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Create a comprehensive context from all available data
    const financialSummary = documents.reduce((acc, doc) => {
        if(doc.invoiceType === InvoiceType.INCOMING) {
            acc.expenses += doc.totalAmount || 0;
            acc.vatReclaim += doc.vatAmount || 0;
        } else {
            acc.revenue += doc.totalAmount || 0;
            acc.vatDue += doc.vatAmount || 0;
        }
        return acc;
    }, { revenue: 0, expenses: 0, vatDue: 0, vatReclaim: 0 });

    const financialSummaryContext = `
- Gesamteinnahmen: ${formatCurrency(financialSummary.revenue)}
- Gesamtausgaben: ${formatCurrency(financialSummary.expenses)}
- Abzuführende USt.: ${formatCurrency(financialSummary.vatDue)} (Einnahmen)
- Erstattungsfähige Vorsteuer: ${formatCurrency(financialSummary.vatReclaim)} (Ausgaben)
- Steuerbilanz: ${formatCurrency(financialSummary.vatReclaim - financialSummary.vatDue)}
    `.trim();

    const documentContext = documents.map(d => 
        `- ID: ${d.id}, Name: ${d.name}, Verkäufer: ${d.vendor || 'N/A'}, Betrag: ${d.totalAmount?.toFixed(2) || 'N/A'}€, Datum: ${d.date.toLocaleDateString('de-DE')}, Kategorie: ${d.taxCategory || 'N/A'}`
    ).join('\n');
    
    const rulesContext = rules.map(r => 
        `- WENN ${r.conditionType === 'vendor' ? 'Verkäufer' : 'Textinhalt'} "${r.conditionValue}" enthält, DANN Typ: ${r.invoiceType} & Kategorie: ${r.resultCategory}`
    ).join('\n');

    const userProfileContext = `
- Name: ${userProfile.name || 'Nicht angegeben'}
- Steuer-ID: ${userProfile.taxId || 'Nicht angegeben'}
- USt-IdNr.: ${userProfile.vatId || 'Nicht angegeben'}
- Steuernummer: ${userProfile.taxNumber || 'Nicht angegeben'}
- Unternehmensform: ${userProfile.companyForm || 'Nicht angegeben'}
    `.trim();

    const systemInstruction = `${systemPrompt}
    ---
    AKTUELLE DATEN AUS DER ANWENDUNG:

    BENUTZERPROFIL:
    ${userProfileContext}

    FINANZÜBERSICHT:
    ${financialSummaryContext}

    AUTOMATISIERUNGS-REGELN:
    ${rulesContext}

    VERFÜGBARE DOKUMENTE:
    ${documentContext || 'Keine Dokumente vorhanden.'}
    ---
    `;

    const model = 'gemini-2.5-flash';
    
    try {
        const chat = ai.chats.create({
            model,
            config: { systemInstruction },
            history: history.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.rawContent || msg.content }] // Use rawContent to ensure clean history
            })),
        });

        const response: GenerateContentResponse = await chat.sendMessage({ message: userMessage });
        return response.text;
    } catch (error) {
        return handleGeminiError(error);
    }
};

export const findFundingOpportunities = async (apiKey: string, userProfile: UserProfile): Promise<FundingOpportunity[]> => {
     if (!apiKey) {
        console.warn("API key not found. Using mock data for funding opportunities.");
        await new Promise(resolve => setTimeout(resolve, 1500));
        return [
            { id: 'mock-1', title: 'Digital Jetzt – Investitionsförderung für KMU', source: 'BMWK', description: 'Zuschüsse für Investitionen in digitale Technologien sowie in die Qualifizierung der Mitarbeitenden.', eligibilitySummary: 'KMU, 3-499 Mitarbeiter, Investitionsplan erforderlich.', link: 'https://www.bmwk.de/Redaktion/DE/Artikel/Digitale-Welt/digital-jetzt.html' },
            { id: 'mock-2', title: 'KfW-Kredit für Wachstum', source: 'KfW Bankengruppe', description: 'Zinsgünstige Kredite für etablierte mittelständische Unternehmen zur Finanzierung von größeren Vorhaben.', eligibilitySummary: 'Mind. 5 Jahre am Markt, Gruppenumsatz bis 2 Mrd. Euro.', link: 'https://www.kfw.de/inlandsfoerderung/Unternehmen/Erweitern-Festigen/F%C3%B6rderprodukte/KfW-Kredit-f%C3%BCr-Wachstum-(291)/' },
            { id: 'mock-3', title: 'Eingliederungszuschuss (EGZ)', source: 'Bundesagentur für Arbeit', description: 'Zuschuss zum Arbeitsentgelt für die Einstellung von Arbeitnehmer/innen mit Vermittlungshemmnissen.', eligibilitySummary: 'Einstellung von förderungsbedürftigen Personen (z.B. Langzeitarbeitslose).', link: 'https://www.arbeitsagentur.de/unternehmen/finanziell/foerderung-von-arbeitsverhaeltnissen' },
        ];
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    
    const prompt = `
        Du bist ein Experte für deutsche Fördermittel für Unternehmen.
        Basierend auf dem folgenden Unternehmensprofil, führe eine Websuche durch und finde relevante, aktuelle Förderprogramme, Zuschüsse und Kredite in Deutschland.

        Unternehmensprofil:
        - Unternehmensform: ${userProfile.companyForm || 'Nicht angegeben'}
        - Standort: Deutschland (bundesweit)

        Deine Aufgabe:
        1. Finde 5 bis 8 passende Förderprogramme.
        2. Gib für jedes Programm an: Titel, die vergebende Stelle (z.B. KfW, BAFA), eine kurze Beschreibung (ein Satz), eine Zusammenfassung der wichtigsten Voraussetzungen und einen direkten, gültigen Link zur offiziellen Programm-Website.
        3. SEHR WICHTIG: Antworte AUSSCHLIESSLICH mit einem validen JSON-Array-String. Füge keinen einleitenden Text, keine Erklärungen und keine Markdown-Formatierung um das JSON herum hinzu.

        Das JSON-Schema für jedes Objekt im Array muss wie folgt aussehen:
        {
          "id": "eine-eindeutige-id-die-du-generierst",
          "title": "Programmtitel",
          "source": "Vergebende Stelle",
          "description": "Kurze Beschreibung",
          "eligibilitySummary": "Zusammenfassung der Voraussetzungen",
          "link": "https://offizielle-programm-url.de"
        }
    `;

    try {
        const response = await ai.models.generateContent({
           model: model,
           contents: prompt,
           config: {
             tools: [{googleSearch: {}}],
           },
        });

        const jsonStr = response.text.trim();
        // Versuch, das JSON zu parsen, auch wenn es von Markdown umschlossen ist
        const jsonMatch = jsonStr.match(/```json\n([\s\S]*?)\n```/);
        const cleanJsonStr = jsonMatch ? jsonMatch[1] : jsonStr;

        const results: FundingOpportunity[] = JSON.parse(cleanJsonStr);
        return results;

    } catch (error) {
        throw new Error(handleGeminiError(error));
    }
};