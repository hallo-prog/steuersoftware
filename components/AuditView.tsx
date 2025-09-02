import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '../types';
import { auditService } from '../services/auditService';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { SearchIcon, FilterIcon, DownloadIcon, CheckCircleIcon, AlertTriangleIcon } from './icons';

const AuditView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterSuccess, setFilterSuccess] = useState<string>('all');
  const [filterAiModel, setFilterAiModel] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<any>({});
  const ui = useThemeClasses();

  useEffect(() => {
    loadLogs();
    loadStatistics();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchQuery, filterAction, filterSuccess, filterAiModel]);

  const loadLogs = () => {
    const allLogs = auditService.getAllLogs();
    setLogs(allLogs);
  };

  const loadStatistics = () => {
    const stats = auditService.getStatistics();
    setStatistics(stats);
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = auditService.searchLogs(searchQuery);
    }

    // Apply action filter
    if (filterAction !== 'all') {
      filtered = filtered.filter(log => log.action === filterAction);
    }

    // Apply success filter
    if (filterSuccess !== 'all') {
      const isSuccess = filterSuccess === 'success';
      filtered = filtered.filter(log => log.success === isSuccess);
    }

    // Apply AI model filter
    if (filterAiModel !== 'all') {
      filtered = filtered.filter(log => log.aiModel === filterAiModel);
    }

    setFilteredLogs(filtered);
  };

  const handleExportLogs = () => {
    const jsonStr = auditService.exportLogs();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(timestamp));
  };

  const getActionColor = (action: string) => {
    if (action.includes('created')) return 'text-green-600 bg-green-50';
    if (action.includes('updated')) return 'text-blue-600 bg-blue-50';
    if (action.includes('deleted')) return 'text-red-600 bg-red-50';
    if (action.includes('autonomous')) return 'text-purple-600 bg-purple-50';
    if (action.includes('analysis')) return 'text-indigo-600 bg-indigo-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getUniqueActions = () => {
    return Array.from(new Set(logs.map(log => log.action))).sort();
  };

  const getUniqueAiModels = () => {
    return Array.from(new Set(logs.map(log => log.aiModel).filter(Boolean))).sort();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${ui.textPrimary}`}>Audit-Log</h2>
        <p className={`${ui.textMuted} mt-1`}>
          Protokoll aller KI-Aktionen und Systemereignisse für Nachverfolgbarkeit und Compliance
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className={`${ui.card} p-4 rounded-lg ${ui.border}`}>
          <div className="text-2xl font-bold text-blue-600">{statistics.totalLogs || 0}</div>
          <div className={`text-sm ${ui.textMuted}`}>Gesamt</div>
        </div>
        <div className={`${ui.card} p-4 rounded-lg ${ui.border}`}>
          <div className="text-2xl font-bold text-green-600">{(statistics.totalLogs || 0) - (statistics.failedActions || 0)}</div>
          <div className={`text-sm ${ui.textMuted}`}>Erfolgreich</div>
        </div>
        <div className={`${ui.card} p-4 rounded-lg ${ui.border}`}>
          <div className="text-2xl font-bold text-red-600">{statistics.failedActions || 0}</div>
          <div className={`text-sm ${ui.textMuted}`}>Fehler</div>
        </div>
        <div className={`${ui.card} p-4 rounded-lg ${ui.border}`}>
          <div className="text-2xl font-bold text-purple-600">{statistics.successRate || '100%'}</div>
          <div className={`text-sm ${ui.textMuted}`}>Erfolgsrate</div>
        </div>
        <div className={`${ui.card} p-4 rounded-lg ${ui.border}`}>
          <div className="text-2xl font-bold text-indigo-600">{Object.keys(statistics.aiModelUsage || {}).length}</div>
          <div className={`text-sm ${ui.textMuted}`}>KI-Modelle</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className={`${ui.card} p-4 rounded-lg ${ui.border}`}>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-64">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Logs durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 pr-3 py-2 w-full rounded-lg text-sm ${ui.input}`}
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm ${ui.input}`}
          >
            <option value="all">Alle Aktionen</option>
            {getUniqueActions().map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>

          <select
            value={filterSuccess}
            onChange={(e) => setFilterSuccess(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm ${ui.input}`}
          >
            <option value="all">Alle Status</option>
            <option value="success">Erfolgreich</option>
            <option value="failure">Fehler</option>
          </select>

          <select
            value={filterAiModel}
            onChange={(e) => setFilterAiModel(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm ${ui.input}`}
          >
            <option value="all">Alle KI-Modelle</option>
            {getUniqueAiModels().map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>

          <button
            onClick={handleExportLogs}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className={`${ui.card} rounded-lg ${ui.border} overflow-hidden`}>
        <div className="overflow-x-auto">
          <div className="max-h-96 overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center">
                <p className={`${ui.textMuted}`}>Keine Logs entsprechen den Filterkriterien.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className={`${ui.accent} sticky top-0 z-10`}>
                  <tr>
                    <th className={`px-4 py-3 text-left font-medium ${ui.textPrimary}`}>Zeitstempel</th>
                    <th className={`px-4 py-3 text-left font-medium ${ui.textPrimary}`}>Aktion</th>
                    <th className={`px-4 py-3 text-left font-medium ${ui.textPrimary}`}>Entität</th>
                    <th className={`px-4 py-3 text-left font-medium ${ui.textPrimary}`}>Status</th>
                    <th className={`px-4 py-3 text-left font-medium ${ui.textPrimary}`}>KI-Modell</th>
                    <th className={`px-4 py-3 text-left font-medium ${ui.textPrimary}`}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <React.Fragment key={log.id}>
                      <tr 
                        className={`${index % 2 === 0 ? ui.card : ui.accent} hover:bg-opacity-80 cursor-pointer`}
                        onClick={() => toggleLogExpansion(log.id)}
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {formatTimestamp(log.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <div className={`font-medium ${ui.textPrimary}`}>{log.entityType}</div>
                            <div className={`text-xs ${ui.textMuted} truncate`}>{log.entityId}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1">
                            {log.success ? (
                              <CheckCircleIcon className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertTriangleIcon className="w-4 h-4 text-red-600" />
                            )}
                            <span className={log.success ? 'text-green-600' : 'text-red-600'}>
                              {log.success ? 'Erfolg' : 'Fehler'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {log.aiModel ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              {log.aiModel}
                            </span>
                          ) : (
                            <span className={`text-xs ${ui.textMuted}`}>-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button className={`text-xs ${ui.link} hover:underline`}>
                            {expandedLogId === log.id ? 'Weniger' : 'Mehr'}
                          </button>
                        </td>
                      </tr>
                      {expandedLogId === log.id && (
                        <tr>
                          <td colSpan={6} className={`px-4 py-4 ${ui.accent}`}>
                            <div className="space-y-2">
                              {log.userId && (
                                <div>
                                  <strong>Benutzer:</strong> {log.userId}
                                </div>
                              )}
                              {log.errorMessage && (
                                <div className="text-red-600">
                                  <strong>Fehler:</strong> {log.errorMessage}
                                </div>
                              )}
                              {Object.keys(log.details).length > 0 && (
                                <div>
                                  <strong>Details:</strong>
                                  <pre className={`mt-1 p-2 rounded text-xs overflow-x-auto ${ui.code}`}>
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Most Common Actions */}
      {statistics.mostCommonActions && statistics.mostCommonActions.length > 0 && (
        <div className={`${ui.card} p-6 rounded-lg ${ui.border}`}>
          <h3 className={`text-lg font-semibold ${ui.textPrimary} mb-4`}>Häufigste Aktionen</h3>
          <div className="space-y-2">
            {statistics.mostCommonActions.slice(0, 5).map(([action, count]: [string, number]) => (
              <div key={action} className="flex items-center justify-between">
                <span className={`${ui.textSecondary}`}>{action}</span>
                <span className={`font-mono text-sm ${ui.textPrimary}`}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Model Usage */}
      {statistics.aiModelUsage && Object.keys(statistics.aiModelUsage).length > 0 && (
        <div className={`${ui.card} p-6 rounded-lg ${ui.border}`}>
          <h3 className={`text-lg font-semibold ${ui.textPrimary} mb-4`}>KI-Modell Nutzung</h3>
          <div className="space-y-2">
            {Object.entries(statistics.aiModelUsage).map(([model, count]) => (
              <div key={model} className="flex items-center justify-between">
                <span className={`${ui.textSecondary}`}>{model}</span>
                <span className={`font-mono text-sm ${ui.textPrimary}`}>{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditView;