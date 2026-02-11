/**
 * Credential Service
 *
 * Secure credential storage using Electron's safeStorage API.
 * Falls back to AES-256-GCM with machine-specific key on Linux without keyring.
 *
 * Rules:
 * 1. Never store secrets in plain text
 * 2. Never expose secrets to the renderer
 * 3. Handle platform differences (Linux fallback)
 */

import { safeStorage, app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

type CredentialType = 'api_key' | 'mcp_secret';

interface CredentialMeta {
  id: string;
  type: CredentialType;
  label: string;
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// CREDENTIAL SERVICE
// =============================================================================

export class CredentialService {
  private storageDir: string;
  private metaPath: string;
  private metadata: Map<string, CredentialMeta> = new Map();
  private initialized = false;

  constructor() {
    this.storageDir = app.getPath('userData');
    this.metaPath = path.join(this.storageDir, 'credentials.json');
  }

  /**
   * Initialize the credential store. Load metadata from disk.
   * Call once during app startup before any other methods.
   */
  async initialize(): Promise<void> {
    try {
      const raw = await fs.readFile(this.metaPath, 'utf-8');
      const entries = JSON.parse(raw) as CredentialMeta[];
      for (const meta of entries) {
        this.metadata.set(`${meta.type}:${meta.id}`, meta);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[CredentialService] Error loading metadata:', error);
      }
    }
    this.initialized = true;
  }

  /**
   * Check if secure storage (OS keychain) is available.
   */
  isSecureStorageAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Get information about the storage backend.
   */
  getStorageBackend(): { backend: string; secure: boolean } {
    if (safeStorage.isEncryptionAvailable()) {
      if (process.platform === 'darwin') {
        return { backend: 'macOS Keychain', secure: true };
      }
      if (process.platform === 'win32') {
        return { backend: 'Windows DPAPI', secure: true };
      }
      return { backend: 'Secret Service', secure: true };
    }
    return { backend: 'AES-256-GCM (fallback)', secure: false };
  }

  /**
   * Store a credential securely.
   */
  async store(
    type: CredentialType,
    id: string,
    value: string,
    label?: string
  ): Promise<void> {
    this.assertInitialized();

    const encrypted = this.encrypt(value);
    const filePath = this.getCredentialPath(type, id);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, encrypted);

    const key = `${type}:${id}`;
    const now = Date.now();
    const existing = this.metadata.get(key);
    this.metadata.set(key, {
      id,
      type,
      label: label ?? `${type} for ${id}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    await this.persistMetadata();
  }

  /**
   * Retrieve a credential. Returns null if not found.
   */
  async retrieve(type: CredentialType, id: string): Promise<string | null> {
    this.assertInitialized();

    const filePath = this.getCredentialPath(type, id);
    try {
      const encrypted = await fs.readFile(filePath);
      return this.decrypt(Buffer.from(encrypted));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a credential.
   */
  async delete(type: CredentialType, id: string): Promise<void> {
    this.assertInitialized();

    const filePath = this.getCredentialPath(type, id);
    await fs.unlink(filePath).catch(() => {});

    this.metadata.delete(`${type}:${id}`);
    await this.persistMetadata();
  }

  /**
   * Check if a credential exists (without decrypting).
   */
  has(type: CredentialType, id: string): boolean {
    this.assertInitialized();
    return this.metadata.has(`${type}:${id}`);
  }

  /**
   * List credential metadata for a given type (no secrets exposed).
   */
  list(type: CredentialType): CredentialMeta[] {
    this.assertInitialized();
    return Array.from(this.metadata.values()).filter((m) => m.type === type);
  }

  // ===========================================================================
  // ENCRYPTION
  // ===========================================================================

  private encrypt(value: string): Buffer {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(value);
    }
    return this.fallbackEncrypt(value);
  }

  private decrypt(data: Buffer): string {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(data);
    }
    return this.fallbackDecrypt(data);
  }

  /**
   * AES-256-GCM fallback for systems without OS keychain.
   * Uses machine-specific key derivation (app path + userData + platform).
   */
  private fallbackEncrypt(value: string): Buffer {
    const key = this.deriveFallbackKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Format: [iv (16)] [authTag (16)] [encrypted data]
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private fallbackDecrypt(data: Buffer): string {
    const key = this.deriveFallbackKey();
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  }

  private deriveFallbackKey(): Buffer {
    const appPath = app.getAppPath();
    const userData = app.getPath('userData');
    const machineId = `${appPath}:${userData}:${process.platform}`;
    return crypto.scryptSync(machineId, 'openagent-credential-salt', 32);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private getCredentialPath(type: CredentialType, id: string): string {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storageDir, `cred-${type}-${safeId}.enc`);
  }

  private async persistMetadata(): Promise<void> {
    const entries = Array.from(this.metadata.values());
    await fs.writeFile(this.metaPath, JSON.stringify(entries, null, 2));
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error('CredentialService not initialized. Call initialize() first.');
    }
  }
}
