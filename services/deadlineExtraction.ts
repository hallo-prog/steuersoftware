// Heuristische Frist-Erkennung aus deutschem OCR-Text
// Technologie-frei, reine Regex + einfache Logik.

export interface ExtractedDeadline {
  type: 'payment' | 'appeal' | 'other';
  date: string; // ISO YYYY-MM-DD
  confidence: number; // 0-1
  phrase: string; // Original gefundener Ausschnitt
}

const DATE_REGEX = /(\b\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}\b)/g; // dd.mm.yyyy Varianten
// Schlüsselphrasen mit Prioritäten & Typ-Mapping
const KEY_PATTERNS: Array<{ re: RegExp; type: ExtractedDeadline['type']; weight: number }> = [
  { re: /(zahlbar bis|zahlung bis|zahlungsfrist|fällig(?:keit)?(?: am)?|spätestens bis)/i, type: 'payment', weight: 0.9 },
  { re: /(einspruch\s*frist|widerspruch\s*frist|einspruch bis|widerspruch bis)/i, type: 'appeal', weight: 0.85 },
];

// Normalisiert dd.mm.yyyy / dd.mm.yy etc. in ISO (heuristisch, yy >= 70 => 1900er, sonst 2000er)
const normalizeDate = (raw: string): string | null => {
  const parts = raw.replace(/\//g,'.').replace(/-/g,'.').split('.');
  if (parts.length < 3) return null;
  let [d,m,y] = parts.map(p=>p.trim());
  const di = parseInt(d,10), mi=parseInt(m,10); let yi = parseInt(y,10);
  if (y.length === 2) yi = yi >= 70 ? (1900+yi) : (2000+yi);
  if (isNaN(di)||isNaN(mi)||isNaN(yi)) return null;
  if (di<1||di>31||mi<1||mi>12||yi<1970||yi>2100) return null;
  const iso = new Date(Date.UTC(yi, mi-1, di));
  if (isNaN(iso.getTime())) return null;
  return iso.toISOString().split('T')[0];
};

export const extractDeadlinesFromText = (text: string, today: Date = new Date()): ExtractedDeadline[] => {
  if (!text) return [];
  const results: ExtractedDeadline[] = [];
  const windowRadius = 60; // Zeichen Kontextfenster
  // Sammle alle Datums-Vorkommen
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  const lowered = text.toLowerCase();
  while ((match = DATE_REGEX.exec(text)) !== null) {
    const rawDate = match[1];
    const iso = normalizeDate(rawDate);
    if (!iso) continue;
    const dateObj = new Date(iso);
    // Zukunft (>= heute) & max 400 Tage
    const diffDays = (dateObj.getTime() - today.getTime()) / (1000*60*60*24);
    if (diffDays < -1 || diffDays > 400) continue;
    const start = Math.max(0, match.index - windowRadius);
    const end = Math.min(text.length, match.index + rawDate.length + windowRadius);
    const snippet = text.slice(start, end);
    let best: { type: ExtractedDeadline['type']; weight: number } | null = null;
    for (const kp of KEY_PATTERNS) {
      if (kp.re.test(snippet)) {
        if (!best || kp.weight > best.weight) best = { type: kp.type, weight: kp.weight };
      }
    }
    // Default classification
    const type = best?.type || 'other';
    const baseConf = best?.weight || 0.6;
    const nearPaymentWords = /(überweisen|rechnung|betrag|zahlung)/i.test(snippet) ? 0.05 : 0;
    const confidence = Math.min(1, baseConf + nearPaymentWords);
    const key = `${iso}|${type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ type, date: iso, confidence, phrase: snippet.trim().replace(/\s+/g,' ').slice(0,160) });
  }
  // Sort earliest first, higher confidence first
  results.sort((a,b)=> a.date.localeCompare(b.date) || b.confidence - a.confidence);
  return results;
};

export const pickPrimaryDeadline = (deadlines: ExtractedDeadline[]): ExtractedDeadline | null => {
  if (!deadlines.length) return null;
  // Bevorzuge payment > appeal > other bei gleichem Datum
  const typeRank: Record<ExtractedDeadline['type'], number> = { payment:0, appeal:1, other:2 };
  return [...deadlines].sort((a,b)=> a.date.localeCompare(b.date) || typeRank[a.type]-typeRank[b.type] || b.confidence - a.confidence)[0];
};

// Quick manual test (can be removed in production) - guarded
if (typeof window === 'undefined' && process.env.NODE_ENV === 'test') {
  const sample = 'Die Rechnung ist zahlbar bis 15.09.2025. Einspruchsfrist endet 30.09.25';
  console.log(extractDeadlinesFromText(sample));
}

export default extractDeadlinesFromText;