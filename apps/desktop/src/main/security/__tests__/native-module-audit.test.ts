import { describe, it, expect } from 'vitest';
import {
  getNodeABIForElectron,
  isRegistryURLSafe,
  isV8CageCompatible,
  getKnownCVEs,
  isNativeModuleExtension,
} from '../native-module-audit';

describe('Native Module Audit', () => {
  describe('getNodeABIForElectron', () => {
    it('returns correct ABI for Electron 34', () => {
      expect(getNodeABIForElectron(34)).toBe(132);
    });

    it('returns correct ABI for Electron 30', () => {
      expect(getNodeABIForElectron(30)).toBe(125);
    });

    it('returns null for unknown version', () => {
      expect(getNodeABIForElectron(99)).toBeNull();
    });
  });

  describe('isRegistryURLSafe', () => {
    it('accepts npmjs.org over HTTPS', () => {
      expect(isRegistryURLSafe('https://registry.npmjs.org')).toBe(true);
    });

    it('accepts yarnpkg.com over HTTPS', () => {
      expect(isRegistryURLSafe('https://registry.yarnpkg.com')).toBe(true);
    });

    it('accepts GitHub npm over HTTPS', () => {
      expect(isRegistryURLSafe('https://npm.pkg.github.com')).toBe(true);
    });

    it('rejects HTTP registries', () => {
      expect(isRegistryURLSafe('http://registry.npmjs.org')).toBe(false);
    });

    it('rejects unknown registries', () => {
      expect(isRegistryURLSafe('https://evil-registry.com')).toBe(false);
    });

    it('rejects invalid URLs', () => {
      expect(isRegistryURLSafe('not-a-url')).toBe(false);
    });
  });

  describe('isV8CageCompatible', () => {
    it('returns true for known compatible modules', () => {
      expect(isV8CageCompatible('keytar')).toBe(true);
      expect(isV8CageCompatible('better-sqlite3')).toBe(true);
      expect(isV8CageCompatible('fsevents')).toBe(true);
    });

    it('returns null for unknown modules', () => {
      expect(isV8CageCompatible('unknown-native-pkg')).toBeNull();
    });
  });

  describe('getKnownCVEs', () => {
    it('returns empty array for packages with no known CVEs', () => {
      expect(getKnownCVEs('keytar')).toEqual([]);
    });

    it('returns empty array for unknown packages', () => {
      expect(getKnownCVEs('nonexistent-package')).toEqual([]);
    });
  });

  describe('isNativeModuleExtension', () => {
    it('recognizes .node files', () => {
      expect(isNativeModuleExtension('binding.node')).toBe(true);
    });

    it('recognizes .dll files', () => {
      expect(isNativeModuleExtension('library.dll')).toBe(true);
    });

    it('recognizes .dylib files', () => {
      expect(isNativeModuleExtension('library.dylib')).toBe(true);
    });

    it('recognizes .so files', () => {
      expect(isNativeModuleExtension('library.so')).toBe(true);
    });

    it('rejects .js files', () => {
      expect(isNativeModuleExtension('script.js')).toBe(false);
    });

    it('rejects .ts files', () => {
      expect(isNativeModuleExtension('code.ts')).toBe(false);
    });
  });
});
