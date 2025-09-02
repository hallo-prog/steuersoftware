import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority } from '../types';
import { taskService } from '../services/taskService';
import { auditService } from '../services/auditService';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { CheckCircleIcon, ClockIcon, AlertTriangleIcon, UserIcon, CalendarIcon, FlagIcon } from './icons';

interface TasksViewProps {
  onViewDocument?: (documentId: string) => void;
}

const TasksView: React.FC<TasksViewProps> = ({ onViewDocument }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | TaskStatus | 'overdue' | 'upcoming'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'created'>('dueDate');
  const [showCompleted, setShowCompleted] = useState(false);
  const ui = useThemeClasses();

  useEffect(() => {
    // Load tasks and subscribe to updates
    setTasks(taskService.getTasks());
    
    const handleTaskUpdate = (updatedTasks: Task[]) => {
      setTasks(updatedTasks);
    };

    taskService.addListener(handleTaskUpdate);
    return () => taskService.removeListener(handleTaskUpdate);
  }, []);

  // Filter tasks based on selected filter
  const filteredTasks = tasks.filter(task => {
    if (!showCompleted && task.status === TaskStatus.COMPLETED) return false;
    
    switch (filter) {
      case 'all':
        return true;
      case 'overdue':
        return task.dueDate && task.dueDate < new Date() && task.status !== TaskStatus.COMPLETED;
      case 'upcoming':
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        return task.dueDate && task.dueDate <= sevenDaysFromNow && task.status !== TaskStatus.COMPLETED;
      default:
        return task.status === filter;
    }
  });

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    switch (sortBy) {
      case 'dueDate':
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      case 'priority':
        const priorityOrder = { [TaskPriority.URGENT]: 4, [TaskPriority.HIGH]: 3, [TaskPriority.MEDIUM]: 2, [TaskPriority.LOW]: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      case 'created':
        return b.createdAt.getTime() - a.createdAt.getTime();
      default:
        return 0;
    }
  });

  const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
    taskService.updateTask(taskId, updates);
    auditService.logAction('task_updated', 'task', taskId, updates, true);
  };

  const handleCompleteTask = (taskId: string) => {
    taskService.completeTask(taskId);
    auditService.logAction('task_completed', 'task', taskId, {}, true);
  };

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('Möchten Sie diese Aufgabe wirklich löschen?')) {
      taskService.deleteTask(taskId);
      auditService.logAction('task_deleted', 'task', taskId, {}, true);
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT: return 'text-red-600 bg-red-50';
      case TaskPriority.HIGH: return 'text-orange-600 bg-orange-50';
      case TaskPriority.MEDIUM: return 'text-yellow-600 bg-yellow-50';
      case TaskPriority.LOW: return 'text-green-600 bg-green-50';
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED: return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case TaskStatus.IN_PROGRESS: return <ClockIcon className="w-5 h-5 text-blue-600" />;
      case TaskStatus.CANCELLED: return <AlertTriangleIcon className="w-5 h-5 text-red-600" />;
      default: return <ClockIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const isOverdue = (task: Task) => {
    return task.dueDate && task.dueDate < new Date() && task.status !== TaskStatus.COMPLETED;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-3xl font-bold ${ui.textPrimary}`}>Aufgaben</h2>
        <p className={`${ui.textMuted} mt-1`}>
          Übersicht aller Aufgaben aus Dokumentenanalyse und manueller Eingabe
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${ui.card} p-4 rounded-lg ${ui.border}`}>
          <div className="text-2xl font-bold text-blue-600">{tasks.filter(t => t.status === TaskStatus.PENDING).length}</div>
          <div className={`text-sm ${ui.textMuted}`}>Offen</div>
        </div>
        <div className={`${ui.card} p-4 rounded-lg ${ui.border}`}>
          <div className="text-2xl font-bold text-orange-600">{taskService.getOverdueTasks().length}</div>
          <div className={`text-sm ${ui.textMuted}`}>Überfällig</div>
        </div>
        <div className={`${ui.card} p-4 rounded-lg ${ui.border}`}>
          <div className="text-2xl font-bold text-yellow-600">{taskService.getUpcomingTasks().length}</div>
          <div className={`text-sm ${ui.textMuted}`}>Diese Woche</div>
        </div>
        <div className={`${ui.card} p-4 rounded-lg ${ui.border}`}>
          <div className="text-2xl font-bold text-green-600">{tasks.filter(t => t.status === TaskStatus.COMPLETED).length}</div>
          <div className={`text-sm ${ui.textMuted}`}>Erledigt</div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <select 
          value={filter} 
          onChange={(e) => setFilter(e.target.value as any)}
          className={`px-3 py-2 rounded-lg text-sm ${ui.input}`}
        >
          <option value="all">Alle Aufgaben</option>
          <option value="overdue">Überfällig</option>
          <option value="upcoming">Diese Woche</option>
          <option value={TaskStatus.PENDING}>Offen</option>
          <option value={TaskStatus.IN_PROGRESS}>In Bearbeitung</option>
          <option value={TaskStatus.COMPLETED}>Erledigt</option>
        </select>

        <select 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value as any)}
          className={`px-3 py-2 rounded-lg text-sm ${ui.input}`}
        >
          <option value="dueDate">Nach Fälligkeitsdatum</option>
          <option value="priority">Nach Priorität</option>
          <option value="created">Nach Erstellungsdatum</option>
        </select>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded"
          />
          <span className={`text-sm ${ui.textSecondary}`}>Erledigte anzeigen</span>
        </label>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {sortedTasks.length === 0 ? (
          <div className={`${ui.card} p-8 text-center rounded-lg ${ui.border}`}>
            <p className={`${ui.textMuted}`}>Keine Aufgaben entsprechen den aktuellen Filterkriterien.</p>
          </div>
        ) : (
          sortedTasks.map(task => (
            <div key={task.id} className={`${ui.card} p-4 rounded-lg ${ui.border} ${isOverdue(task) ? 'border-red-300 bg-red-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getStatusIcon(task.status)}
                    <h3 className={`font-semibold ${ui.textPrimary} ${task.status === TaskStatus.COMPLETED ? 'line-through text-opacity-60' : ''}`}>
                      {task.title}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                  
                  <p className={`text-sm ${ui.textSecondary} mb-3`}>{task.description}</p>
                  
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    {task.dueDate && (
                      <div className="flex items-center space-x-1">
                        <CalendarIcon className="w-4 h-4" />
                        <span className={isOverdue(task) ? 'text-red-600 font-medium' : ''}>
                          {task.dueDate.toLocaleDateString('de-DE')}
                          {isOverdue(task) && ' (Überfällig)'}
                        </span>
                      </div>
                    )}
                    
                    {task.createdBy === 'ai' && (
                      <div className="flex items-center space-x-1 text-blue-600">
                        <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-xs font-bold">KI</span>
                        </div>
                        <span>KI-generiert</span>
                      </div>
                    )}

                    {task.documentId && (
                      <button
                        onClick={() => onViewDocument?.(task.documentId!)}
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        Dokument anzeigen
                      </button>
                    )}

                    {task.tags && task.tags.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <FlagIcon className="w-4 h-4" />
                        <span>{task.tags.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {task.aiSuggestion && (
                    <div className={`mt-3 p-2 rounded-lg ${ui.accent} text-sm`}>
                      <strong>KI-Begründung:</strong> {task.aiSuggestion}
                      {task.canAiHandle && task.aiActionSuggestion && (
                        <div className="mt-1">
                          <strong>Vorgeschlagene Aktion:</strong> {task.aiActionSuggestion}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col space-y-2 ml-4">
                  {task.status !== TaskStatus.COMPLETED && (
                    <select
                      value={task.status}
                      onChange={(e) => handleUpdateTask(task.id, { status: e.target.value as TaskStatus })}
                      className="text-xs px-2 py-1 rounded border"
                    >
                      <option value={TaskStatus.PENDING}>Offen</option>
                      <option value={TaskStatus.IN_PROGRESS}>In Bearbeitung</option>
                      <option value={TaskStatus.COMPLETED}>Erledigt</option>
                      <option value={TaskStatus.CANCELLED}>Abgebrochen</option>
                    </select>
                  )}
                  
                  {task.status !== TaskStatus.COMPLETED && (
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Erledigt
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Autonomous Actions Section */}
      {taskService.getAutonomousCapableTasks().length > 0 && (
        <div className={`${ui.card} p-6 rounded-lg ${ui.border}`}>
          <h3 className={`text-lg font-semibold ${ui.textPrimary} mb-4`}>
            KI-Aktionen verfügbar ({taskService.getAutonomousCapableTasks().length})
          </h3>
          <p className={`text-sm ${ui.textMuted} mb-4`}>
            Diese Aufgaben kann die KI möglicherweise automatisch erledigen. Prüfen Sie die Vorschläge und bestätigen Sie gewünschte Aktionen.
          </p>
          <div className="space-y-2">
            {taskService.getAutonomousCapableTasks().slice(0, 3).map(task => (
              <div key={task.id} className={`p-3 rounded-lg ${ui.accent}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-medium ${ui.textPrimary}`}>{task.title}</div>
                    <div className={`text-sm ${ui.textMuted}`}>{task.aiActionSuggestion}</div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={() => {
                        // This would trigger autonomous action in a full implementation
                        alert('KI-Aktion würde hier ausgeführt werden');
                        auditService.logAutonomousAction('suggested_action', task.id, { action: task.aiActionSuggestion }, true);
                      }}
                    >
                      KI ausführen lassen
                    </button>
                    <button
                      className="text-xs px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      onClick={() => handleUpdateTask(task.id, { canAiHandle: false })}
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksView;