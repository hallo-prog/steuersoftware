import React from 'react';

interface GlobalLoaderProps {
  show: boolean;
  message?: string;
}

const GlobalLoader: React.FC<GlobalLoaderProps> = ({ show, message }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-xl shadow-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
        <div className="h-10 w-10 relative animate-spin">
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 border-t-blue-600" />
        </div>
        <div className="text-xs font-medium text-slate-600 dark:text-slate-300">{message || 'Lade...'}</div>
      </div>
    </div>
  );
};

export default GlobalLoader;