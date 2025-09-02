// Schema Zusammenfassung (KI oder Heuristik Fallback)
import { ColumnMeta } from './tableMetadataService';

// Dynamischer Import wie in geminiService
let GenAIModule: any | null = null;
let GoogleGenAIClass: any | null = null;

const ensureGenAI = async () => {
  if (!GenAIModule) {
    GenAIModule = await import('@google/genai');
    GoogleGenAIClass = GenAIModule.GoogleGenAI;
  }
  return { GoogleGenAI: GoogleGenAIClass };
};

export interface SchemaSummaryResult { summary: string; fromAI: boolean; }

export const summarizeTableSchema = async (apiKey: string | undefined, table: string, columns: ColumnMeta[]): Promise<SchemaSummaryResult> => {
  if (!columns.length) return { summary: 'Keine Spalten verfügbar.', fromAI: false };
  const heuristic = () => {
    const groups: Record<string,string[]> = {};
    columns.forEach(c => { groups[c.type] = groups[c.type] || []; groups[c.type].push(c.name + (c.nullable?'?':'')); });
    const lines = Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).map(([t, cols]) => `- ${t}: ${cols.join(', ')}`);
    return `Tabelle ${table}: ${columns.length} Spalten.\n${lines.join('\n')}`;
  };
  if (!apiKey) {
    return { summary: heuristic() + '\n(Hinweis: KI Key fehlt – Heuristik verwendet.)', fromAI: false };
  }
  try {
    const { GoogleGenAI } = await ensureGenAI();
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    const colDesc = columns.map(c => `${c.name}:${c.type}${c.nullable?'?':''}`).join(', ');
    const prompt = `Erstelle eine prägnante, deutschsprachige Zusammenfassung des Tabellen-Schemas. Tabelle: ${table}. Spalten: ${colDesc}.\nStrukturiere in: Zweck (vermutet), Schlüssel-/Referenzfelder, Wichtige Metriken/Felder, Qualität/Anomalierisiken, Vorschläge für Indizes oder Normalisierung (max 1 Satz). Max 6 Bulletpoints.`;
    const res = await ai.models.generateContent({ model, contents: prompt });
    return { summary: res.text.trim(), fromAI: true };
  } catch (e:any) {
    return { summary: heuristic() + `\n(KI Fehler: ${e.message||e})`, fromAI: false };
  }
};
