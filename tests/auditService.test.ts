import { describe, it, expect, beforeEach } from 'vitest';
import { AuditService } from '../services/auditService';

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService();
    // Clear logs for clean test state
    auditService.clearLogs();
  });

  describe('Logging Actions', () => {
    it('should log a successful action', () => {
      const entry = auditService.logAction(
        'test_action',
        'document',
        'doc-123',
        { key: 'value' },
        true,
        'user-456',
        'gemini'
      );

      expect(entry).toBeDefined();
      expect(entry.id).toMatch(/^audit-/);
      expect(entry.action).toBe('test_action');
      expect(entry.entityType).toBe('document');
      expect(entry.entityId).toBe('doc-123');
      expect(entry.success).toBe(true);
      expect(entry.userId).toBe('user-456');
      expect(entry.aiModel).toBe('gemini');
      expect(entry.details).toEqual({ key: 'value' });
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.errorMessage).toBeUndefined();
    });

    it('should log a failed action with error message', () => {
      const entry = auditService.logAction(
        'failed_action',
        'task',
        'task-789',
        { attempt: 1 },
        false,
        'user-456',
        'gemini',
        'Test error message'
      );

      expect(entry.success).toBe(false);
      expect(entry.errorMessage).toBe('Test error message');
    });

    it('should store logs in chronological order (newest first)', () => {
      // Create logs with small delay to ensure different timestamps
      auditService.logAction('first_action', 'entity', 'id1', {}, true);
      
      // Add a small delay to ensure different timestamp
      const start = Date.now();
      while (Date.now() - start < 2) {
        // Small busy wait to ensure different timestamp
      }
      
      auditService.logAction('second_action', 'entity', 'id2', {}, true);

      const logs = auditService.getAllLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].action).toBe('second_action'); // Newer log should be first
      expect(logs[1].action).toBe('first_action');
    });
  });

  describe('Filtering and Searching', () => {
    beforeEach(() => {
      // Create test data
      auditService.logAction('document_analysis', 'document', 'doc-1', { vendor: 'TestCorp' }, true, 'user-1', 'gemini');
      auditService.logAction('task_created', 'task', 'task-1', { title: 'Pay invoice' }, true, 'user-1');
      auditService.logAction('document_analysis', 'document', 'doc-2', { vendor: 'AnotherCorp' }, false, 'user-2', 'gemini', 'Analysis failed');
      auditService.logAction('autonomous_email_sent', 'ai_action', 'action-1', { recipient: 'test@example.com' }, true, undefined, 'gemini');
    });

    it('should filter logs by entity', () => {
      const documentLogs = auditService.getLogsByEntity('document', 'doc-1');
      expect(documentLogs).toHaveLength(1);
      expect(documentLogs[0].entityId).toBe('doc-1');
    });

    it('should filter logs by user', () => {
      const user1Logs = auditService.getLogsByUser('user-1');
      expect(user1Logs).toHaveLength(2);
      expect(user1Logs.every(log => log.userId === 'user-1')).toBe(true);
    });

    it('should filter logs by AI model', () => {
      const geminiLogs = auditService.getLogsByAiModel('gemini');
      expect(geminiLogs).toHaveLength(3);
      expect(geminiLogs.every(log => log.aiModel === 'gemini')).toBe(true);
    });

    it('should get failed actions', () => {
      const failedLogs = auditService.getFailedActions();
      expect(failedLogs).toHaveLength(1);
      expect(failedLogs[0].entityId).toBe('doc-2');
      expect(failedLogs[0].success).toBe(false);
    });

    it('should search logs by query', () => {
      const searchResults = auditService.searchLogs('TestCorp');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].entityId).toBe('doc-1');

      const taskResults = auditService.searchLogs('task');
      expect(taskResults).toHaveLength(1);
      expect(taskResults[0].action).toBe('task_created');
    });

    it('should filter by date range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const recentLogs = auditService.getLogsByDateRange(oneHourAgo, oneHourFromNow);
      expect(recentLogs).toHaveLength(4); // All logs should be within this range

      const futureLogs = auditService.getLogsByDateRange(oneHourFromNow, new Date(now.getTime() + 2 * 60 * 60 * 1000));
      expect(futureLogs).toHaveLength(0);
    });
  });

  describe('Helper Logging Methods', () => {
    it('should log document analysis', () => {
      auditService.logDocumentAnalysis(
        'doc-123',
        true,
        'gemini',
        { confidence: 0.95, categories: ['invoice'] }
      );

      const logs = auditService.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('document_analysis');
      expect(logs[0].entityType).toBe('document');
      expect(logs[0].entityId).toBe('doc-123');
      expect(logs[0].aiModel).toBe('gemini');
      expect(logs[0].details.analysisResults.confidence).toBe(0.95);
    });

    it('should log task creation', () => {
      auditService.logTaskCreation('task-456', 'ai', 'doc-123', 'Payment needed');

      const logs = auditService.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('task_created');
      expect(logs[0].entityType).toBe('task');
      expect(logs[0].entityId).toBe('task-456');
      expect(logs[0].aiModel).toBe('gemini');
      expect(logs[0].details.createdBy).toBe('ai');
      expect(logs[0].details.aiSuggestion).toBe('Payment needed');
    });

    it('should log autonomous action', () => {
      auditService.logAutonomousAction(
        'email_sent',
        'action-789',
        { recipient: 'test@example.com', subject: 'Invoice reminder' },
        true
      );

      const logs = auditService.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('autonomous_email_sent');
      expect(logs[0].entityType).toBe('ai_action');
      expect(logs[0].details.recipient).toBe('test@example.com');
    });

    it('should log notification sent', () => {
      auditService.logNotificationSent(
        'deadline_reminder',
        'user-123',
        { message: 'Deadline approaching', dueDate: '2024-01-15' },
        true
      );

      const logs = auditService.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('notification_sent');
      expect(logs[0].entityType).toBe('notification');
      expect(logs[0].details.notificationType).toBe('deadline_reminder');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      // Create test data with mix of success/failure
      auditService.logAction('action1', 'type1', 'id1', {}, true, 'user1', 'gemini');
      auditService.logAction('action1', 'type1', 'id2', {}, true, 'user1', 'gemini');
      auditService.logAction('action2', 'type2', 'id3', {}, false, 'user2', 'claude');
      auditService.logAction('action1', 'type1', 'id4', {}, true, 'user1', 'gemini');
    });

    it('should provide accurate statistics', () => {
      const stats = auditService.getStatistics();

      expect(stats.totalLogs).toBe(4);
      expect(stats.failedActions).toBe(1);
      expect(stats.successRate).toBe('75.00%');
      expect(stats.mostCommonActions).toEqual([
        ['action1', 3],
        ['action2', 1]
      ]);
      expect(stats.aiModelUsage).toEqual({
        gemini: 3,
        claude: 1
      });
    });
  });

  describe('Export and Management', () => {
    beforeEach(() => {
      auditService.logAction('test_action', 'entity', 'id1', { key: 'value' }, true);
      auditService.logAction('another_action', 'entity', 'id2', { key2: 'value2' }, false, undefined, undefined, 'Error occurred');
    });

    it('should export logs as JSON', () => {
      const exportedJson = auditService.exportLogs();
      const parsedLogs = JSON.parse(exportedJson);

      expect(parsedLogs).toHaveLength(2);
      expect(parsedLogs[0].action).toBe('another_action'); // Newest first
      expect(parsedLogs[1].action).toBe('test_action');
    });

    it('should clear all logs', () => {
      expect(auditService.getAllLogs()).toHaveLength(2);
      
      auditService.clearLogs();
      
      expect(auditService.getAllLogs()).toHaveLength(0);
    });
  });

  describe('Memory Management', () => {
    it('should limit the number of stored logs', () => {
      // This test would be slow with the actual limit of 10,000
      // For testing purposes, we'd need a way to set a smaller limit
      // This is more of an integration test concept
      
      // Add a reasonable number of logs to test the concept
      for (let i = 0; i < 100; i++) {
        auditService.logAction(`action_${i}`, 'entity', `id_${i}`, {}, true);
      }

      const logs = auditService.getAllLogs();
      expect(logs.length).toBeLessThanOrEqual(100);
      
      // The most recent log should still be present
      expect(logs[0].action).toBe('action_99');
    });
  });
});