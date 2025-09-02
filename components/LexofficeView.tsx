import React, { useState, useMemo } from 'react';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { Document, LexofficeStatus } from '../types';
import LexofficeIcon from './icons/LexofficeIcon';

interface LexofficeViewProps {
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  lexofficeApiKey: string;
}

const StatusBadge: React.FC<{ status: LexofficeStatus }> = ({ status }) => {
  const ui = useThemeClasses();
  const statusStyles: Record<LexofficeStatus, string> = {
    [LexofficeStatus.SUCCESS]: `${ui.statusPositiveBg} ${ui.statusPositiveText}`,
    [LexofficeStatus.FAILED]: `${ui.statusNegativeBg} ${ui.statusNegativeText}`,
    [LexofficeStatus.NOT_SENT]: `${ui.statusInfoBg} ${ui.statusInfoText}`,
  };
  return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>{status}</span>;
};

const LexofficeView: React.FC<LexofficeViewProps> = ({ documents, setDocuments, lexofficeApiKey }) => {
  const today = new Date();
  const ui = useThemeClasses();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const documentsToSend = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return documents.filter(doc => {
      const docDate = new Date(doc.date);
      const isDateInRange = docDate >= start && docDate <= end;
      const isNotSent = doc.lexoffice?.status !== LexofficeStatus.SUCCESS;
      return isDateInRange && isNotSent;
    }).sort((a,b) => b.date.getTime() - a.date.getTime());
  }, [documents, startDate, endDate]);

  const sentDocuments = useMemo(() => {
    return documents
        .filter(doc => doc.lexoffice)
        .sort((a, b) => (b.lexoffice?.sentAt.getTime() || 0) - (a.lexoffice?.sentAt.getTime() || 0));
  }, [documents]);

  const handleSendToLexoffice = async () => {
    setFeedback(null);
    if (!lexofficeApiKey) {
      setFeedback({ type: 'error', message: 'Bitte hinterlegen Sie zuerst Ihren Lexoffice API-Schlüssel in den Einstellungen.' });
      return;
    }
    if (documentsToSend.length === 0) {
      setFeedback({ type: 'error', message: 'Im ausgewählten Zeitraum gibt es keine Belege zum Senden.' });
      return;
    }

    setIsSending(true);
    setProgress({ current: 0, total: documentsToSend.length });
    
    let successCount = 0;
    
    for(let i=0; i < documentsToSend.length; i++) {
        const docToSend = documentsToSend[i];
        // Simulate API call for each document
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const isSuccess = Math.random() > 0.1;
        if (isSuccess) successCount++;

        setDocuments(prevDocs => 
            prevDocs.map(doc => {
                if (doc.id === docToSend.id) {
                    return {
                        ...doc,
                        lexoffice: {
                            status: isSuccess ? LexofficeStatus.SUCCESS : LexofficeStatus.FAILED,
                            sentAt: new Date()
                        }
                    };
                }
                return doc;
            })
        );
        setProgress({ current: i + 1, total: documentsToSend.length });
    }

    setIsSending(false);
    setFeedback({ type: 'success', message: `${successCount} von ${documentsToSend.length} Beleg(en) wurden erfolgreich an Lexoffice übertragen.` });
  };
  
  const formatDate = (date: Date) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(date);

  return (
    <div className="space-y-8">
      <div>
        <h2 className={`text-3xl font-bold ${ui.textPrimary}`}>An LexOffice senden</h2>
        <p className={`${ui.textMuted} mt-1`}>Übertragen Sie Belege aus einem ausgewählten Zeitraum gesammelt an Ihr LexOffice-Konto.</p>
      </div>

      <div className={`${ui.card} ${ui.border} p-4 sm:p-6 rounded-xl shadow-sm`}>
        <h3 className={`text-lg font-semibold mb-4 ${ui.textPrimary}`}>1. Zeitraum auswählen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="start-date" className={`block text-sm font-medium ${ui.textSecondary}`}>Startdatum</label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`}
            />
          </div>
          <div>
            <label htmlFor="end-date" className={`block text-sm font-medium ${ui.textSecondary}`}>Enddatum</label>
            <input
              type="date"
              id="end-date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`}
            />
          </div>
        </div>
      </div>
      
      <div className={`${ui.card} ${ui.border} p-4 sm:p-6 rounded-xl shadow-sm`}>
        <h3 className={`text-lg font-semibold mb-4 ${ui.textPrimary}`}>2. Übertragung starten</h3>
        <div className={`p-4 rounded-lg text-center ${ui.surfaceSubtle}`}>
            <p className={ui.textSecondary}>
                <span className="font-bold text-2xl text-blue-600">{documentsToSend.length}</span> Beleg(e) im ausgewählten Zeitraum zum Senden bereit.
            </p>
        </div>
        {isSending && (
            <div className="mt-4">
                <p className={`text-sm text-center mb-2 ${ui.textSecondary}`}>
                    Übertrage Beleg {progress.current} von {progress.total}...
                </p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                </div>
            </div>
        )}
        {feedback && (
          <div className={`p-3 mt-4 rounded-md text-sm ${feedback.type === 'success' ? `${ui.statusPositiveBg} ${ui.statusPositiveText}` : `${ui.statusNegativeBg} ${ui.statusNegativeText}`}`}>
            {feedback.message}
          </div>
        )}
        <button
          onClick={handleSendToLexoffice}
          disabled={isSending || documentsToSend.length === 0}
          className={`w-full mt-4 flex items-center justify-center font-bold py-3 px-4 rounded-lg shadow-sm transition duration-300 disabled:opacity-60 disabled:cursor-not-allowed ${ui.buttonPrimary}`}
        >
          {isSending ? (
            'Übertragung läuft...'
          ) : (
            `Sende ${documentsToSend.length} Beleg(e) an LexOffice`
          )}
        </button>
      </div>

      <div className={`${ui.card} ${ui.border} p-4 sm:p-6 rounded-xl shadow-sm`}>
        <h3 className={`text-lg font-semibold mb-4 ${ui.textPrimary}`}>Übertragungsverlauf</h3>
         <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className={`${ui.tableHeader} text-xs uppercase`}>
              <tr>
                <th scope="col" className="px-4 py-3 font-medium tracking-wide">Beleg</th>
                <th scope="col" className="px-4 py-3 font-medium tracking-wide">Gesendet am</th>
                <th scope="col" className="px-4 py-3 text-right font-medium tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {sentDocuments.map(doc => (
                <tr key={doc.id} className={`${ui.tableRow} ${ui.border} hover:${ui.tableRowHover}`}>
                  <td className={`px-4 py-3 font-medium whitespace-nowrap ${ui.textPrimary}`}>{doc.name}</td>
                  <td className="px-4 py-3">{doc.lexoffice ? formatDate(doc.lexoffice.sentAt) : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {doc.lexoffice && <StatusBadge status={doc.lexoffice.status} />}
                  </td>
                </tr>
              ))}
              {sentDocuments.length === 0 && (
                <tr>
                    <td colSpan={3} className={`text-center py-6 ${ui.textMuted}`}>
                        Bisher wurden keine Belege an Lexoffice gesendet.
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LexofficeView;