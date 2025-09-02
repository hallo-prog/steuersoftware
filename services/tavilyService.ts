import { FundingOpportunity, UserProfile } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

// WARNUNG: Harte Kodierung von API-Schlüsseln ist unsicher und sollte nur für interne Demo/Test-Umgebungen erfolgen.
// Entfernen oder durch Umgebungsvariable ersetzen bevor der Code öffentlich geteilt oder produktiv eingesetzt wird.
// Kein Hardcode mehr: Erwartet VITE_TAVILY_API_KEY über Build Env oder Nutzer-Eingabe.
export const DEFAULT_TAVILY_API_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TAVILY_API_KEY) || '';

// Tavily API Spezifikation (vereinfachtes Modell)
// Siehe https://docs.tavily.com/ (Hinweis: Browser-CORS kann Tavily blockieren; dann Fallback nutzen)
// Request Body Felder: api_key, query, search_depth ('basic' | 'advanced'), max_results
interface TavilyRawResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}
interface TavilySearchResponse {
  results: TavilyRawResult[];
  query: string;
  answer?: string;
}

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

const profileQueryFragments = (profile: UserProfile): string[] => {
  const fragments: string[] = [];
  if (profile.companyForm) fragments.push(profile.companyForm);
  fragments.push('KMU'); // Default-Annahme
  return fragments;
};

// Einfache Normalisierung für Duplicate Detection
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

const dedupeByLinkOrTitle = (arr: FundingOpportunity[]): FundingOpportunity[] => {
  const seen = new Set<string>();
  return arr.filter(o => {
    const key = o.link ? normalize(o.link) : normalize(o.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const mapTavilyToFunding = (raw: TavilyRawResult, idx: number): FundingOpportunity => ({
  id: `tavily-${Date.now()}-${idx}`,
  title: raw.title?.trim() || 'Unbenanntes Programm',
  source: new URL(raw.url).hostname.replace(/^www\./,'') || 'Unbekannt',
  description: raw.content.slice(0, 300).replace(/\s+/g,' ').trim(),
  eligibilitySummary: 'Bitte Voraussetzungen auf der verlinkten Seite prüfen.',
  link: raw.url,
  relevanceScore: raw.score ?? undefined,
  fetchedAt: new Date().toISOString(),
  sourceUrls: [raw.url]
});

export interface CombinedSearchOptions {
  query?: string;           // Nutzer-Suchanfrage
  deep?: boolean;           // tiefere Recherche (mehr Queries)
  useGemini?: boolean;      // später für hybride Kombination
  includeEU?: boolean;      // EU-spezifische Programme ergänzen
  onProgress?: (phase: string, current: number, total: number) => void; // Fortschritt Callback
}

interface CacheEntry { ts: number; opportunities: FundingOpportunity[]; }
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 Stunden
const DB_NAME = 'funding-cache-db';
const DB_VERSION = 1;
const STORE_NAME = 'fundingCache';
const memoryFallback = new Map<string, CacheEntry>();

const cacheKey = (profile: UserProfile, query: string | undefined, deep: boolean) => {
  const base = `${profile.companyForm || 'n/a'}|${query || 'default'}|${deep?'deep':'shallow'}`;
  return 'fundingCache_v2_' + normalize(base).slice(0,180);
};

const openDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    return reject(new Error('IndexedDB nicht verfügbar'));
  }
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'key' });
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const idbGet = async (key: string): Promise<CacheEntry | null> => {
  try {
    const db = await openDB();
    return await new Promise<CacheEntry | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const r = store.get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return memoryFallback.get(key) || null;
  }
};

const idbSet = async (key: string, entry: CacheEntry): Promise<void> => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const r = store.put({ key, ...entry });
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  } catch {
    memoryFallback.set(key, entry);
  }
};

const getCache = async (key: string): Promise<FundingOpportunity[] | null> => {
  const entry = await idbGet(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.opportunities;
};

const setCache = async (key: string, opportunities: FundingOpportunity[]) => {
  const entry: CacheEntry = { ts: Date.now(), opportunities };
  await idbSet(key, entry);
};

export const tavilySearch = async (apiKey: string, query: string, maxResults = 6, depth: 'basic' | 'advanced' = 'advanced'): Promise<TavilyRawResult[]> => {
  const body = { api_key: apiKey, query, search_depth: depth, max_results: maxResults } as Record<string, unknown>;
  const resp = await fetch(TAVILY_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!resp.ok) throw new Error(`Tavily HTTP ${resp.status}`);
  const data: TavilySearchResponse = await resp.json();
  return data.results || [];
};

// Erzeuge sinnvolle Query-Varianten
const buildQueries = (profile: UserProfile, userQuery?: string, deep?: boolean, includeEU?: boolean): string[] => {
  const baseTerms = [
    'Förderprogramm KMU Deutschland',
    'Zuschuss Digitalisierung Unternehmen',
    'Förderung Investition Mittelstand',
    'Förderprogramm Innovation Forschung KMU',
  ];
  const euTerms = [
    'EU Förderung KMU Deutschland',
    'EU Programm Innovation KMU',
    'Horizon Europe KMU Förderung',
    'EU Zuschuss Nachhaltigkeit Unternehmen'
  ];
  const fragments = profileQueryFragments(profile);
  const combinedBase = baseTerms.map(t => `${t} ${fragments.join(' ')}`.trim());
  if (includeEU) {
    combinedBase.push(...euTerms.map(t => `${t}`));
  }

  if (userQuery && userQuery.trim().length > 2) {
    combinedBase.unshift(`Förderung ${userQuery} KMU Deutschland`);
    if (deep) {
      combinedBase.unshift(`Zuschuss ${userQuery} Bundesländer`);
      combinedBase.push(`Förderprogramm ${userQuery} EU Deutschland KMU`);
    }
  }

  const limit = deep ? 10 : 5;
  return combinedBase.slice(0, limit);
};

export const combinedFundingSearch = async (profile: UserProfile, tavilyApiKey: string, options: CombinedSearchOptions = {}): Promise<FundingOpportunity[]> => {
  // Fallback auf hart codierten Key (nur Demo). Priorität hat Benutzer-Key.
  if (!tavilyApiKey || tavilyApiKey.trim() === '') {
    tavilyApiKey = DEFAULT_TAVILY_API_KEY;
  }
  if (!tavilyApiKey) return [];
  const key = cacheKey(profile, options.query, !!options.deep);
  const cached = await getCache(key);
  if (cached) return cached;

  try {
  const queries = buildQueries(profile, options.query, options.deep, options.includeEU);
    const allResults: FundingOpportunity[] = [];

    const totalQueries = queries.length;
    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      options.onProgress?.('tavily:query', i + 1, totalQueries);
      try {
        const tavilyRes = await tavilySearch(tavilyApiKey, q, options.deep ? 8 : 5, options.deep ? 'advanced' : 'basic');
        tavilyRes.forEach((r, idx) => allResults.push(mapTavilyToFunding(r, idx)));
      } catch (e) {
        console.warn('Tavily Query Fehler', q, e);
      }
    }
    options.onProgress?.('tavily:merge', totalQueries, totalQueries);

    // Scoring-Anpassung: Häufigkeit der Domain / Titel-Begriffe
    const domainFreq = allResults.reduce<Record<string, number>>((acc, o) => {
      const d = o.source; acc[d] = (acc[d] || 0) + 1; return acc; }, {});
    const adjusted = allResults.map(o => ({
      ...o,
      relevanceScore: typeof o.relevanceScore === 'number' ? Math.min(1, o.relevanceScore * 0.7 + (domainFreq[o.source] || 1) * 0.05) : (domainFreq[o.source] || 1) * 0.05 + 0.4
    }));

  const deduped = dedupeByLinkOrTitle(adjusted)
      .sort((a,b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, options.deep ? 20 : 12);

  await setCache(key, deduped);
    return deduped;
  } catch (err) {
    console.error('combinedFundingSearch Fehler', err);
    return [];
  }
};

// Lokale Ähnlichkeit basierend auf Wort-Overlap (einfaches Platzhalter-Verfahren)
export const findSimilarOpportunities = (base: FundingOpportunity, others: FundingOpportunity[], limit = 5): FundingOpportunity[] => {
  const tokenize = (s: string) => (s || '').toLowerCase().split(/[^a-z0-9äöüß]+/).filter(w => w.length > 3);
  const baseTokens = new Set(tokenize(base.description + ' ' + base.title));
  return others.filter(o => o.id !== base.id).map(o => {
    const toks = tokenize(o.description + ' ' + o.title);
    let overlap = 0; toks.forEach(t => { if (baseTokens.has(t)) overlap++; });
    const score = overlap / (Math.sqrt(baseTokens.size * (toks.length || 1)) || 1);
    return { opp: o, score };
  }).sort((a,b) => b.score - a.score).slice(0, limit).map(x => x.opp);
};

// Hybrid: Nutzt Gemini zur Extraktion strukturierter Felder aus rohen Beschreibungen / verlinkten Seiten-Snippets
export const enrichWithGemini = async (apiKey: string, items: FundingOpportunity[]): Promise<FundingOpportunity[]> => {
  if (!apiKey) return items;
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-2.5-flash';
  // Batch Prompt (kompakt halten)
  const payload = items.slice(0, 12).map(o => ({ id: o.id, title: o.title, desc: o.description, eligibility: o.eligibilitySummary, url: o.link })).slice(0, 12);
  const prompt = `Analysiere folgende Förderprogramme (Deutschland). Für jedes Objekt versuche Ebene (bund / land / eu / other) zu bestimmen und falls land dann Bundeslandnamen. Komprimiere eligibility in 1 kurzen prägnanten Satz (max 140 Zeichen, Deutsch). Antworte NUR mit JSON Array, Schema: [{id, level, land, eligibilitySummary}]. Keine Erklärungen.`;
  try {
    const resp = await ai.models.generateContent({ model, contents: `${prompt}\n\nDATEN:\n${JSON.stringify(payload)}`, config: { responseMimeType: 'application/json', responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, level: { type: Type.STRING }, land: { type: Type.STRING }, eligibilitySummary: { type: Type.STRING } }, required: ['id','eligibilitySummary'] } } } });
    const text = resp.text.trim();
    let arr: any[] = [];
    try { arr = JSON.parse(text); } catch { /* fallback parse von Markdown */ const m = text.match(/```(?:json)?\n([\s\S]*?)```/); if (m) { arr = JSON.parse(m[1]); } }
    const map = new Map<string, { level?: string; land?: string; eligibilitySummary?: string }>();
    arr.forEach(o => { if (o && o.id) map.set(o.id, { level: o.level, land: o.land, eligibilitySummary: o.eligibilitySummary }); });
    return items.map(o => {
      const upd = map.get(o.id);
      if (!upd) return o;
      return { ...o, level: (['bund','land','eu','other'].includes((upd.level||'').toLowerCase())) ? upd.level.toLowerCase() as any : o.level, land: upd.land || o.land, eligibilitySummary: upd.eligibilitySummary || o.eligibilitySummary };
    });
  } catch (e) {
    console.warn('enrichWithGemini Fehler', e);
    return items;
  }
};
