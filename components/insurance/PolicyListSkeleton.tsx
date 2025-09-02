import React from 'react';

const PolicyListSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 animate-pulse">
      {Array.from({ length: 6 }).map((_,i)=>(
        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="flex gap-2 pt-2">
            <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default PolicyListSkeleton;
