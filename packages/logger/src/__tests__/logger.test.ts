/**
 * Logger Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createLogger,
  getLogger,
  setDefaultLogger,
  resetDefaultLogger,
} from '../factory';
import type { LogLevel } from '../types';

describe('Logger', () => {
  beforeEach(() => {
    resetDefaultLogger();
  });

  afterEach(() => {
    resetDefaultLogger();
  });

  describe('createLogger', () => {
    it('should create a logger with default config', () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      // Default level is 'debug' in non-production, 'info' in production
      expect(['debug', 'info']).toContain(logger.level);
    });

    it('should create a logger with custom level', () => {
      const logger = createLogger({ level: 'debug' });
      expect(logger.level).toBe('debug');
    });

    it('should create a logger with silent level', () => {
      const logger = createLogger({ level: 'silent' });
      expect(logger.level).toBe('silent');
    });
  });

  describe('getLogger', () => {
    it('should return the default logger', () => {
      const logger = getLogger();
      expect(logger).toBeDefined();
    });

    it('should return the same instance on multiple calls', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });
  });

  describe('setDefaultLogger', () => {
    it('should set a custom default logger', () => {
      const customLogger = createLogger({ level: 'debug' });
      setDefaultLogger(customLogger);

      const logger = getLogger();
      expect(logger).toBe(customLogger);
      expect(logger.level).toBe('debug');
    });
  });

  describe('child logger', () => {
    it('should create a child logger with context', () => {
      const logger = createLogger({ level: 'silent' });
      const child = logger.child({ requestId: '123', module: 'test' });

      expect(child).toBeDefined();
      expect(child.level).toBe('silent');
    });
  });

  describe('log levels', () => {
    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

    it('should have all log methods', () => {
      const logger = createLogger({ level: 'silent' });

      for (const level of levels) {
        expect(typeof logger[level]).toBe('function');
      }
    });

    it('should not throw when logging at silent level', () => {
      const logger = createLogger({ level: 'silent' });

      expect(() => {
        logger.trace('trace message');
        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');
        logger.fatal('fatal message');
      }).not.toThrow();
    });

    it('should log with context', () => {
      const logger = createLogger({ level: 'silent' });

      expect(() => {
        logger.info('message with context', { key: 'value' });
      }).not.toThrow();
    });

    it('should handle Error objects', () => {
      const logger = createLogger({ level: 'silent' });
      const error = new Error('test error');

      expect(() => {
        logger.error(error, 'error occurred');
      }).not.toThrow();
    });
  });
});
