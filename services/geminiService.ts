// Dynamischer Import statt statischem Import von '@google/genai' für kleineres Initial-Bundle.
// Die Bibliothek wird erst geladen, wenn wirklich ein API Key vorhanden ist und ein KI-Call erfolgt.
let GenAIModule: any | null = null;
let GoogleGenAIClass: any | null = null;
let GenAITypeEnum: any | null = null;

const ensureGenAI = async () => {
    if (!GenAIModule) {
        GenAIModule = await import('@google/genai');
        GoogleGenAIClass = GenAIModule.GoogleGenAI;
        GenAITypeEnum = GenAIModule.Type;
    }
    return { GoogleGenAI: GoogleGenAIClass, Type: GenAITypeEnum };
};
import { GeminiAnalysisResult, Document, DocumentStatus, InvoiceType, Rule, ChatMessage, UserProfile, FundingOpportunity, InsurancePolicy, Liability, Contact } from '../types';

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

    const { GoogleGenAI, Type } = await ensureGenAI();
    const model = 'gemini-2.5-flash';
    const ai = new GoogleGenAI({ apiKey });

    try {
        const imagePart = await fileToGenerativePart(file);

    const response = await ai.models.generateContent({
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

// KI Vorschlag für Steuerkategorie & Flagging
export const suggestTaxCategoryAndFlags = async (apiKey: string, doc: Document): Promise<Pick<Document,'aiSuggestedTaxCategory'|'flags'|'anomalyScore'>> => {
    if (!apiKey || !doc.textContent) return { aiSuggestedTaxCategory: undefined, flags: [], anomalyScore: undefined };
    const { GoogleGenAI, Type } = await ensureGenAI();
    const model = 'gemini-2.5-flash';
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analysiere den folgenden extrahierten Rechnungstext und schlage eine plausible deutsche Steuer-/Buchungskategorie vor (z.B. Material/Waren, Bürobedarf, Kraftstoff, Bewirtungskosten, Reisekosten, Photovoltaik, Einnahmen, Sonstiges). Kennzeichne Anomalien (ungewöhnlich hoher Betrag > 5.000 EUR, fehlende Rechnungsnummer, Datum in Zukunft, sehr wenig Text) und gib eine Anomalie-Skala 0-1.

Format STRICT JSON:
{"category":"...","flags":["..."],"anomalyScore":0.x}

TEXT:
${doc.textContent.slice(0,8000)}
`; 
    try {
        const res = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: 'application/json' } });
        const jsonStr = res.text.trim();
        const data = JSON.parse(jsonStr);
        return { aiSuggestedTaxCategory: data.category, flags: data.flags||[], anomalyScore: data.anomalyScore };
    } catch {
        return { aiSuggestedTaxCategory: undefined, flags: ['KI_FEHLER'], anomalyScore: undefined };
    }
};

// Batch Zusammenfassung für Dashboard (z.B. Ausgabencluster)
export const summarizeDocumentsFinancially = async (apiKey: string, docs: Document[]): Promise<string> => {
    if (!apiKey) return 'Kein API Key.';
    const { GoogleGenAI } = await ensureGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    const sample = docs.slice(0,40).map(d => `Name:${d.name}; Betrag:${d.totalAmount ?? 'k.A.'}; Kat:${d.taxCategory||d.aiSuggestedTaxCategory||'k.A.'}`).join('\n');
    const prompt = `Erstelle eine kurze strukturierte Zusammenfassung (Deutsch) über die Finanzbelege (max 5 Bulletpoints): Trends, größte Kostenblöcke, potentielle Optimierungen. Dann 1 Satz Empfehlung.
Belege:\n${sample}`;
    try { const res = await ai.models.generateContent({ model, contents: prompt }); return res.text.trim(); } catch { return 'Zusammenfassung fehlgeschlagen.'; }
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

// New function for the Chat Panel
export const getChatResponse = async (apiKey: string, history: ChatMessage[], documents: Document[], rules: Rule[], userProfile: UserProfile, userMessage: string, systemPrompt: string): Promise<string> => {
    if (!apiKey) {
        return "Bitte geben Sie zuerst einen gültigen API-Schlüssel in den Einstellungen ein.";
    }

    const { GoogleGenAI } = await ensureGenAI();
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

    const response = await chat.sendMessage({ message: userMessage });
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

    const { GoogleGenAI } = await ensureGenAI();
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

// Liefert eine individuelle Kurz-Analyse einer Förderung für das gegebene Unternehmensprofil
export const summarizeFundingForProfile = async (apiKey: string, opportunity: FundingOpportunity, profile: UserProfile): Promise<string> => {
    if (!apiKey) return 'Kein API Key vorhanden.';
    const { GoogleGenAI } = await ensureGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    const prompt = `Du bist ein Fördermittel-Experte. Analysiere das folgende Förderprogramm für das Unternehmen.

Unternehmensprofil:
- Branche: ${profile.industry || 'unbekannt'}
- Mitarbeiter: ${profile.employees ?? 'unbekannt'}
- Bundesland: ${profile.locationState || 'unbekannt'}
- Gründungsjahr: ${profile.foundingYear || 'unbekannt'}

Förderprogramm:
Titel: ${opportunity.title}
Quelle: ${opportunity.source}
Beschreibung: ${opportunity.description}
Voraussetzungen: ${opportunity.eligibilitySummary}
Anforderungen: ${(opportunity.requires||[]).join(', ')}
Förderquote: ${opportunity.coverageRatePercent ?? 'k.A.'}%
Min/Max Zuschuss: ${opportunity.grantAmountMin ?? 'k.A.'} - ${opportunity.grantAmountMax ?? 'k.A.'}
Gültigkeit bis: ${opportunity.validTo || 'k.A.'}

Aufgabe:
1. Bewerte die Relevanz (hoch/mittel/niedrig) für das Unternehmen (max 1 Wort).
2. Liste in bis zu 4 Bulletpoints: Hauptvorteile / Chancen.
3. Liste in bis zu 3 Bulletpoints: Kritische Anforderungen / Risiken.
4. Gib eine empfohlene nächste Aktion (1 Satz) an.

Format STRICT:
Relevanz: <hoch|mittel|niedrig>
Vorteile:
- …
- …
Risiken:
- …
- …
Aktion: …
`;
    try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        return response.text.trim();
    } catch (e) {
        return 'Analyse fehlgeschlagen.';
    }
};

// Versicherungspolice aus Text / OCR extrahieren
export interface InsuranceExtractionResult {
    name: string;
    insurer?: string;
    policyNumber?: string;
    startDate?: string;
    endDate?: string;
    paymentInterval?: string;
    premiumAmount?: number;
    coverageSummary?: string;
    coverageItems?: string[];
    exclusions?: string[];
    contactEmail?: string;
    contactPhone?: string;
    type?: string;
}

export const extractInsurancePolicyFromFiles = async (apiKey: string, files: File[]): Promise<InsuranceExtractionResult> => {
    if (!files.length) throw new Error('Keine Dateien übergeben');
    if (!apiKey) {
        // Mock
        return {
            name: files[0].name.replace(/\.[a-zA-Z0-9]+$/,'')||'Police',
            insurer: 'Muster Versicherung AG',
            policyNumber: 'POL-'+Math.floor(Math.random()*100000),
            startDate: new Date().toISOString(),
            paymentInterval: 'jährlich',
            premiumAmount: 1200,
            coverageSummary: 'Haftpflichtdeckung für Betrieb mit erweiterten Sach- und Vermögensschäden.',
            coverageItems: ['Sachschäden','Personenschäden','Vermögensschäden'],
            exclusions: ['Vorsatz','Kernenergie'],
            type: 'Betriebshaftpflicht'
        };
    }
    const { GoogleGenAI } = await ensureGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    const parts: any[] = [];
    for (const f of files.slice(0,4)) { // Limit für Promptgröße
        parts.push(await fileToGenerativePart(f));
    }
    parts.push({ text: `Extrahiere strukturierte Daten einer deutschen Versicherungspolice. Gib STRICT JSON zurück:
{
    "name":"Freier Name oder Tarif",
    "insurer":"Versicherer",
    "policyNumber":"…",
    "startDate":"YYYY-MM-DD"?,
    "endDate":"YYYY-MM-DD"?,
    "paymentInterval":"monatlich|quartal|jährlich"?,
    "premiumAmount":NUMBER?,
    "coverageSummary":"Kurzbeschreibung",
    "coverageItems":["..."],
    "exclusions":["..."],
    "contactEmail":"..."?,
    "contactPhone":"..."?,
    "type":"Betriebshaftpflicht|Hausrat|Private Rechtsschutz|Betriebliche Rechtsschutz|KFZ|Sonstige"
}
Keine Erklärungen.` });
    try {
        const response = await ai.models.generateContent({ model, contents: { parts }, config: { responseMimeType: 'application/json' }});
        const txt = response.text.trim();
        return JSON.parse(txt);
    } catch (e) {
        throw new Error(handleGeminiError(e));
    }
};

export interface ClaimAIResult { summary: string; recommendation: string; riskLevel?: 'niedrig'|'mittel'|'hoch'; }

export const summarizeInsuranceClaim = async (apiKey: string, claim: { title: string; description?: string; type: string }, relatedDocs: Document[]): Promise<ClaimAIResult> => {
    if (!apiKey) {
        return { summary: `Fall: ${claim.title}. (Demo-Zusammenfassung)`, recommendation: 'Bitte API-Key setzen um echte KI-Auswertung zu erhalten.', riskLevel: 'mittel' };
    }
    const { GoogleGenAI } = await ensureGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    const docsContext = relatedDocs.slice(0,12).map(d => `Dok: ${d.name}; Betrag:${d.totalAmount??'k.A.'}; Datum:${d.date.toISOString().split('T')[0]}; Vendor:${d.vendor||''}`).join('\n');
    const prompt = `Erstelle eine prägnante Zusammenfassung und Handlungsempfehlung für einen Versicherungsfall.
Falltyp: ${claim.type}
Titel: ${claim.title}
Beschreibung: ${claim.description||'keine'}
Relevante Belege:
${docsContext||'keine'}
Liefere STRICT JSON:
{"summary":"...","recommendation":"...","riskLevel":"niedrig|mittel|hoch"}`;
    try {
        const res = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: 'application/json' }});
        const data = JSON.parse(res.text.trim());
        return data;
    } catch (e) {
        return { summary: 'KI Zusammenfassung fehlgeschlagen.', recommendation: handleGeminiError(e), riskLevel: 'mittel' };
    }
};

// Embedding Helper (Mock / Real)
export const embedTexts = async (apiKey: string, texts: string[]): Promise<number[][]> => {
    if (!apiKey) {
        return texts.map(t => [t.length % 1, (t.length%7)/7, (t.length%13)/13]);
    }
    const { GoogleGenAI } = await ensureGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'text-embedding-004';
    // (Pseudo Implementation – falls API nicht verfügbar, fallback)
    try {
        const vectors: number[][] = [];
        for (const chunk of texts) {
            // Hier ggf. echte Embedding API aufrufen – Platzhalter:
            vectors.push([chunk.length/1000, (chunk.match(/\d/g)||[]).length/50, (chunk.match(/[A-Z]/g)||[]).length/80]);
        }
        return vectors;
    } catch {
        return texts.map(t => [t.length/1000]);
    }
};

export const semanticSearchDocuments = async (apiKey: string, query: string, docs: Document[], topN = 10): Promise<Document[]> => {
    if (!docs.length) return [];
    const corpus = docs.filter(d => d.textContent);
    if (!corpus.length) return [];
    const [qVec] = await embedTexts(apiKey, [query]);
    const docVecs = await embedTexts(apiKey, corpus.map(d=>d.textContent!.slice(0,4000)));
    const scored = corpus.map((d,i) => ({ d, score: cosineSim(qVec, docVecs[i]) }));
    scored.sort((a,b)=> b.score - a.score);
    return scored.slice(0, topN).map(x=>x.d);
};

const cosineSim = (a:number[], b:number[]) => {
    const len = Math.min(a.length,b.length); let dot=0, na=0, nb=0; for (let i=0;i<len;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; } return dot/((Math.sqrt(na)||1)*(Math.sqrt(nb)||1));
};

export interface PolicyRiskResult { riskScore:number; riskGaps:string[]; recommendation:string; }

export const assessPolicyRisk = async (apiKey:string, policy: InsurancePolicy, allPolicies: InsurancePolicy[]): Promise<PolicyRiskResult> => {
    if (!apiKey) return { riskScore: 0.5, riskGaps: ['API_KEY_FEHLT'], recommendation: 'Bitte API-Key setzen um echte Risikoanalyse zu erhalten.' };
    const { GoogleGenAI } = await ensureGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    const peerStats = allPolicies.filter(p=>p.id!==policy.id).map(p=> `${p.type||'Sonstige'}:${p.coverageItems?.length||0}:${p.exclusions?.length||0}`).join('\n');
    const prompt = `Analysiere das Risiko einer Versicherungspolice im Kontext anderer Policen.
POLICE:
Name:${policy.name}
Typ:${policy.type}
Insurer:${policy.insurer}
Coverage Items:${(policy.coverageItems||[]).join(', ')}
Exclusions:${(policy.exclusions||[]).join(', ')}
Coverage Summary:${policy.coverageSummary||''}
Peer Stats (Typ:CoverageCount:ExclusionCount):\n${peerStats||'keine'}
Liefere STRICT JSON:
{"riskScore":0.x,"riskGaps":["..."],"recommendation":"..."}`;
    try {
        const res = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: 'application/json' }});
        const data = JSON.parse(res.text.trim());
        return data;
    } catch {
        return { riskScore: 0.5, riskGaps: ['ANALYSE_FEHLER'], recommendation: 'Analyse fehlgeschlagen.' };
    }
};

// ---------------- Liabilities KI Analyse ---------------------------------
export interface LiabilityAIResult { summary:string; recommendation:string; riskScore:number; keyFigures?: { dscr?: number; monthlyBurden?: number }; }

export const analyzeLiability = async (apiKey:string, liability: Liability, relatedDocs: Document[]): Promise<LiabilityAIResult> => {
    if (!apiKey) return { summary: `Verbindlichkeit ${liability.name} (Demo).`, recommendation: 'API Key setzen für echte Analyse.', riskScore: 0.5 };
    const { GoogleGenAI } = await ensureGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    const docsContext = relatedDocs.slice(0,10).map(d=> `Doc:${d.name}; Betrag:${d.totalAmount??'k.A.'}; Datum:${d.date.toISOString().split('T')[0]}`).join('\n');
    const prompt = `Analysiere eine Unternehmens-Verbindlichkeit und gib strukturierte Kennzahlen + Risiko.
Name:${liability.name}
Kategorie:${liability.category||''}
Gläubiger:${liability.creditor||''}
Offen:${liability.outstandingAmount??'k.A.'}
Ursprünglich:${liability.originalAmount??'k.A.'}
Zins:${liability.interestRatePercent??'k.A.'}
Laufzeit:${liability.startDate||''} - ${liability.endDate||''}
Intervall:${liability.paymentInterval||''}
Notizen:${liability.notes||''}
Relevante Belege:\n${docsContext||'keine'}
STRICT JSON: {"summary":"...","recommendation":"...","riskScore":0.x,"keyFigures":{"dscr":0.x?,"monthlyBurden":NUMBER?}}`;
    try {
        const res = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType:'application/json' }});
        const data = JSON.parse(res.text.trim());
        return data;
    } catch { return { summary:'Analyse fehlgeschlagen.', recommendation:'Bitte erneut versuchen.', riskScore:0.5 }; }
};

// ---------------- Kontakte Extraktion ------------------------------------
export const extractContactsFromText = async (apiKey:string, texts: string[]): Promise<Contact[]> => {
    if (!texts.length) return [];
    if (!apiKey) {
        return [{ id:'mock-vendor', name:'Bauhaus', type:'Vendor', email: undefined, phone: undefined } as Contact];
    }
    const { GoogleGenAI } = await ensureGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    const sample = texts.slice(0,6).join('\n---\n').slice(0,16000);
    const prompt = `Extrahiere Kontaktinformationen (Firma oder Ansprechpartner) aus deutschem Quelltext. Gib STRICT JSON Array zurück.
Schema Element: {"id":"string slug oder hash","name":"String","type":"Gläubiger|Versicherung|Vendor|Sonstige","email":"?","phone":"?"}
TEXT:
${sample}`;
    try { const res = await ai.models.generateContent({ model, contents: prompt, config:{ responseMimeType:'application/json' }}); return JSON.parse(res.text.trim()); } catch { return []; }
};

// ---------------- E-Mail Vorlage / Erstellung ----------------------------
export interface EmailTemplateInput { template: 'ratenzahlung'|'zahlungspause'; params: Record<string,string|number>; liability?: Liability; }
export interface EmailDraft { subject:string; body:string; };

export const createEmailFromTemplate = async (apiKey:string, input: EmailTemplateInput): Promise<EmailDraft> => {
    const { template, params, liability } = input;
    if (!apiKey) {
        return { subject: 'Anfrage '+template, body: `Demo E-Mail (${template}) für ${liability?.creditor||'Gläubiger'}.` };
    }
    const { GoogleGenAI } = await ensureGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    const prompt = `Erstelle eine professionelle, höfliche deutsche E-Mail.
Template:${template}
Parameter:${JSON.stringify(params)}
Liability:${JSON.stringify(liability||{})}
Anforderungen:
- Kurzer Betreff.
- Im Body: Ausgangssituation, gewünschte Maßnahme, Begründung (Liquidität/temporäre Belastung), freundlicher Abschluss.
- Signatur generisch.
STRICT JSON: {"subject":"...","body":"..."}`;
    try { const res = await ai.models.generateContent({ model, contents: prompt, config:{ responseMimeType:'application/json' }}); return JSON.parse(res.text.trim()); } catch { return { subject:'Anfrage', body:'Fehler beim Generieren.' }; }
};