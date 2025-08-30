import React from 'react';
import { Document, DocumentStatus, LexofficeStatus } from '../types';
import FileIcon from './icons/FileIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import CameraIcon from './icons/CameraIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import CopyIcon from './icons/CopyIcon';

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

  return (
    <div 
      className={`transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'} ${document.status !== DocumentStatus.ANALYZING ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={handleItemClick}
    >
      <div className="flex items-center justify-between p-3 border-b border-slate-200">
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
            <span className="text-sm font-medium text-slate-800 truncate">
              {document.name}
            </span>
            <span className="text-xs text-slate-500">
              {formatDate(document.date)} &bull; {document.source}
            </span>
          </div>
        </div>
        <div className="hidden sm:flex items-center ml-4 space-x-4 flex-shrink-0">
           <div className="w-28 text-right">
             {isSendingToLexoffice ? (
                <div className="flex items-center justify-end text-xs text-slate-500">
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
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold py-1 px-3 rounded-full transition-colors"
                  title="Diesen Beleg an LexOffice senden"
                >
                  Senden
                </button>
              )}
           </div>
            <div className={`flex items-center text-xs font-medium ${statusInfo.color} w-32 justify-start`} title={statusInfo.tooltip}>
                {statusInfo.icon && <span className="mr-1.5">{statusInfo.icon}</span>}
                <span className="truncate">{statusInfo.text}</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentItem;