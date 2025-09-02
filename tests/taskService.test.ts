import { describe, it, expect, beforeEach } from 'vitest';
import { TaskService } from '../services/taskService';
import { TaskStatus, TaskPriority, InvoiceType, DocumentSource, DocumentStatus, Document } from '../types';

describe('TaskService', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService();
  });

  describe('Task Management', () => {
    it('should create a new task', () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        createdBy: 'user' as const,
      };

      const task = taskService.createTask(taskData);

      expect(task).toBeDefined();
      expect(task.id).toMatch(/^task-/);
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should update an existing task', () => {
      const task = taskService.createTask({
        title: 'Original Title',
        description: 'Original Description',
        status: TaskStatus.PENDING,
        priority: TaskPriority.LOW,
        createdBy: 'user',
      });

      // Add a small delay to ensure different timestamp
      const start = Date.now();
      while (Date.now() - start < 2) {
        // Small busy wait to ensure different timestamp
      }

      const updatedTask = taskService.updateTask(task.id, {
        title: 'Updated Title',
        status: TaskStatus.IN_PROGRESS,
      });

      expect(updatedTask).toBeDefined();
      expect(updatedTask!.title).toBe('Updated Title');
      expect(updatedTask!.status).toBe(TaskStatus.IN_PROGRESS);
      expect(updatedTask!.description).toBe('Original Description'); // Unchanged
      expect(updatedTask!.updatedAt.getTime()).toBeGreaterThanOrEqual(updatedTask!.createdAt.getTime());
    });

    it('should complete a task', () => {
      const task = taskService.createTask({
        title: 'Test Task',
        description: 'Test Description',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        createdBy: 'user',
      });

      const completedTask = taskService.completeTask(task.id);

      expect(completedTask).toBeDefined();
      expect(completedTask!.status).toBe(TaskStatus.COMPLETED);
    });

    it('should delete a task', () => {
      const task = taskService.createTask({
        title: 'Test Task',
        description: 'Test Description',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        createdBy: 'user',
      });

      const deleted = taskService.deleteTask(task.id);
      expect(deleted).toBe(true);

      const tasks = taskService.getTasks();
      expect(tasks).not.toContainEqual(expect.objectContaining({ id: task.id }));
    });
  });

  describe('Task Generation from Documents', () => {
    it('should generate payment task for incoming invoice', async () => {
      const mockDocument: Document = {
        id: 'doc-123',
        name: 'Test Invoice',
        date: new Date(),
        year: 2024,
        quarter: 1,
        source: DocumentSource.MANUAL,
        status: DocumentStatus.OK,
        fileUrl: 'http://example.com/doc.pdf',
        invoiceType: InvoiceType.INCOMING,
        vendor: 'Test Vendor',
        totalAmount: 500,
        vatAmount: 95,
        invoiceNumber: 'INV-001',
      };

      const tasks = await taskService.generateTasksFromDocument(mockDocument, 'test-api-key', 'user-123');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toContain('Rechnung bezahlen');
      expect(tasks[0].title).toContain('Test Vendor');
      expect(tasks[0].priority).toBe(TaskPriority.MEDIUM);
      expect(tasks[0].createdBy).toBe('ai');
      expect(tasks[0].documentId).toBe('doc-123');
    });

    it('should generate high priority task for large invoice', async () => {
      const mockDocument: Document = {
        id: 'doc-456',
        name: 'Large Invoice',
        date: new Date(),
        year: 2024,
        quarter: 1,
        source: DocumentSource.MANUAL,
        status: DocumentStatus.OK,
        fileUrl: 'http://example.com/doc.pdf',
        invoiceType: InvoiceType.INCOMING,
        vendor: 'Expensive Vendor',
        totalAmount: 2500, // > 1000
        vatAmount: 475,
        invoiceNumber: 'INV-002',
      };

      const tasks = await taskService.generateTasksFromDocument(mockDocument, 'test-api-key', 'user-123');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].priority).toBe(TaskPriority.HIGH);
    });
  });

  describe('Task Filtering and Sorting', () => {
    beforeEach(() => {
      // Create some test tasks
      taskService.createTask({
        title: 'Urgent Task',
        description: 'Very important',
        status: TaskStatus.PENDING,
        priority: TaskPriority.URGENT,
        dueDate: new Date(Date.now() + 86400000), // 1 day from now
        createdBy: 'user',
      });

      taskService.createTask({
        title: 'Completed Task',
        description: 'Already done',
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.MEDIUM,
        createdBy: 'ai',
      });

      taskService.createTask({
        title: 'Overdue Task',
        description: 'Should have been done',
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        dueDate: new Date(Date.now() - 86400000), // 1 day ago
        createdBy: 'ai',
        canAiHandle: true,
      });
    });

    it('should filter tasks by status', () => {
      const pendingTasks = taskService.getTasksByStatus(TaskStatus.PENDING);
      const completedTasks = taskService.getTasksByStatus(TaskStatus.COMPLETED);

      expect(pendingTasks).toHaveLength(2);
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].title).toBe('Completed Task');
    });

    it('should get upcoming tasks', () => {
      const upcomingTasks = taskService.getUpcomingTasks();
      
      expect(upcomingTasks).toHaveLength(2); // Urgent task (1 day) + Overdue task (past due)
      expect(upcomingTasks[0].title).toBe('Overdue Task'); // Should be first (most overdue)
      expect(upcomingTasks[1].title).toBe('Urgent Task');
    });

    it('should get overdue tasks', () => {
      const overdueTasks = taskService.getOverdueTasks();
      
      expect(overdueTasks).toHaveLength(1);
      expect(overdueTasks[0].title).toBe('Overdue Task');
    });

    it('should get autonomous capable tasks', () => {
      const autonomousTasks = taskService.getAutonomousCapableTasks();
      
      expect(autonomousTasks).toHaveLength(1);
      expect(autonomousTasks[0].title).toBe('Overdue Task');
      expect(autonomousTasks[0].canAiHandle).toBe(true);
    });
  });

  describe('Task Listeners', () => {
    it('should notify listeners when tasks change', () => {
      let notificationReceived = false;
      let receivedTasks: any[] = [];

      const listener = (tasks: any[]) => {
        notificationReceived = true;
        receivedTasks = tasks;
      };

      taskService.addListener(listener);

      const task = taskService.createTask({
        title: 'Listener Test',
        description: 'Testing listener functionality',
        status: TaskStatus.PENDING,
        priority: TaskPriority.LOW,
        createdBy: 'user',
      });

      expect(notificationReceived).toBe(true);
      expect(receivedTasks).toHaveLength(1);
      expect(receivedTasks[0].title).toBe('Listener Test');

      taskService.removeListener(listener);
    });
  });
});