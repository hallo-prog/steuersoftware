import React from 'react';
import { Document, DocumentStatus, LexofficeStatus } from '../types';
import FileIcon from './icons/FileIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import CameraIcon from './icons/CameraIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import CopyIcon from './icons/CopyIcon';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface DocumentItemProps {
  document: Document;
  onSelect: (document: Document) => void;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onSendToLexoffice: (id: string) => void;
  isSendingToLexoffice: boolean;
}

const DocumentItem: React.FC<DocumentItemProps> = ({ document, onSelect, isSelected, onToggleSelection, onSendToLexoffice, isSendingToLexoffice }) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };
  
  const getStatusInfo = () => {
    switch(document.status) {
      case DocumentStatus.OK:
        return { icon: <CheckCircleIcon className="w-4 h-4 text-green-500" />, text: 'OK', color: 'text-green-700', tooltip: '' };
      case DocumentStatus.MISSING_INVOICE:
        return { icon: <AlertTriangleIcon className="w-4 h-4 text-yellow-500" />, text: 'Rechnung fehlt', color: 'text-yellow-700', tooltip: 'Dies ist nur eine Bestellbestätigung. Die Originalrechnung fehlt.' };
      case DocumentStatus.SCREENSHOT:
        return { icon: <CameraIcon className="w-4 h-4 text-blue-500" />, text: 'Screenshot', color: 'text-blue-700', tooltip: 'Dieser Beleg ist ein Screenshot und keine PDF-Rechnung.' };
      case DocumentStatus.ANALYZING:
        return { icon: <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500"></div>, text: 'Analysiere...', color: 'text-slate-500', tooltip: '' };
      case DocumentStatus.POTENTIAL_DUPLICATE:
        return { icon: <CopyIcon className="w-4 h-4 text-orange-500" />, text: 'Mögliches Duplikat', color: 'text-orange-700', tooltip: 'Ein Beleg mit gleicher Rechnungsnummer oder gleichem Betrag und Datum existiert bereits.' };
      case DocumentStatus.ERROR:
        return { icon: <AlertTriangleIcon className="w-4 h-4 text-red-500" />, text: 'Fehler', color: 'text-red-700', tooltip: document.errorMessage || 'Bei der Analyse ist ein Fehler aufgetreten.' };
      case DocumentStatus.ARCHIVED:
        return { icon: null, text: 'Archiviert', color: 'text-slate-500', tooltip: 'Dieses Dokument ist archiviert.' };
      default:
        return { icon: null, text: '', color: '', tooltip: '' };
    }
  };
  
  const statusInfo = getStatusInfo();
  const lexofficeStatus = document.lexoffice?.status;

  const handleCheckboxClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleSelection(document.id);
  };

  const handleItemClick = () => {
     if (document.status !== DocumentStatus.ANALYZING) {
        onSelect(document);
     }
  }

  const ui = useThemeClasses();
  return (
    <div 
      className={`transition-colors ${isSelected ? ui.listRowSelected : ui.listRow + ' ' + ui.listRowHover} ${document.status !== DocumentStatus.ANALYZING ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={handleItemClick}
    >
      <div className={`flex items-center justify-between p-3 border-b ${ui.border}`}>
        <div className="flex items-center min-w-0 flex-grow">
          <input 
            type="checkbox"
            className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mr-4 flex-shrink-0"
            checked={isSelected}
            onChange={() => onToggleSelection(document.id)}
            onClick={handleCheckboxClick}
            aria-label={`Select document ${document.name}`}
          />
          <FileIcon className="w-5 h-5 mr-4 text-blue-500 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className={`text-sm font-medium truncate ${ui.textPrimary}`}>
              {document.name}
            </span>
            {document.storageProvider && (
              <span className={`mt-0.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide ${document.storageProvider==='r2' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'}`}
                title={`Speicher: ${document.storageProvider==='r2' ? 'Cloudflare R2' : 'Supabase Storage'}`}
              >{document.storageProvider==='r2' ? 'R2' : 'SB'}</span>
            )}
            <span className={`text-xs ${ui.textMuted}`}>
              {formatDate(document.date)} &bull; {document.source}
            </span>
          </div>
        </div>
  <div className="hidden sm:flex items-center ml-4 space-x-4 flex-shrink-0">
           <div className="w-28 text-right">
             {isSendingToLexoffice ? (
                <div className={`flex items-center justify-end text-xs ${ui.textMuted}`}>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500 mr-2"></div>
                    Sende...
                </div>
              ) : lexofficeStatus === LexofficeStatus.SUCCESS ? (
                <div className="flex items-center justify-end text-xs font-medium text-green-700" title={`Gesendet am ${document.lexoffice?.sentAt.toLocaleString('de-DE')}`}>
                    <CheckCircleIcon className="w-4 h-4 mr-1.5"/>
                    Gesendet
                </div>
              ) : lexofficeStatus === LexofficeStatus.FAILED ? (
                 <div className="flex items-center justify-end text-xs font-medium text-red-700" title={`Fehler am ${document.lexoffice?.sentAt.toLocaleString('de-DE')}`}>
                    <AlertTriangleIcon className="w-4 h-4 mr-1.5"/>
                    Fehler
                </div>
              ) : (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendToLexoffice(document.id);
                  }}
                  className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-semibold py-1 px-3 rounded-full transition-colors"
                  title="Diesen Beleg an LexOffice senden"
                >
                  Senden
                </button>
              )}
           </div>
            <div className="flex flex-col items-end gap-1 w-40">
              <div className={`flex items-center text-xs font-medium ${statusInfo.color} w-full justify-start`} title={statusInfo.tooltip}>
                  {statusInfo.icon && <span className="mr-1.5">{statusInfo.icon}</span>}
                  <span className="truncate">{statusInfo.text}</span>
              </div>
              {(document.aiSuggestedTaxCategory || (document.flags&&document.flags.length) || document.anomalyScore!=null) && (
        <div className="flex flex-wrap gap-1 justify-end">
                  {document.aiSuggestedTaxCategory && (
          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-semibold" title="KI vorgeschlagene Kategorie">{document.aiSuggestedTaxCategory}</span>
                  )}
                  {document.flags && document.flags.map(f => (
          <span key={f} className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-medium" title="Hinweis / Flag">{f}</span>
                  ))}
      {document.anomalyScore!=null && Number.isFinite(document.anomalyScore) && (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${document.anomalyScore>0.7?'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400':document.anomalyScore>0.4?'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300':'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'}`} title={`Anomalie-Score ${Number.isFinite(document.anomalyScore)?(document.anomalyScore*100).toFixed(0):'?'}%`}>A{Number.isFinite(document.anomalyScore)?(document.anomalyScore*100).toFixed(0):'?'}%</span>
      )}
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentItem;