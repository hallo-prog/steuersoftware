import { Task, TaskStatus, TaskPriority, Document, ExtractedDeadline } from '../types';

// Task management service for AI-generated tasks (FR-06)
export class TaskService {
  private tasks: Task[] = [];
  private listeners: ((tasks: Task[]) => void)[] = [];

  // Add a listener for task updates
  addListener(listener: (tasks: Task[]) => void) {
    this.listeners.push(listener);
  }

  // Remove a listener
  removeListener(listener: (tasks: Task[]) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Notify all listeners of task changes
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.tasks));
  }

  // Get all tasks
  getTasks(): Task[] {
    return [...this.tasks];
  }

  // Get tasks by status
  getTasksByStatus(status: TaskStatus): Task[] {
    return this.tasks.filter(task => task.status === status);
  }

  // Get tasks by document ID
  getTasksByDocument(documentId: string): Task[] {
    return this.tasks.filter(task => task.documentId === documentId);
  }

  // Get tasks that AI can handle autonomously
  getAutonomousCapableTasks(): Task[] {
    return this.tasks.filter(task => task.canAiHandle && task.status === TaskStatus.PENDING);
  }

  // Create a new task
  createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const task: Task = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.tasks.push(task);
    this.notifyListeners();
    return task;
  }

  // Update a task
  updateTask(taskId: string, updates: Partial<Task>): Task | null {
    const taskIndex = this.tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return null;

    const updatedTask = {
      ...this.tasks[taskIndex],
      ...updates,
      updatedAt: new Date(),
    };
    
    this.tasks[taskIndex] = updatedTask;
    this.notifyListeners();
    return updatedTask;
  }

  // Delete a task
  deleteTask(taskId: string): boolean {
    const taskIndex = this.tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return false;

    this.tasks.splice(taskIndex, 1);
    this.notifyListeners();
    return true;
  }

  // Complete a task
  completeTask(taskId: string): Task | null {
    return this.updateTask(taskId, { 
      status: TaskStatus.COMPLETED,
      updatedAt: new Date(),
    });
  }

  // Generate tasks from document analysis (AI-powered)
  async generateTasksFromDocument(
    document: Document, 
    apiKey: string,
    assignedTo?: string
  ): Promise<Task[]> {
    // This would call the AI to analyze the document and suggest tasks
    // For now, implementing basic task generation based on document type
    const generatedTasks: Task[] = [];

    try {
      // Basic task generation based on document characteristics
      if (document.invoiceType === 'Eingangsrechnung' && document.totalAmount) {
        const paymentTask = this.createTask({
          title: `Rechnung bezahlen: ${document.vendor || 'Unbekannt'}`,
          description: `Rechnung über ${document.totalAmount.toFixed(2)}€ von ${document.vendor || 'Unbekannt'} bezahlen`,
          status: TaskStatus.PENDING,
          priority: document.totalAmount > 1000 ? TaskPriority.HIGH : TaskPriority.MEDIUM,
          dueDate: this.calculatePaymentDueDate(document.date),
          documentId: document.id,
          assignedTo,
          createdBy: 'ai',
          aiSuggestion: 'Diese Rechnung sollte bezahlt werden um Mahngebühren zu vermeiden',
          canAiHandle: false, // Payment requires manual action
          tags: ['payment', 'invoice'],
        });
        generatedTasks.push(paymentTask);
      }

      // Generate tasks for document deadlines if any are extracted
      if (document.extractedDeadlines) {
        for (const deadline of document.extractedDeadlines) {
          const deadlineTask = this.createTask({
            title: `Frist einhalten: ${deadline.type}`,
            description: deadline.description,
            status: TaskStatus.PENDING,
            priority: this.calculateDeadlinePriority(deadline.dueDate),
            dueDate: deadline.dueDate,
            documentId: document.id,
            assignedTo,
            createdBy: 'ai',
            aiSuggestion: `Frist am ${deadline.dueDate.toLocaleDateString('de-DE')} einhalten`,
            canAiHandle: this.canAiHandleDeadlineTask(deadline.type),
            tags: ['deadline', deadline.type.toLowerCase()],
          });
          generatedTasks.push(deadlineTask);
        }
      }

      return generatedTasks;
    } catch (error) {
      console.error('Error generating tasks from document:', error);
      return [];
    }
  }

  // Helper method to calculate payment due date (typically 30 days)
  private calculatePaymentDueDate(invoiceDate: Date): Date {
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
  }

  // Helper method to calculate deadline priority based on due date
  private calculateDeadlinePriority(dueDate: Date): TaskPriority {
    const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue <= 1) return TaskPriority.URGENT;
    if (daysUntilDue <= 7) return TaskPriority.HIGH;
    if (daysUntilDue <= 30) return TaskPriority.MEDIUM;
    return TaskPriority.LOW;
  }

  // Helper method to determine if AI can handle a deadline task autonomously
  private canAiHandleDeadlineTask(deadlineType: string): boolean {
    // AI can handle simple confirmation emails but not complex legal actions
    const aiCapableTypes = ['zahlungsbestätigung', 'empfangsbestätigung', 'rückfrage'];
    return aiCapableTypes.some(type => deadlineType.toLowerCase().includes(type));
  }

  // Get upcoming tasks (due within next 7 days)
  getUpcomingTasks(): Task[] {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    return this.tasks
      .filter(task => 
        task.status !== TaskStatus.COMPLETED &&
        task.status !== TaskStatus.CANCELLED &&
        task.dueDate &&
        task.dueDate <= sevenDaysFromNow
      )
      .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));
  }

  // Get overdue tasks
  getOverdueTasks(): Task[] {
    const now = new Date();
    return this.tasks
      .filter(task => 
        task.status !== TaskStatus.COMPLETED &&
        task.status !== TaskStatus.CANCELLED &&
        task.dueDate &&
        task.dueDate < now
      )
      .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));
  }
}

// Singleton instance
export const taskService = new TaskService();