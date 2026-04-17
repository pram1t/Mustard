import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  createRoomDocument,
  DOC_KEYS,
  getFiles,
  getFileMeta,
  getTree,
  getChat,
  getClaims,
  getSoftLocks,
  getFileContent,
  setFileContent,
  hasFile,
  listFiles,
  encodeDocumentState,
  applyDocumentUpdate,
  syncDocuments,
} from '../document.js';

describe('createRoomDocument', () => {
  it('should create a Y.Doc with all shared types initialised', () => {
    const ydoc = createRoomDocument();
    expect(ydoc).toBeInstanceOf(Y.Doc);

    // All standard maps/arrays should exist
    expect(ydoc.getMap(DOC_KEYS.FILES)).toBeDefined();
    expect(ydoc.getMap(DOC_KEYS.FILE_META)).toBeDefined();
    expect(ydoc.getArray(DOC_KEYS.TREE)).toBeDefined();
    expect(ydoc.getArray(DOC_KEYS.CHAT)).toBeDefined();
    expect(ydoc.getMap(DOC_KEYS.CLAIMS)).toBeDefined();
    expect(ydoc.getMap(DOC_KEYS.SOFT_LOCKS)).toBeDefined();
  });

  it('should accept a custom clientId', () => {
    const ydoc = createRoomDocument(42);
    expect(ydoc.clientID).toBe(42);
  });
});

describe('typed accessors', () => {
  it('getFiles returns the files map', () => {
    const ydoc = createRoomDocument();
    const files = getFiles(ydoc);
    expect(files).toBeDefined();
    expect(files.size).toBe(0);
  });

  it('getFileMeta returns the fileMeta map', () => {
    const ydoc = createRoomDocument();
    expect(getFileMeta(ydoc).size).toBe(0);
  });

  it('getTree returns the tree array', () => {
    const ydoc = createRoomDocument();
    expect(getTree(ydoc).length).toBe(0);
  });

  it('getChat returns the chat array', () => {
    const ydoc = createRoomDocument();
    expect(getChat(ydoc).length).toBe(0);
  });

  it('getClaims returns the claims map', () => {
    const ydoc = createRoomDocument();
    expect(getClaims(ydoc).size).toBe(0);
  });

  it('getSoftLocks returns the softLocks map', () => {
    const ydoc = createRoomDocument();
    expect(getSoftLocks(ydoc).size).toBe(0);
  });
});

describe('content helpers', () => {
  it('setFileContent creates a new file with content', () => {
    const ydoc = createRoomDocument();
    setFileContent(ydoc, 'src/index.ts', 'hello world');

    expect(getFileContent(ydoc, 'src/index.ts')).toBe('hello world');
    expect(hasFile(ydoc, 'src/index.ts')).toBe(true);
  });

  it('setFileContent overwrites existing content', () => {
    const ydoc = createRoomDocument();
    setFileContent(ydoc, 'a.txt', 'old');
    setFileContent(ydoc, 'a.txt', 'new');

    expect(getFileContent(ydoc, 'a.txt')).toBe('new');
  });

  it('getFileContent returns undefined for non-existent file', () => {
    const ydoc = createRoomDocument();
    expect(getFileContent(ydoc, 'nope.txt')).toBeUndefined();
  });

  it('hasFile returns false for non-existent file', () => {
    const ydoc = createRoomDocument();
    expect(hasFile(ydoc, 'nope.txt')).toBe(false);
  });

  it('listFiles returns sorted file paths', () => {
    const ydoc = createRoomDocument();
    setFileContent(ydoc, 'c.ts', '');
    setFileContent(ydoc, 'a.ts', '');
    setFileContent(ydoc, 'b.ts', '');

    expect(listFiles(ydoc)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });
});

describe('state encoding / decoding', () => {
  it('encodeDocumentState returns a Uint8Array', () => {
    const ydoc = createRoomDocument();
    setFileContent(ydoc, 'f.ts', 'test');

    const state = encodeDocumentState(ydoc);
    expect(state).toBeInstanceOf(Uint8Array);
    expect(state.length).toBeGreaterThan(0);
  });

  it('applyDocumentUpdate replicates state to another doc', () => {
    const docA = createRoomDocument();
    setFileContent(docA, 'f.ts', 'from A');

    const docB = createRoomDocument();
    const update = encodeDocumentState(docA);
    applyDocumentUpdate(docB, update);

    expect(getFileContent(docB, 'f.ts')).toBe('from A');
  });
});

describe('syncDocuments', () => {
  it('should synchronise two docs bidirectionally', () => {
    const docA = createRoomDocument(1);
    const docB = createRoomDocument(2);

    setFileContent(docA, 'a.ts', 'from A', 'userA');
    setFileContent(docB, 'b.ts', 'from B', 'userB');

    syncDocuments(docA, docB);

    // Both docs should now have both files
    expect(getFileContent(docA, 'a.ts')).toBe('from A');
    expect(getFileContent(docA, 'b.ts')).toBe('from B');
    expect(getFileContent(docB, 'a.ts')).toBe('from A');
    expect(getFileContent(docB, 'b.ts')).toBe('from B');
  });

  it('should converge on concurrent edits to the same file', () => {
    const docA = createRoomDocument(1);
    const docB = createRoomDocument(2);

    // Both start from same state
    setFileContent(docA, 'shared.ts', 'base');
    syncDocuments(docA, docB);
    expect(getFileContent(docB, 'shared.ts')).toBe('base');

    // Concurrent edits (before sync)
    const textA = getFiles(docA).get('shared.ts')!;
    const textB = getFiles(docB).get('shared.ts')!;
    docA.transact(() => textA.insert(4, ' + A'), 'userA');
    docB.transact(() => textB.insert(4, ' + B'), 'userB');

    // After sync, both should converge to the same content
    syncDocuments(docA, docB);
    const contentA = getFileContent(docA, 'shared.ts');
    const contentB = getFileContent(docB, 'shared.ts');
    expect(contentA).toBe(contentB);
    // Both edits should be present
    expect(contentA).toContain('+ A');
    expect(contentA).toContain('+ B');
  });
});
