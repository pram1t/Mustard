import { describe, it, expect } from 'vitest';
import { slugify, uniqueSlug, createRoom, updateRoom, setRoomStatus } from '../room.js';

describe('slugify', () => {
  it('converts name to lowercase kebab-case', () => {
    expect(slugify('My Cool Project')).toBe('my-cool-project');
  });

  it('strips special characters', () => {
    expect(slugify('Hello! World @2024')).toBe('hello-world-2024');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('--test--')).toBe('test');
  });

  it('falls back to "room" for empty input', () => {
    expect(slugify('---')).toBe('room');
  });

  it('truncates to 64 characters', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(64);
  });
});

describe('uniqueSlug', () => {
  it('appends a 6-char suffix', () => {
    const slug = uniqueSlug('test');
    expect(slug).toMatch(/^test-[a-f0-9]{6}$/);
  });

  it('generates different slugs each time', () => {
    const a = uniqueSlug('test');
    const b = uniqueSlug('test');
    expect(a).not.toBe(b);
  });
});

describe('createRoom', () => {
  it('creates a room with defaults', () => {
    const room = createRoom({ name: 'My Project' }, 'owner-1');

    expect(room.name).toBe('My Project');
    expect(room.ownerId).toBe('owner-1');
    expect(room.status).toBe('active');
    expect(room.id).toBeDefined();
    expect(room.slug).toContain('my-project');
    expect(room.config.visibility).toBe('private');
    expect(room.config.aiEnabled).toBe(true);
    expect(room.config.defaultMode).toBe('plan');
  });

  it('merges provided config with defaults', () => {
    const room = createRoom(
      { name: 'Test', config: { visibility: 'public', maxAgents: 5 } },
      'owner-1',
    );

    expect(room.config.visibility).toBe('public');
    expect(room.config.maxAgents).toBe(5);
    expect(room.config.aiEnabled).toBe(true); // default kept
  });

  it('sets projectPath when provided', () => {
    const room = createRoom({ name: 'Test', projectPath: '/foo/bar' }, 'o');
    expect(room.projectPath).toBe('/foo/bar');
  });
});

describe('updateRoom', () => {
  it('updates name', () => {
    const room = createRoom({ name: 'Old' }, 'o');
    const updated = updateRoom(room, { name: 'New' });

    expect(updated.name).toBe('New');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(room.updatedAt.getTime());
  });

  it('merges config updates', () => {
    const room = createRoom({ name: 'Test' }, 'o');
    const updated = updateRoom(room, { config: { aiEnabled: false } });

    expect(updated.config.aiEnabled).toBe(false);
    expect(updated.config.visibility).toBe('private'); // unchanged
  });

  it('keeps existing values when not provided', () => {
    const room = createRoom({ name: 'Test' }, 'o');
    const updated = updateRoom(room, {});

    expect(updated.name).toBe('Test');
  });
});

describe('setRoomStatus', () => {
  it('transitions to dormant', () => {
    const room = createRoom({ name: 'Test' }, 'o');
    const dormant = setRoomStatus(room, 'dormant');

    expect(dormant.status).toBe('dormant');
    expect(dormant.updatedAt.getTime()).toBeGreaterThanOrEqual(room.updatedAt.getTime());
  });
});
