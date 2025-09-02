import React, { useState, useEffect } from 'react';
import { FundingOpportunity, UserProfile } from '../types';
import { findFundingOpportunities } from '../services/geminiLazy';
import { combinedFundingSearch, findSimilarOpportunities, enrichWithGemini } from '../services/tavilyService';
import SparklesIcon from './icons/SparklesIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface FörderungenViewProps {
  userProfile: UserProfile;
  apiKey: string;
  tavilyApiKey?: string;
}

const FörderungenView: React.FC<FörderungenViewProps> = ({ userProfile, apiKey, tavilyApiKey }) => {
  const [opportunities, setOpportunities] = useState<FundingOpportunity[]>([]);
  const ui = useThemeClasses();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSimilarBase, setSelectedSimilarBase] = useState<string | null>(null);
  const [similarList, setSimilarList] = useState<FundingOpportunity[]>([]);
  const [filterLevel, setFilterLevel] = useState<'all' | 'bund' | 'land' | 'eu' | 'other'>('all');
  const [filterLand, setFilterLand] = useState<string>('all');
  const [useHybrid, setUseHybrid] = useState(true);
  const [includeEU, setIncludeEU] = useState(true);
  const [progressPhase, setProgressPhase] = useState<string | null>(null);
  const [progressValue, setProgressValue] = useState<number>(0);
  const [progressTotal, setProgressTotal] = useState<number>(0);

  const loadInitial = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await findFundingOpportunities(apiKey, userProfile);
      setOpportunities(results);
    } catch (err) {
      const errorMessage = (err instanceof Error) ? err.message : 'Ein unbekannter Fehler ist aufgetreten.';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadInitial(); }, [apiKey, userProfile]);

  const handleDeepSearch = async () => {
    if (!apiKey) return;
    setIsDeepSearching(true);
    setError(null);
    try {
      let enriched: FundingOpportunity[] = [];
      if (tavilyApiKey) {
        const tavilyResults = await combinedFundingSearch(userProfile, tavilyApiKey, { 
          query: searchQuery, deep: true, includeEU,
          onProgress: (phase, current, total) => {
            setProgressPhase(phase);
            setProgressValue(current);
            setProgressTotal(total);
          }
        });
        enriched = tavilyResults;
        if (useHybrid) {
          setProgressPhase('gemini:enrich');
          setProgressValue(0); setProgressTotal(enriched.length || 1);
          enriched = await enrichWithGemini(apiKey, enriched);
          setProgressValue(enriched.length); // abgeschlossen
        }
      } else {
        enriched = await findFundingOpportunities(apiKey, userProfile);
      }
      const query = searchQuery.trim().toLowerCase();
      const rescored = enriched.map(o => ({
        ...o,
        relevanceScore: typeof o.relevanceScore === 'number' ? o.relevanceScore : (query && (o.description.toLowerCase().includes(query) || o.title.toLowerCase().includes(query)) ? 0.85 : 0.55)
      }));
      setOpportunities(rescored.sort((a,b) => (b.relevanceScore||0) - (a.relevanceScore||0)));
    } catch (err) {
      const errorMessage = (err instanceof Error) ? err.message : 'Fehler bei Tiefenrecherche.';
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsDeepSearching(false);
  setTimeout(() => { setProgressPhase(null); }, 1200);
    }
  };

  const handleRefresh = () => { loadInitial(); };

  const filteredOpps = opportunities.filter(o => {
    if (filterLevel !== 'all' && o.level !== filterLevel) return false;
    if (filterLevel === 'land' && filterLand !== 'all' && o.land !== filterLand) return false;
    return true;
  });

  const euOpps = filteredOpps.filter(o => o.level === 'eu');
  const nonEuOpps = filteredOpps.filter(o => o.level !== 'eu');

  const exportCSV = () => {
    const rows = [['Titel','Quelle','Ebene','Bundesland','Beschreibung','Voraussetzungen','Link','Relevanz']];
    filteredOpps.forEach(o => rows.push([o.title, o.source, o.level||'', o.land||'', o.description.replace(/\n/g,' '), o.eligibilitySummary.replace(/\n/g,' '), o.link, o.relevanceScore?.toString()||'']));
    const csv = rows.map(r => r.map(f => '"'+f.replace(/"/g,'""')+'"').join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'foerderungen.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    // Leichtgewichtig ohne externe Lib: neues Fenster mit Druck.
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write('<html><head><title>Förderungen</title><style>body{font-family:sans-serif;font-size:12px;} h1{font-size:16px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ccc;padding:4px;vertical-align:top;} th{background:#f2f2f2;} </style></head><body>');
    win.document.write('<h1>Förderprogramme Export</h1>');
    win.document.write('<table><thead><tr><th>Titel</th><th>Quelle</th><th>Ebene</th><th>Land</th><th>Beschreibung</th><th>Voraussetzungen</th><th>Link</th></tr></thead><tbody>');
    filteredOpps.forEach(o => {
      win!.document.write(`<tr><td>${o.title}</td><td>${o.source}</td><td>${o.level||''}</td><td>${o.land||''}</td><td>${o.description.replace(/</g,'&lt;')}</td><td>${o.eligibilitySummary.replace(/</g,'&lt;')}</td><td>${o.link}</td></tr>`);
    });
    win.document.write('</tbody></table></body></html>');
    win.document.close();
    win.focus();
    win.print();
  };
  
  const SkeletonCard: React.FC = () => (
    <div className={`${ui.card} ${ui.border} p-6 rounded-xl shadow-sm animate-pulse`}>
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full mb-1"></div>
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full mb-3"></div>
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-5/6 mb-4"></div>
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-32 mt-4"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className={`text-3xl font-bold ${ui.textPrimary}`}>Fördermöglichkeiten für Ihr Unternehmen</h2>
          <p className={`${ui.textMuted} mt-1`}>
              Ihr KI-Agent durchsucht das Internet nach passenden Förderungen, Zuschüssen und Krediten.
              Ergebnisse werden auf Ihr Unternehmensprofil zugeschnitten. {tavilyApiKey ? 'Erweiterte Websuche aktiv.' : 'Erweiterte Websuche (Tavily) nicht konfiguriert.'}
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className={`block text-xs font-semibold mb-1 ${ui.textSecondary}`}>Gezielte Förder-Suchanfrage (optional)</label>
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="z.B. Digitalisierung, Energieeffizienz, Ausbildung, Forschung"
              className={`w-full p-2 rounded-lg text-sm ${ui.input} ${ui.ringFocus}`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className={`block text-xs font-semibold ${ui.textSecondary}`}>Ebene</label>
            <select value={filterLevel} onChange={e => { setFilterLevel(e.target.value as any); }} className={`p-2 rounded-lg text-sm ${ui.input}`}>
              <option value="all">Alle</option>
              <option value="bund">Bund</option>
              <option value="land">Land</option>
              <option value="eu">EU</option>
              <option value="other">Sonstige</option>
            </select>
          </div>
          {filterLevel === 'land' && (
            <div className="flex flex-col gap-2">
              <label className={`block text-xs font-semibold ${ui.textSecondary}`}>Bundesland</label>
              <select value={filterLand} onChange={e => setFilterLand(e.target.value)} className={`p-2 rounded-lg text-sm min-w-[140px] ${ui.input}`}>
                <option value="all">Alle</option>
                {['Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen','Hamburg','Hessen','Mecklenburg-Vorpommern','Niedersachsen','Nordrhein-Westfalen','Rheinland-Pfalz','Saarland','Sachsen','Sachsen-Anhalt','Schleswig-Holstein','Thüringen'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-2 items-start">
            <label className={`block text-xs font-semibold ${ui.textSecondary}`}>Hybrid</label>
            <label className={`inline-flex items-center gap-2 text-xs ${ui.textSecondary}`}>
              <input type="checkbox" checked={useHybrid} onChange={() => setUseHybrid(v => !v)} /> Gemini Anreicherung
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRefresh} disabled={isLoading} className={`px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-60 ${ui.buttonSecondary}`}>Neu laden</button>
            <button onClick={handleDeepSearch} disabled={isDeepSearching || !apiKey} className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${ui.buttonPrimary}`}>
              {isDeepSearching && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
              Tiefenrecherche
            </button>
            <div className="flex gap-2">
              <button onClick={exportCSV} disabled={!filteredOpps.length} className={`px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-500`}>CSV</button>
              <button onClick={exportPDF} disabled={!filteredOpps.length} className={`px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-600 dark:hover:bg-purple-500`}>PDF</button>
            </div>
            <label className={`flex items-center gap-1 text-[10px] font-semibold ml-2 ${ui.textSecondary}`}>
              <input type="checkbox" checked={includeEU} onChange={() => setIncludeEU(v => !v)} /> EU-Programme
            </label>
          </div>
        </div>
      </div>
      {isDeepSearching && (
        <div className="mt-2 rounded-lg p-3 flex flex-col gap-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
          <div className="flex justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
            <span>Recherche läuft...</span>
            <span>{progressPhase || 'initialisiere'}</span>
          </div>
          <div className="w-full h-2 bg-blue-100 dark:bg-blue-950/40 rounded overflow-hidden">
            <div className="h-full bg-blue-600 dark:bg-blue-500 transition-all" style={{ width: progressTotal > 0 ? `${Math.min(100, (progressValue / progressTotal) * 100)}%` : '10%' }}></div>
          </div>
        </div>
      )}
      
      <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 p-4 rounded-r-lg">
        <p className="text-sm">
          <strong>Wichtiger Hinweis:</strong> Die hier angezeigten Informationen sind KI-generiert und dienen als erste Orientierung.
          Prüfen Sie die Details und Voraussetzungen immer auf der offiziellen Seite des Anbieters, bevor Sie eine Förderung beantragen.
          Die Daten werden bei jedem Besuch dieser Seite live aus dem Internet abgerufen.
        </p>
      </div>

      <div>
        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
        ) : error ? (
            <div className="p-6 rounded-lg text-center border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                <AlertTriangleIcon className="w-12 h-12 mx-auto mb-4 text-red-400 dark:text-red-300" />
                <h3 className="text-lg font-semibold">Fehler beim Abrufen der Daten</h3>
                <p className="mt-1">{error}</p>
                 <p className="mt-2 text-sm">Bitte überprüfen Sie Ihren API-Schlüssel in den Einstellungen oder versuchen Sie es später erneut.</p>
            </div>
        ) : opportunities.length === 0 ? (
           <div className={`border-2 border-dashed p-12 rounded-lg text-center ${ui.card} ${ui.border}`}>
                <SparklesIcon className="w-12 h-12 mx-auto mb-4 text-slate-400 dark:text-slate-500" />
                <h3 className={`text-lg font-semibold ${ui.textSecondary}`}>Keine spezifischen Förderungen gefunden</h3>
                <p className={`mt-1 ${ui.textMuted}`}>Die KI konnte im Moment keine passenden Förderungen für Ihr Profil finden. <br /> Stellen Sie sicher, dass Ihre Unternehmensdaten im Profil aktuell sind.</p>
            </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nonEuOpps.map(opp => (
              <div key={opp.id} className={`p-6 rounded-xl shadow-sm flex flex-col relative ${ui.card} ${ui.border}`}>
                {opp.relevanceScore !== undefined && (
                  <span className="absolute top-2 right-2 text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-1 rounded">Relevanz {(opp.relevanceScore*100).toFixed(0)}%</span>
                )}
                <h3 className={`text-base font-bold ${ui.textPrimary}`}>{opp.title}</h3>
                <div className="flex flex-wrap gap-2 mt-2 text-[10px] uppercase tracking-wide">
                  {opp.level && <span className={`px-2 py-1 rounded font-semibold ${ui.badge}`}>{opp.level === 'bund' ? 'Bund' : opp.level === 'land' ? (opp.land || 'Land') : opp.level === 'eu' ? 'EU' : 'Sonstige'}</span>}
                </div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mt-1">{opp.source}</p>
                <p className={`text-sm mt-3 flex-grow ${ui.textSecondary}`}>{opp.description}</p>
                <div className={`mt-4 pt-4 border-t ${ui.border}`}>
                    <h4 className={`text-xs font-semibold mb-1 ${ui.textMuted}`}>Voraussetzungen (Auszug)</h4>
                    <p className={`text-sm ${ui.textSecondary}`}>{opp.eligibilitySummary}</p>
                </div>
                {opp.fetchedAt && <p className={`mt-2 text-[10px] ${ui.textMuted}`}>Gefunden: {new Date(opp.fetchedAt).toLocaleString('de-DE')}</p>}
                <a 
                    href={opp.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block mt-4 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-sm font-semibold py-2 px-4 rounded-lg transition-colors text-center"
                >
                  Mehr erfahren
                </a>
                <button
                  onClick={() => {
                    if (selectedSimilarBase === opp.id) {
                      setSelectedSimilarBase(null); setSimilarList([]); return;
                    }
                    const sims = findSimilarOpportunities(opp, opportunities); 
                    setSelectedSimilarBase(opp.id); 
                    setSimilarList(sims);
                  }}
                  className={`mt-2 text-xs font-semibold text-left ${ui.textSecondary} hover:text-blue-600`}
                >
                  {selectedSimilarBase === opp.id ? 'Ähnliche ausblenden' : 'Ähnliche Programme anzeigen'}
                </button>
                {selectedSimilarBase === opp.id && similarList.length > 0 && (
                  <div className={`mt-3 rounded-lg p-3 ${ui.surfaceSubtle} ${ui.border}`}>
                    <p className={`text-[11px] uppercase font-semibold mb-2 ${ui.textMuted}`}>ÄHNLICHE PROGRAMME</p>
                    <ul className="space-y-1 max-h-40 overflow-auto pr-1">
                      {similarList.map(sim => (
                        <li key={sim.id} className="text-xs flex justify-between gap-2">
                          <a href={sim.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex-1 truncate" title={sim.title}>{sim.title}</a>
                          {sim.relevanceScore !== undefined && <span className={`text-[10px] flex-shrink-0 ${ui.textMuted}`}>{(sim.relevanceScore*100).toFixed(0)}%</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {euOpps.length > 0 && (
              <div className="col-span-full mt-4">
                <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${ui.textSecondary}`}><span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs">EU</span> EU Programme</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {euOpps.map(opp => (
                    <div key={opp.id} className={`p-6 rounded-xl shadow-sm flex flex-col relative ${ui.card} ${ui.border}`}>
                      {opp.relevanceScore !== undefined && (
                        <span className="absolute top-2 right-2 text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-1 rounded">Relevanz {(opp.relevanceScore*100).toFixed(0)}%</span>
                      )}
                      <h3 className={`text-base font-bold ${ui.textPrimary}`}>{opp.title}</h3>
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mt-1">{opp.source}</p>
                      <p className={`text-sm mt-3 flex-grow ${ui.textSecondary}`}>{opp.description}</p>
                      <div className={`mt-4 pt-4 border-t ${ui.border}`}>
                        <h4 className={`text-xs font-semibold mb-1 ${ui.textMuted}`}>Voraussetzungen (Auszug)</h4>
                        <p className={`text-sm ${ui.textSecondary}`}>{opp.eligibilitySummary}</p>
                      </div>
                      {opp.fetchedAt && <p className={`mt-2 text-[10px] ${ui.textMuted}`}>Gefunden: {new Date(opp.fetchedAt).toLocaleString('de-DE')}</p>}
                      <a href={opp.link} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-sm font-semibold py-2 px-4 rounded-lg transition-colors text-center">Mehr erfahren</a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FörderungenView;