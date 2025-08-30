import React, { useState, useMemo } from 'react';
import { Document, LexofficeStatus } from '../types';
import LexofficeIcon from './icons/LexofficeIcon';

interface LexofficeViewProps {
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  lexofficeApiKey: string;
}

const StatusBadge: React.FC<{ status: LexofficeStatus }> = ({ status }) => {
    const statusStyles = {
        [LexofficeStatus.SUCCESS]: 'bg-green-100 text-green-800',
        [LexofficeStatus.FAILED]: 'bg-red-100 text-red-800',
        [LexofficeStatus.NOT_SENT]: 'bg-slate-100 text-slate-800',
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>{status}</span>;
}

const LexofficeView: React.FC<LexofficeViewProps> = ({ documents, setDocuments, lexofficeApiKey }) => {
  const today = new Date();
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
        <h2 className="text-3xl font-bold text-slate-800">An LexOffice senden</h2>
        <p className="text-slate-500 mt-1">Übertragen Sie Belege aus einem ausgewählten Zeitraum gesammelt an Ihr LexOffice-Konto.</p>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">1. Zeitraum auswählen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-slate-700">Startdatum</label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-slate-700">Enddatum</label>
            <input
              type="date"
              id="end-date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">2. Übertragung starten</h3>
        <div className="p-4 bg-slate-50 rounded-lg text-center">
            <p className="text-slate-600">
                <span className="font-bold text-2xl text-blue-600">{documentsToSend.length}</span> Beleg(e) im ausgewählten Zeitraum zum Senden bereit.
            </p>
        </div>
        {isSending && (
            <div className="mt-4">
                <p className="text-sm text-slate-600 text-center mb-2">
                    Übertrage Beleg {progress.current} von {progress.total}...
                </p>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                </div>
            </div>
        )}
        {feedback && (
          <div className={`p-3 mt-4 rounded-md text-sm ${feedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {feedback.message}
          </div>
        )}
        <button
          onClick={handleSendToLexoffice}
          disabled={isSending || documentsToSend.length === 0}
          className="w-full mt-4 flex items-center justify-center bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-300 shadow-sm disabled:bg-blue-300"
        >
          {isSending ? (
            'Übertragung läuft...'
          ) : (
            `Sende ${documentsToSend.length} Beleg(e) an LexOffice`
          )}
        </button>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Übertragungsverlauf</h3>
         <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3">Beleg</th>
                <th scope="col" className="px-4 py-3">Gesendet am</th>
                <th scope="col" className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {sentDocuments.map(doc => (
                <tr key={doc.id} className="bg-white border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{doc.name}</td>
                  <td className="px-4 py-3">{doc.lexoffice ? formatDate(doc.lexoffice.sentAt) : '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {doc.lexoffice && <StatusBadge status={doc.lexoffice.status} />}
                  </td>
                </tr>
              ))}
              {sentDocuments.length === 0 && (
                <tr>
                    <td colSpan={3} className="text-center py-6 text-slate-500">
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