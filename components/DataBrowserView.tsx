import React, { useEffect, useState } from 'react';
import { supabase } from '../src/supabaseClient';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { inferTableColumns, ColumnMeta, typeColor, extractForeignKeys } from '../services/tableMetadataService';
import { computeDataQualityIssues, summarizeIssues } from '../services/dataQualityService';
import { summarizeTableSchema, SchemaSummaryResult } from '../services/schemaSummaryService';
import { computeVirtualWindow, applyOptimisticUpdate, mapPostgrestError } from '../services/dataBrowserUtils';
import useDebounce from '../hooks/useDebounce';

interface DataBrowserViewProps { apiKey: string; userId: string; }

interface TableInfo { name: string; rowCount?: number; error?: string; loading: boolean; }

// Initial manuelle Liste relevanter Tabellen; später dynamisch über Katalog
const CORE_TABLES = [
  'documents',
  'insurance_policies',
  'insurance_claims',
  'liabilities',
  'contacts',
  'rules',
];

const isValidUUID = (v: string | undefined | null): boolean => !!v && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);

const DataBrowserView: React.FC<DataBrowserViewProps> = ({ userId }) => {
  const ui = useThemeClasses();
  const [tables, setTables] = useState<TableInfo[]>(CORE_TABLES.map(name => ({ name, loading: true })));
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [columns, setColumns] = useState<ColumnMeta[] | null>(null);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnsError, setColumnsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [editingCell, setEditingCell] = useState<{rowIndex:number; col:string; value:any} | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [optimisticRevert, setOptimisticRevert] = useState<null | (()=>any[])>(null);
  const [virtual, setVirtual] = useState({ start:0, end:0, padTop:0, padBottom:0 });
  const rowHeight = 32; // heuristisch (px)
  const tableBodyRef = React.useRef<HTMLDivElement|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createData, setCreateData] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<{ row: any; table: string } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [detailRow, setDetailRow] = useState<any | null>(null);
  const [fkTargets, setFkTargets] = useState<{ column:string; ref:string }[] | null>(null);
  const [schemaSummary, setSchemaSummary] = useState<SchemaSummaryResult | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [dataQualityIssues, setDataQualityIssues] = useState<ReturnType<typeof computeDataQualityIssues>>([]);
  const [showDQ, setShowDQ] = useState(false);

  // Row Counts
  useEffect(() => {
    let cancelled = false;
    const timeout = <T,>(p: Promise<T>, ms = 6000): Promise<T> => new Promise((resolve, reject) => {
      const to = setTimeout(()=>reject(new Error('Timeout')), ms);
      p.then(v=>{clearTimeout(to);resolve(v);}).catch(e=>{clearTimeout(to);reject(e);});
    });
    const fetchCountWithRetry = async (table:string, attempts=2): Promise<{count?:number; error?:string}> => {
      if (!supabase) return { error: 'Supabase nicht konfiguriert' };
      for (let i=0;i<attempts;i++) {
        try {
          let q: any = supabase.from(table).select('*', { count: 'exact', head: true });
          if (isValidUUID(userId)) {
            q = q.eq('user_id', userId);
          }
          const { count, error } = await timeout(q as Promise<{ count: number|null; error: any }>);
          if (error) return { error: (error as any).message };
          return { count: count || 0 };
        } catch (e:any) {
          if (i === attempts-1) return { error: e.message };
          await new Promise(r=>setTimeout(r, 300 * (i+1)));
        }
      }
      return { error: 'Unbekannter Fehler' };
    };
    const loadCounts = async () => {
      const promises = tables.map(t => fetchCountWithRetry(t.name));
      const settled = await Promise.allSettled(promises);
      if (cancelled) return;
      const updated = tables.map((t, idx) => {
        const res = settled[idx];
        if (res.status === 'fulfilled') {
          return { ...t, loading: false, rowCount: res.value.count, error: res.value.error };
        }
        return { ...t, loading: false, error: res.reason?.message || 'Fehler' };
      });
      setTables(updated);
    };
    loadCounts();
    return () => { cancelled = true; };
  }, [userId]);

  const loadRows = async (table: string, resetPaging=true) => {
    if (!supabase) { setRowsError('Supabase nicht konfiguriert'); return; }
    setSelectedTable(table);
    if (resetPaging) { setPage(1); setSortCol(null); setSortDir('asc'); }
    setRows(null); setRowsError(null); setRowsLoading(true); setTotalCount(null);
    setColumns(null); setColumnsError(null); setColumnsLoading(true);
  setSchemaSummary(null);
    // Neu: erst Spalten ermitteln, damit Suche direkt beim ersten Laden greift
    let localCols: ColumnMeta[] | null = null;
    try {
      localCols = await inferTableColumns(table, isValidUUID(userId) ? userId : undefined);
      setColumns(localCols);
      setFkTargets(extractForeignKeys(localCols));
      setDataQualityIssues(computeDataQualityIssues(localCols));
    } catch (e:any) {
      setColumnsError(e.message);
      setDataQualityIssues([]);
    } finally {
      setColumnsLoading(false);
    }
    try {
      const from = (page-1)*pageSize;
      const to = from + pageSize - 1;
      let query: any = supabase.from(table).select('*', { count: 'exact' });
      if (isValidUUID(userId)) {
        query = query.eq('user_id', userId);
      }
      if (debouncedSearch && localCols) {
        const stringCols = localCols.filter(c=>c.type==='string').slice(0,4);
        if (stringCols.length > 0) {
          const pattern = debouncedSearch.replace(/%/g,'');
          const ors = stringCols.map(c=>`${c.name}.ilike.%${pattern}%`).join(',');
          query = query.or(ors);
        }
      }
      query = query.range(from, to);
      if (sortCol) {
        query = query.order(sortCol, { ascending: sortDir === 'asc' });
      }
      const { data, error, count } = await query;
      if (error) setRowsError(error.message); else { setRows(data||[]); setTotalCount(count?? null); }
    } catch (e:any) {
      setRowsError(e.message);
    } finally {
      setRowsLoading(false);
    }
  };

  // Reload rows when pagination/sort changes
  useEffect(() => {
    if (selectedTable) {
      loadRows(selectedTable, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortCol, sortDir, debouncedSearch]);
  const startEdit = (rowIndex:number, col:string, value:any) => {
    setEditingCell({ rowIndex, col, value });
  };
  const commitEdit = async () => {
    if (!editingCell || !selectedTable || !rows) return;
    const row = rows[editingCell.rowIndex];
    const idField = Object.keys(row).find(k=>k==='id');
    if (!idField) { setSaveError('Kein Primärschlüssel (id) gefunden.'); setEditingCell(null); return; }
    setSaving(true); setSaveError(null);
    // Optimistic Update + Revert
    setRows(prev => {
      if (!prev) return prev;
      const { newRows, revert } = applyOptimisticUpdate(prev, editingCell.rowIndex, editingCell.col, editingCell.value);
      setOptimisticRevert(()=>revert);
      return newRows;
    });
    try {
      const patch:any = { [editingCell.col]: editingCell.value };
      const { error } = await supabase!.from(selectedTable).update(patch).eq('id', row[idField]);
      if (error) throw error;
      setOptimisticRevert(null);
    } catch (e:any) {
      if (optimisticRevert) {
        setRows(optimisticRevert());
        setOptimisticRevert(null);
      }
      setSaveError(mapPostgrestError(e));
    }
    setSaving(false); setEditingCell(null);
  };
  const cancelEdit = () => setEditingCell(null);

  const openCreate = () => {
    if (!columns) return;
    const init: Record<string, any> = {};
    columns.forEach(c => {
      if (['id','created_at','updated_at','user_id'].includes(c.name)) return;
      init[c.name] = '';
    });
    setCreateData(init);
    setShowCreate(true);
    setCreateError(null);
  };

  const submitCreate = async () => {
    if (!selectedTable) return;
    setCreating(true); setCreateError(null);
    try {
      const payload: Record<string, any> = { ...createData, user_id: userId };
      const { error } = await supabase!.from(selectedTable).insert(payload);
      if (error) throw error;
      setShowCreate(false);
      // Refresh erste Seite
      setPage(1);
      await loadRows(selectedTable, false);
    } catch (e:any) {
      setCreateError(mapPostgrestError(e));
    }
    setCreating(false);
  };

  const deleteRow = async (rowIndex:number) => {
    if (!selectedTable || !rows) return;
    const row = rows[rowIndex];
    const id = row.id;
    if (!id) { setSaveError('Löschen ohne id nicht möglich.'); return; }
    try {
      const { error } = await supabase!.from(selectedTable).delete().eq('id', id);
      if (error) throw error;
      setLastDeleted({ row, table: selectedTable });
      setRows(prev => prev ? prev.filter((_,i)=> i!==rowIndex) : prev);
      if (totalCount!=null) setTotalCount(tc=> (tc||0)-1);
    } catch (e:any) {
      setSaveError(mapPostgrestError(e));
    }
  };

  const undoDelete = async () => {
    if (!lastDeleted) return;
    setUndoing(true);
    try {
      const { row, table } = lastDeleted;
      const { error } = await supabase!.from(table).insert(row);
      if (error) throw error;
      if (selectedTable === table) {
        await loadRows(selectedTable, false);
      }
      setLastDeleted(null);
    } catch (e:any) {
      setSaveError('Undo fehlgeschlagen: '+ mapPostgrestError(e));
    }
    setUndoing(false);
  };

  // Virtual Scrolling Effekt
  useEffect(() => {
    if (!rows) return;
    const el = tableBodyRef.current;
    if (!el) return;
    const handle = () => {
      const v = computeVirtualWindow(rows.length, rowHeight, el.scrollTop, el.clientHeight, 6);
      setVirtual(v);
    };
    handle();
    el.addEventListener('scroll', handle);
    return () => el.removeEventListener('scroll', handle);
  }, [rows]);

  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const handleHeaderClick = (col:string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col); setSortDir('asc');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Datenbanken</h2>
        <p className={`text-sm ${ui.textMuted}`}>Explorer (Alpha): Zeigt Kern-Tabellen Ihrer Daten. Weitere Funktionen wie Editieren, Suche, KI-Unterstützung folgen.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map(t => (
          <button key={t.name} onClick={() => loadRows(t.name)} className={`border rounded-lg p-4 text-left hover:shadow transition ${ui.border} ${selectedTable===t.name ? 'ring-2 ring-blue-500' : ''}`}> 
            <div className="font-medium">{t.name}</div>
            {t.loading ? <div className="text-xs mt-1 animate-pulse">Lade...</div> : t.error ? <div className="text-xs text-red-500">Fehler: {t.error}</div> : <div className="text-xs mt-1 text-slate-600 dark:text-slate-400">{t.rowCount} Zeilen</div>}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {selectedTable && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Tabelle: {selectedTable}</h3>
            <div className="mb-3 space-y-1">
              {columnsLoading && <div className="text-xs animate-pulse">Lade Spalten-Metadaten...</div>}
              {columnsError && <div className="text-xs text-red-500">Spaltenfehler: {columnsError}</div>}
              {columns && columns.length > 0 && (
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {columns.map(c => {
                    const fk = c.foreignKeyRef;
                    const miss = c.missingFraction;
                    const missBadge = typeof miss === 'number' ? (miss > 0.6 ? 'bg-red-500/70 text-white' : miss > 0.3 ? 'bg-amber-400/70 text-slate-900' : miss > 0.1 ? 'bg-amber-200 dark:bg-amber-700/40 text-amber-800 dark:text-amber-200' : '') : '';
                    return (
                      <span
                        key={c.name}
                        className={`relative px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 ${typeColor(c.type)} ${fk? 'ring-1 ring-blue-400/50 cursor-pointer':''}`}
                        title={`Typ: ${c.type}${c.nullable ? ' (nullable)' : ''}${c.sampleValue!==undefined?`\nSample: ${typeof c.sampleValue==='object'? JSON.stringify(c.sampleValue).slice(0,120): String(c.sampleValue).slice(0,120)}`:''}${fk?`\nFK -> ${fk}`:''}${typeof miss==='number'?`\nMissing-Ratio: ${(miss*100).toFixed(1)}%`:''}`}
                        onClick={()=> { if (fk) { loadRows(fk); } }}
                      >
                        <strong>{c.name}</strong>{c.nullable ? '?' : ''}{fk && <span className="ml-1 text-[9px] uppercase bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1 rounded">fk</span>}
                        {typeof miss === 'number' && miss > 0.1 && (
                          <span className={`ml-1 text-[9px] px-1 rounded ${missBadge}`} title={`Fehlende Werte: ${(miss*100).toFixed(1)}%`}>
                            {(miss*100).toFixed(0)}%
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            {rowsLoading && <div className="text-sm animate-pulse">Lade Zeilen...</div>}
            {rowsError && <div className="text-sm text-red-500">{rowsError}</div>}
            {rows && rows.length === 0 && <div className="text-sm text-slate-500">Keine Zeilen gefunden.</div>}
            {rows && rows.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div>Zeilen: {totalCount ?? '…'}</div>
                  <div className="flex items-center gap-1">
                    Seite
                    <button disabled={!canPrev} onClick={()=> setPage(p=>p-1)} className={`px-2 py-0.5 rounded border ${canPrev? 'hover:bg-slate-100 dark:hover:bg-slate-700': 'opacity-40 cursor-not-allowed'} ${ui.border}`}>◀</button>
                    <span className="font-mono">{page}/{totalPages}</span>
                    <button disabled={!canNext} onClick={()=> setPage(p=>p+1)} className={`px-2 py-0.5 rounded border ${canNext? 'hover:bg-slate-100 dark:hover:bg-slate-700': 'opacity-40 cursor-not-allowed'} ${ui.border}`}>▶</button>
                  </div>
                  <div className="flex items-center gap-1">Größe
                    <select value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1); }} className="border rounded px-1 py-0.5 bg-transparent text-xs">
                      {[10,25,50,100].map(s=> <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {sortCol && <div>Sort: <span className="font-mono">{sortCol} {sortDir==='asc'?'↑':'↓'}</span></div>}
                  <div className="flex items-center gap-1">
                    <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1);} } placeholder="Suche…" className="border rounded px-2 py-0.5 text-xs bg-transparent" />
                  </div>
                  {saving && <div className="text-blue-600 dark:text-blue-400">Speichere…</div>}
                  {saveError && <div className="text-red-500">Fehler: {saveError}</div>}
      {selectedTable && <button onClick={openCreate} className="ml-auto px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs">Neu</button>}
  {selectedTable && columns && <>
    <button onClick={()=> { if (!schemaSummary && !schemaLoading){
    setSchemaLoading(true);
    summarizeTableSchema((window as any)?.ENV_GEMINI_KEY, selectedTable, columns).then(r=> setSchemaSummary(r)).finally(()=> setSchemaLoading(false));
      } setShowSchema(s=>!s); }} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs">Schema</button>
    <button onClick={()=> setShowDQ(s=>!s)} className={`px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs ${dataQualityIssues.length? 'relative':''}`}>Qualität
      {dataQualityIssues.length>0 && <span className="absolute -top-1 -right-1 bg-red-600 text-[9px] text-white rounded-full w-4 h-4 flex items-center justify-center">{dataQualityIssues.length}</span>}
    </button>
  </>}
                </div>
                {showDQ && (
                  <div className="border rounded p-2 bg-amber-50 dark:bg-amber-900/20 text-[11px] space-y-1 max-h-40 overflow-auto">
                    <div className="font-semibold flex items-center justify-between">Datenqualität
                      <span className="text-[10px] text-slate-500">{summarizeIssues(dataQualityIssues)}</span>
                    </div>
                    {dataQualityIssues.length===0 && <div className="text-slate-500">Keine signifikanten Probleme.</div>}
                    {dataQualityIssues.map((i,idx)=> (
                      <div key={idx} className={`flex items-start gap-2 ${i.severity==='critical'? 'text-red-700 dark:text-red-400': i.severity==='warn'? 'text-amber-700 dark:text-amber-400':'text-slate-600 dark:text-slate-300'}`}> 
                        <span className={`mt-0.5 w-2 h-2 rounded-full ${i.severity==='critical'? 'bg-red-600': i.severity==='warn'? 'bg-amber-500':'bg-slate-400'}`} />
                        <div><strong>{i.column}</strong>: {i.message}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div ref={tableBodyRef} className="overflow-auto border rounded-lg max-h-[60vh] text-sm relative">
                  {rows && rows.length > 200 && <div className="absolute top-1 right-2 text-[10px] text-slate-500">Virtuell {virtual.start}-{virtual.end} / {rows.length}</div>}
                  <table className="min-w-full border-collapse">
                    <thead className={ui.tableHeader || ''}> 
                      <tr>
        <th className="px-2 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 uppercase text-[10px] tracking-wide">#</th>
        {Object.keys(rows[0]).map(col => (
                          <th
                            key={col}
                            onClick={()=>handleHeaderClick(col)}
                            className="px-3 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 uppercase text-[10px] tracking-wide cursor-pointer select-none group"
                            title="Zum Sortieren klicken"
                          >
                            <span className="inline-flex items-center gap-1">
                              {col}
                              {sortCol===col && <span>{sortDir==='asc'?'▲':'▼'}</span>}
                              {sortCol!==col && <span className="opacity-0 group-hover:opacity-40">↕</span>}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ height: virtual.padTop? virtual.padTop : 0 }}><td colSpan={Object.keys(rows[0]).length + 1} /></tr>
                      {rows.slice(virtual.start, virtual.end).map((r,localIdx) => {
                        const i = virtual.start + localIdx;
                        return (
            <tr key={i} className={i%2? 'bg-slate-50 dark:bg-slate-800/50' : ''} style={{ height: rowHeight }}>
                          <td className="px-2 py-1 border-b border-slate-100 dark:border-slate-700 text-xs text-slate-400">{(page-1)*pageSize + i + 1}
                            <button onClick={()=>deleteRow(i)} title="Löschen" className="ml-2 text-red-500 hover:text-red-600">✕</button>
              <button onClick={()=> setDetailRow(rows[i])} title="Details" className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">🔍</button>
                          </td>
                          {Object.keys(r).map(k => {
                            const isEditing = editingCell && editingCell.rowIndex===i && editingCell.col===k;
                            const cellVal = r[k];
                            // Quick-Link Heuristik: Dokument verbindet zu insurance_policies / liabilities über *_id Felder
                            const isFK = /_id$/.test(k) && k !== 'user_id' && cellVal;
                            return (
                              <td key={k} className="px-3 py-1 align-top border-b border-slate-100 dark:border-slate-700 whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis" title={cellVal != null ? (typeof cellVal==='object'? JSON.stringify(cellVal).slice(0,500): String(cellVal)) : ''}>
                                {isEditing ? (
                                  <form onSubmit={(e)=>{ e.preventDefault(); commitEdit(); }} className="flex items-center gap-1">
                                    <input autoFocus className="border rounded px-1 py-0.5 text-xs bg-white dark:bg-slate-900 w-40" value={editingCell.value ?? ''} onChange={e=> setEditingCell(ec=> ec? { ...ec, value: e.target.value }: ec)} />
                                    <button type="submit" className="text-green-600 text-xs">OK</button>
                                    <button type="button" onClick={cancelEdit} className="text-slate-500 text-xs">X</button>
                                  </form>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <button onDoubleClick={()=> startEdit(i,k, cellVal)} className="text-left w-full truncate" title="Doppelklick zum Bearbeiten">
                                      {cellVal == null ? <span className="text-slate-400">∅</span> : typeof cellVal === 'object' ? JSON.stringify(cellVal) : String(cellVal)}
                                    </button>
                                    {isFK && (
                                      <button onClick={()=> {
                                        // Zieltabellenname heuristisch wie in FK Heuristik
                                        const base = k.slice(0,-3);
                                        const targets = [base + 's', base + 'es', base];
                                        for (const tgt of targets){
                                          if (CORE_TABLES.includes(tgt)) { loadRows(tgt); break; }
                                        }
                                      }} title="Zu verknüpfter Tabelle springen" className="text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">↗</button>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        );
                      })}
                      <tr style={{ height: virtual.padBottom? virtual.padBottom : 0 }}><td colSpan={Object.keys(rows[0]).length + 1} /></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-start justify-center overflow-auto py-10" onClick={()=> setShowCreate(false)}>
          <div className={`w-full max-w-lg rounded-lg shadow-lg p-6 space-y-4 ${ui.card}`} onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Neue Zeile in {selectedTable}</h4>
              <button onClick={()=> setShowCreate(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-sm">Schließen</button>
            </div>
            {createError && <div className="text-xs text-red-500">{createError}</div>}
            <form className="space-y-3" onSubmit={(e)=>{ e.preventDefault(); submitCreate(); }}>
              <div className="grid grid-cols-2 gap-3">
                {columns?.filter(c=> !['id','created_at','updated_at','user_id'].includes(c.name)).map(c => (
                  <label key={c.name} className="flex flex-col gap-1 text-[11px] font-medium">
                    <span className="uppercase tracking-wide text-[10px] text-slate-500 dark:text-slate-400">{c.name}</span>
                    <input value={createData[c.name] ?? ''} onChange={e=> setCreateData(d=> ({...d, [c.name]: e.target.value}))} className="border rounded px-2 py-1 text-xs bg-white dark:bg-slate-900" />
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=> setShowCreate(false)} className="px-3 py-1 text-xs rounded border ${ui.border} hover:bg-slate-100 dark:hover:bg-slate-700">Abbrechen</button>
                <button type="submit" disabled={creating} className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">{creating ? 'Speichere…' : 'Anlegen'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {lastDeleted && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-800 text-white text-xs px-4 py-2 rounded shadow flex items-center gap-3">
          <span>Zeile gelöscht.</span>
            <button disabled={undoing} onClick={undoDelete} className="underline disabled:opacity-40">{undoing ? 'Stelle wieder her…' : 'Rückgängig'}</button>
            <button onClick={()=> setLastDeleted(null)} title="Schließen" className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}
      {detailRow && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-auto py-10" onClick={()=> setDetailRow(null)}>
          <div className={`w-full max-w-xl rounded-lg shadow-lg p-6 space-y-4 ${ui.card}`} onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Detailansicht Zeile {detailRow.id ?? ''}</h4>
              <button onClick={()=> setDetailRow(null)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-sm">Schließen</button>
            </div>
            <div className="text-[10px] font-mono whitespace-pre-wrap break-all max-h-[50vh] overflow-auto border rounded p-3 bg-slate-50 dark:bg-slate-900/40">
              {JSON.stringify(detailRow, null, 2)}
            </div>
            {fkTargets && fkTargets.length>0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold">Verknüpfungen</div>
                <ul className="text-xs list-disc pl-5 space-y-1">
                  {fkTargets.map(fk => {
                    const val = detailRow[fk.column];
                    return (
                      <li key={fk.column}>
                        <button disabled={val==null} onClick={()=> { loadRows(fk.ref); }} className={`underline ${val==null? 'opacity-40 cursor-not-allowed':''}`}>{fk.column} ➜ {fk.ref} {val?`(#${String(val).slice(0,32)})`: '(leer)'}</button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      {showSchema && selectedTable && (
        <div className="fixed bottom-4 right-4 z-40 w-80 max-h-[60vh] flex flex-col rounded-lg shadow-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="px-3 py-2 flex items-center justify-between text-xs font-medium border-b border-slate-200 dark:border-slate-700">
            <span>Schema {selectedTable}</span>
            <button onClick={()=> setShowSchema(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">✕</button>
          </div>
          <div className="p-3 overflow-auto text-[11px] whitespace-pre-wrap leading-snug font-sans">
            {schemaLoading && <div className="animate-pulse">Lade Schema…</div>}
            {!schemaLoading && schemaSummary && (
              <div>
                {schemaSummary.summary.split('\n').map((l,i)=> <div key={i}>{l}</div>)}
                <div className="mt-2 text-[9px] text-slate-400">Quelle: {schemaSummary.fromAI? 'KI' : 'Heuristik'}</div>
              </div>
            )}
            {!schemaLoading && !schemaSummary && <div className="text-slate-400">Noch keine Daten.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataBrowserView;
