import React, { useEffect, useState, useMemo } from 'react';
import { Task, Document } from '../types';
import { fetchTasks, updateTask, deleteTask, insertAuditEvent } from '../services/supabaseDataService';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface TasksViewProps {
  userId: string;
  documents: Document[];
  apiKey: string;
  onSelectDocument: (docId: string) => void;
  showToast?: (msg:string,type?:'success'|'error'|'info')=>void;
}

const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
const statusColor: Record<Task['status'], string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  auto_executed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
};

const TasksView: React.FC<TasksViewProps> = ({ userId, documents, apiKey, onSelectDocument, showToast }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all'|Task['status']>('all');
  const [search, setSearch] = useState('');
  const ui = useThemeClasses();

  useEffect(() => { (async()=> { setLoading(true); try { const t = await fetchTasks(userId); setTasks(t); } catch(e){ console.warn(e); } finally { setLoading(false);} })(); }, [userId]);

  const filtered = useMemo(()=> tasks.filter(t => (filterStatus==='all'|| t.status===filterStatus) && (!search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.description||'').toLowerCase().includes(search.toLowerCase()))).sort((a,b)=> {
    const pa = priorityOrder[a.priority]; const pb = priorityOrder[b.priority]; if (pa!==pb) return pa-pb; const da = a.dueDate||''; const db = b.dueDate||''; return da.localeCompare(db);
  }), [tasks, filterStatus, search]);

  const handleStatusToggle = async (task: Task) => {
    const next: Task['status'] = task.status === 'done' ? 'open' : 'done';
    try { const upd = await updateTask(task.id, { status: next }); setTasks(prev => prev.map(t => t.id===task.id ? upd : t)); } catch(e){ showToast?.('Status Update fehlgeschlagen','error'); }
  };

  const handleDelete = async (task: Task) => { if (!window.confirm('Aufgabe wirklich löschen?')) return; try { await deleteTask(task.id); setTasks(prev=> prev.filter(t=>t.id!==task.id)); } catch { showToast?.('Löschen fehlgeschlagen','error'); } };

  const handleAutoAction = async (task: Task) => {
    if (!task.autoAction?.suggested) return;
    
    // FR-10: Ask user for confirmation
    const action = task.autoAction;
    let confirmMessage = `Soll ich diese automatische Aktion ausführen?\n\nAufgabe: ${task.title}`;
    
    if (action.type === 'email') {
      confirmMessage += `\nTyp: E-Mail versenden (${action.template || 'Standard-Vorlage'})`;
    }
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      // FR-11: Execute the autonomous action
      if (action.type === 'email') {
        // For now, we simulate email sending since full SMTP integration would require server setup
        showToast?.('E-Mail Vorlage wurde in die Zwischenablage kopiert. Bitte in Ihr E-Mail-Programm einfügen.', 'info');
        
        // Copy email template to clipboard
        const emailContent = `Betreff: ${action.template === 'payment_confirmation' ? 'Zahlungsbestätigung' : 'Nachricht'}

Sehr geehrte Damen und Herren,

${action.template === 'payment_confirmation' 
  ? 'hiermit bestätigen wir den Erhalt Ihrer Zahlung. Vielen Dank für die pünktliche Begleichung der Rechnung.' 
  : 'wir setzen uns bezüglich Ihres Anliegens mit Ihnen in Verbindung.'}

Mit freundlichen Grüßen`;

        await navigator.clipboard.writeText(emailContent);
        
        // Mark task as auto_executed
        const updatedTask = await updateTask(task.id, { 
          status: 'auto_executed',
          autoAction: { ...action, executedAt: new Date().toISOString() }
        });
        
        setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
        
        // Log audit event
        try {
          await insertAuditEvent(task.userId, {
            actorType: 'ai',
            eventType: 'task.auto_action.executed',
            payloadJson: { taskId: task.id, actionType: action.type, template: action.template }
          });
        } catch (e) {
          console.warn('Audit event failed', e);
        }
        
        showToast?.('Automatische Aktion ausgeführt', 'success');
      }
    } catch (error) {
      showToast?.('Automatische Aktion fehlgeschlagen', 'error');
      console.error('Auto action failed:', error);
    }
  };

  const openDoc = (task: Task) => { if (task.documentId) onSelectDocument(task.documentId); };

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-3xl font-bold ${ui.textPrimary}`}>Aufgaben</h2>
        <p className={`${ui.textMuted} mt-1`}>Automatisch vorgeschlagene und manuelle To-Dos.</p>
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen..." className={`px-3 py-2 text-sm rounded-md border ${ui.border} bg-transparent`} />
        <select value={filterStatus} onChange={e=> setFilterStatus(e.target.value as any)} className={`px-3 py-2 text-sm rounded-md border ${ui.border} bg-transparent`}>
          <option value="all">Alle Stati</option>
          <option value="open">Offen</option>
          <option value="in_progress">In Arbeit</option>
          <option value="done">Erledigt</option>
          <option value="cancelled">Abgebrochen</option>
          <option value="auto_executed">Auto erledigt</option>
        </select>
        {loading && <span className="text-xs animate-pulse">Lade…</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(task => {
          const doc = documents.find(d=> d.id===task.documentId);
          const dueText = task.dueDate ? new Date(task.dueDate).toLocaleDateString('de-DE') : '—';
          return (
            <div key={task.id} className={`${ui.card} ${ui.border} p-4 rounded-lg flex flex-col gap-2`}> 
              <div className="flex justify-between items-start gap-2">
                <h3 className={`font-semibold ${ui.textPrimary}`}>{task.title}</h3>
                <div className={`text-xs px-2 py-0.5 rounded ${statusColor[task.status]}`}>{task.status}</div>
              </div>
              <div className="text-xs flex gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">Prio: {task.priority}</span>
                {task.dueDate && <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">Fällig: {dueText}</span>}
                {task.documentId && <button onClick={()=>openDoc(task)} className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs">Dokument öffnen</button>}
                {task.autoAction?.suggested && <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">Auto-Aktion</span>}
              </div>
              {task.description && <p className={`text-sm ${ui.textMuted} whitespace-pre-line`}>{task.description}</p>}
              {doc && <p className="text-xs text-slate-500 truncate">Beleg: {doc.name}</p>}
              <div className="mt-auto flex justify-end gap-2 pt-2">
                {task.autoAction?.suggested && task.status !== 'auto_executed' && (
                  <button 
                    onClick={() => handleAutoAction(task)} 
                    className="text-xs px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-700"
                  >
                    Auto-Aktion ausführen
                  </button>
                )}
                <button onClick={()=>handleStatusToggle(task)} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">{task.status==='done'?'Reaktivieren':'Erledigt'}</button>
                <button onClick={()=>handleDelete(task)} className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700">Löschen</button>
              </div>
            </div>
          );
        })}
        {!loading && !filtered.length && <div className="text-sm text-slate-500 col-span-full">Keine Aufgaben gefunden.</div>}
      </div>
    </div>
  );
};

export default TasksView;