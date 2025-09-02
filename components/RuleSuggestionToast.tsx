import React from 'react';
import { RuleSuggestion } from '../types';
import SparklesIcon from './icons/SparklesIcon';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface RuleSuggestionToastProps {
    suggestion: RuleSuggestion;
    onAccept: () => void;
    onDismiss: () => void;
}

const RuleSuggestionToast: React.FC<RuleSuggestionToastProps> = ({ suggestion, onAccept, onDismiss }) => {
    const ui = useThemeClasses();
    return (
    <div
        className={`fixed bottom-5 right-5 w-full max-w-md ${ui.card} ${ui.border} rounded-xl shadow-lg p-4 z-50 transition-colors`}
            role="alert"
            aria-live="assertive"
        >
            <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-full">
            <SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                </div>
                <div className="ml-3 flex-1">
            <p className={`text-sm font-semibold ${ui.textPrimary}`}>
                        Regel vorschlagen
                    </p>
            <p className={`mt-1 text-sm ${ui.textSecondary}`}>
                        Soll <strong className="font-bold">"{suggestion.vendor}"</strong> immer als <strong className="font-bold">"{suggestion.taxCategory}"</strong> kategorisiert werden?
                    </p>
                    <div className="mt-3 flex space-x-2">
                        <button
                            onClick={onAccept}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Regel erstellen
                        </button>
                        <button
                            onClick={onDismiss}
                className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md ${ui.buttonSecondary} border border-transparent`}
                        >
                            Verwerfen
                        </button>
                    </div>
                </div>
                <div className="ml-4 flex-shrink-0 flex">
            <button onClick={onDismiss} className="inline-flex text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-300">
                        <span className="sr-only">Close</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RuleSuggestionToast;