import { ColumnMeta } from './tableMetadataService';

export interface DataQualityIssue {
  column: string;
  missingFraction: number;
  severity: 'info' | 'warn' | 'critical';
  message: string;
}

// Schwellenwerte an zentraler Stelle (könnten später konfigurierbar sein)
export const MISSING_WARN_THRESHOLD = 0.2; // 20%
export const MISSING_CRITICAL_THRESHOLD = 0.5; // 50%

/**
 * Erzeugt einfache Datenqualitäts-Hinweise basierend auf Spalten-Metadaten.
 * Aktuell nur Missingness; erweiterbar für zukünftige Checks (z.B. Ausreißer, inkonsistente Typen).
 */
export const computeDataQualityIssues = (columns: ColumnMeta[] | null | undefined): DataQualityIssue[] => {
  if (!columns || columns.length === 0) return [];
  const issues: DataQualityIssue[] = [];
  for (const c of columns) {
    if (typeof c.missingFraction === 'number' && c.missingFraction > 0) {
      if (c.missingFraction >= MISSING_CRITICAL_THRESHOLD) {
        issues.push({
          column: c.name,
            missingFraction: c.missingFraction,
          severity: 'critical',
          message: `Sehr hoher Anteil fehlender Werte (${(c.missingFraction*100).toFixed(1)}%)`
        });
      } else if (c.missingFraction >= MISSING_WARN_THRESHOLD) {
        issues.push({
          column: c.name,
            missingFraction: c.missingFraction,
          severity: 'warn',
          message: `Erhöhter Anteil fehlender Werte (${(c.missingFraction*100).toFixed(1)}%)`
        });
      } else if (c.missingFraction > 0.05) {
        issues.push({
          column: c.name,
          missingFraction: c.missingFraction,
          severity: 'info',
          message: `Fehlende Werte vorhanden (${(c.missingFraction*100).toFixed(1)}%)`
        });
      }
    }
  }
  // Sortierung: severity -> missingFraction desc
  const severityRank: Record<string, number> = { critical: 3, warn: 2, info: 1 };
  issues.sort((a,b)=> {
    const sr = severityRank[b.severity]-severityRank[a.severity];
    if (sr !== 0) return sr;
    return b.missingFraction - a.missingFraction;
  });
  return issues;
};

export const summarizeIssues = (issues: DataQualityIssue[]): string => {
  if (!issues.length) return 'Keine signifikanten Datenqualitätsprobleme erkannt.';
  const crit = issues.filter(i=>i.severity==='critical').length;
  const warn = issues.filter(i=>i.severity==='warn').length;
  const info = issues.filter(i=>i.severity==='info').length;
  return [
    crit? `${crit} kritisch` : null,
    warn? `${warn} Warnung(en)` : null,
    info? `${info} Info` : null
  ].filter(Boolean).join(' · ');
};
