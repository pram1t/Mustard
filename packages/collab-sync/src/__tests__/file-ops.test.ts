import { describe, it, expect } from 'vitest';
import { createRoomDocument, getFileContent, getFileMeta, getTree, getClaims } from '../document.js';
import {
  createFile,
  deleteFile,
  renameFile,
  getFileText,
  insertText,
  deleteText,
  replaceText,
  buildNestedTree,
} from '../file-ops.js';

const USER = 'user-1';

describe('createFile', () => {
  it('should create a file with content and metadata', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'src/index.ts', 'export {};', USER);

    expect(getFileContent(ydoc, 'src/index.ts')).toBe('export {};');

    const meta = getFileMeta(ydoc).get('src/index.ts');
    expect(meta).toBeDefined();
    expect(meta!.path).toBe('src/index.ts');
    expect(meta!.language).toBe('typescript');
    expect(meta!.lastModifiedBy).toBe(USER);
    expect(meta!.size).toBe('export {};'.length);
  });

  it('should add entry to the tree', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'readme.md', '# Hello', USER);

    const tree = getTree(ydoc);
    expect(tree.length).toBe(1);
    expect(tree.get(0).path).toBe('readme.md');
    expect(tree.get(0).type).toBe('file');
  });

  it('should throw if file already exists', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'a.ts', '', USER);
    expect(() => createFile(ydoc, 'a.ts', '', USER)).toThrow('File already exists');
  });

  it('should detect language from extension', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'style.css', 'body {}', USER);
    expect(getFileMeta(ydoc).get('style.css')!.language).toBe('css');

    createFile(ydoc, 'app.py', 'pass', USER);
    expect(getFileMeta(ydoc).get('app.py')!.language).toBe('python');
  });

  it('should use custom language when provided', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'data.txt', 'hello', USER, 'custom-lang');
    expect(getFileMeta(ydoc).get('data.txt')!.language).toBe('custom-lang');
  });
});

describe('deleteFile', () => {
  it('should remove file, metadata, and tree entry', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'a.ts', 'content', USER);
    deleteFile(ydoc, 'a.ts', USER);

    expect(getFileContent(ydoc, 'a.ts')).toBeUndefined();
    expect(getFileMeta(ydoc).get('a.ts')).toBeUndefined();
    expect(getTree(ydoc).length).toBe(0);
  });

  it('should also clear claims', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'a.ts', '', USER);
    getClaims(ydoc).set('a.ts', USER);
    deleteFile(ydoc, 'a.ts', USER);

    expect(getClaims(ydoc).get('a.ts')).toBeUndefined();
  });

  it('should throw if file does not exist', () => {
    const ydoc = createRoomDocument();
    expect(() => deleteFile(ydoc, 'nope.ts', USER)).toThrow('File not found');
  });
});

describe('renameFile', () => {
  it('should move content and metadata to new path', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'old.ts', 'code', USER);
    renameFile(ydoc, 'old.ts', 'new.ts', USER);

    expect(getFileContent(ydoc, 'old.ts')).toBeUndefined();
    expect(getFileContent(ydoc, 'new.ts')).toBe('code');

    expect(getFileMeta(ydoc).get('old.ts')).toBeUndefined();
    const meta = getFileMeta(ydoc).get('new.ts');
    expect(meta).toBeDefined();
    expect(meta!.path).toBe('new.ts');
  });

  it('should move claims', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'old.ts', '', USER);
    getClaims(ydoc).set('old.ts', 'agent-1');
    renameFile(ydoc, 'old.ts', 'new.ts', USER);

    expect(getClaims(ydoc).get('old.ts')).toBeUndefined();
    expect(getClaims(ydoc).get('new.ts')).toBe('agent-1');
  });

  it('should update tree entries', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'old.ts', '', USER);
    renameFile(ydoc, 'old.ts', 'new.ts', USER);

    const tree = getTree(ydoc).toArray();
    expect(tree.find(n => n.path === 'old.ts')).toBeUndefined();
    expect(tree.find(n => n.path === 'new.ts')).toBeDefined();
  });

  it('should throw if old path does not exist', () => {
    const ydoc = createRoomDocument();
    expect(() => renameFile(ydoc, 'nope.ts', 'new.ts', USER)).toThrow('File not found');
  });

  it('should throw if new path already exists', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'a.ts', '', USER);
    createFile(ydoc, 'b.ts', '', USER);
    expect(() => renameFile(ydoc, 'a.ts', 'b.ts', USER)).toThrow('File already exists');
  });
});

describe('text operations', () => {
  it('getFileText returns the Y.Text', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'f.ts', 'hello', USER);
    const ytext = getFileText(ydoc, 'f.ts');
    expect(ytext).toBeDefined();
    expect(ytext!.toString()).toBe('hello');
  });

  it('getFileText returns undefined for missing file', () => {
    const ydoc = createRoomDocument();
    expect(getFileText(ydoc, 'nope.ts')).toBeUndefined();
  });

  it('insertText inserts at position', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'f.ts', 'helloworld', USER);
    insertText(ydoc, 'f.ts', 5, ' ', USER);
    expect(getFileContent(ydoc, 'f.ts')).toBe('hello world');
  });

  it('deleteText removes range', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'f.ts', 'hello world', USER);
    deleteText(ydoc, 'f.ts', 5, 6, USER);
    expect(getFileContent(ydoc, 'f.ts')).toBe('hello');
  });

  it('replaceText does delete+insert atomically', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'f.ts', 'hello world', USER);
    replaceText(ydoc, 'f.ts', 6, 5, 'collab', USER);
    expect(getFileContent(ydoc, 'f.ts')).toBe('hello collab');
  });

  it('insertText throws if file does not exist', () => {
    const ydoc = createRoomDocument();
    expect(() => insertText(ydoc, 'nope.ts', 0, 'x', USER)).toThrow('File not found');
  });

  it('insertText updates metadata', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'f.ts', 'a', USER);
    const metaBefore = getFileMeta(ydoc).get('f.ts')!;

    insertText(ydoc, 'f.ts', 1, 'bc', 'user-2');
    const metaAfter = getFileMeta(ydoc).get('f.ts')!;

    expect(metaAfter.lastModifiedBy).toBe('user-2');
    expect(metaAfter.lastModifiedAt).toBeGreaterThanOrEqual(metaBefore.lastModifiedAt);
  });
});

describe('buildNestedTree', () => {
  it('should create nested directory structure', () => {
    const ydoc = createRoomDocument();
    createFile(ydoc, 'src/index.ts', '', USER);
    createFile(ydoc, 'src/utils/helpers.ts', '', USER);
    createFile(ydoc, 'readme.md', '', USER);

    const tree = buildNestedTree(ydoc);
    expect(tree.name).toBe('/');
    expect(tree.type).toBe('directory');
    expect(tree.children).toBeDefined();
    expect(tree.children!.length).toBeGreaterThan(0);

    // Should have 'src' dir and 'readme.md' file at root level
    const names = tree.children!.map(c => c.name);
    expect(names).toContain('src');
    expect(names).toContain('readme.md');
  });

  it('should return empty root for empty document', () => {
    const ydoc = createRoomDocument();
    const tree = buildNestedTree(ydoc);
    expect(tree.children).toEqual([]);
  });
});
