import { useTheme } from '../App';

/**
 * Liefert vereinheitlichte Tailwind Utility Token für Light/Dark Mode,
 * um wiederholte Klassenketten (z.B. bg-* / dark:bg-*) zu reduzieren.
 * Verwendung: const ui = useThemeClasses(); <div className={ui.card}>...</div>
 */
export const useThemeClasses = () => {
  // Zugriff aktuell nur nötig falls später themenabhängige Berechnung erfolgt
  useTheme();
  const base = {
    surface: 'bg-white dark:bg-slate-900',
    surfaceSubtle: 'bg-slate-50 dark:bg-slate-900/60',
    card: 'bg-white dark:bg-slate-800',
    cardRaised: 'bg-white dark:bg-slate-800 shadow-sm',
    cardAlt: 'bg-slate-100 dark:bg-slate-800/70',
  // Layout
  layout: 'bg-slate-50 dark:bg-slate-900',
  layoutAlt: 'bg-white dark:bg-slate-800',
  sidebar: 'bg-white dark:bg-slate-800',
  headerBar: 'bg-white dark:bg-slate-800',
  scrollArea: 'bg-slate-50 dark:bg-slate-900/50',
  panelSubtle: 'bg-slate-50 dark:bg-slate-900/60',
    border: 'border-slate-200 dark:border-slate-700',
    borderStrong: 'border-slate-300 dark:border-slate-600',
    textPrimary: 'text-slate-800 dark:text-slate-100',
    textSecondary: 'text-slate-600 dark:text-slate-300',
    textMuted: 'text-slate-500 dark:text-slate-400',
    badge: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    input: 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500',
    textarea: 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500',
    buttonSecondary: 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200',
    buttonGhost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400',
  buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500',
    divider: 'border-b border-slate-200 dark:border-slate-700',
    ringFocus: 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
  // Navigation
  navItem: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100',
  navItemActive: 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold',
  navItemCount: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  navItemCountActive: 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200',
  // Chips / Filter
  chip: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
  chipActive: 'bg-blue-600 text-white border border-blue-600 dark:border-blue-500',
  // Tabellen
  tableHeader: 'text-xs uppercase bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300',
  tableRow: 'bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700',
  tableRowHover: 'hover:bg-slate-50 dark:hover:bg-slate-700/70',
  // Status / Semantic
  statusPositiveBg: 'bg-green-50 dark:bg-green-900/40',
  statusPositiveText: 'text-green-600 dark:text-green-400',
  statusNegativeBg: 'bg-red-50 dark:bg-red-900/40',
  statusNegativeText: 'text-red-600 dark:text-red-400',
  statusWarningBg: 'bg-amber-50 dark:bg-amber-900/40',
  statusWarningText: 'text-amber-600 dark:text-amber-400',
  statusInfoBg: 'bg-blue-50 dark:bg-blue-900/40',
  statusInfoText: 'text-blue-600 dark:text-blue-400',
  listRow: 'bg-white dark:bg-slate-800',
  listRowHover: 'hover:bg-slate-50 dark:hover:bg-slate-700/70',
  listRowSelected: 'bg-blue-50 dark:bg-blue-900/30',
  } as const;
  return base;
};

export type ThemeClasses = ReturnType<typeof useThemeClasses>;
