/**
 * 法令キャッシュ
 */

import { readFile, writeFile, mkdir, stat } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { CacheEntry, CacheConfig, DEFAULT_CACHE_CONFIG } from '../api/types.js'

const CACHE_DIR = join(homedir(), '.cache', 'egov-law-mcp')

/**
 * 法令キャッシュ
 */
export class LawCache {
  private readonly cacheDir: string
  private readonly config: CacheConfig
  private initialized = false

  constructor(config?: Partial<CacheConfig>) {
    this.cacheDir = CACHE_DIR
    this.config = {
      lawListTtl: config?.lawListTtl ?? 24 * 60 * 60 * 1000, // 24時間
      lawTextTtl: config?.lawTextTtl ?? 7 * 24 * 60 * 60 * 1000, // 7日間
      updateListTtl: config?.updateListTtl ?? 60 * 60 * 1000, // 1時間
    }
  }

  /**
   * キャッシュディレクトリを初期化
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    try {
      await mkdir(this.cacheDir, { recursive: true })
      this.initialized = true
    } catch (error) {
      // ディレクトリが既に存在する場合は無視
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
      this.initialized = true
    }
  }

  /**
   * キャッシュキーを生成
   */
  private getCacheKey(type: string, id: string): string {
    // 特殊文字をエスケープ
    const safeId = id.replace(/[^a-zA-Z0-9\-_]/g, '_')
    return `${type}_${safeId}.json`
  }

  /**
   * キャッシュパスを取得
   */
  private getCachePath(key: string): string {
    return join(this.cacheDir, key)
  }

  /**
   * TTLを取得
   */
  private getTtl(type: 'lawList' | 'lawText' | 'updateList'): number {
    switch (type) {
      case 'lawList':
        return this.config.lawListTtl
      case 'lawText':
        return this.config.lawTextTtl
      case 'updateList':
        return this.config.updateListTtl
    }
  }

  /**
   * キャッシュを取得
   */
  async get<T>(
    type: 'lawList' | 'lawText' | 'updateList',
    id: string
  ): Promise<T | null> {
    await this.ensureInitialized()

    const key = this.getCacheKey(type, id)
    const path = this.getCachePath(key)

    try {
      const data = await readFile(path, 'utf-8')
      const entry: CacheEntry<T> = JSON.parse(data)

      // 有効期限をチェック
      const expiresAt = new Date(entry.expiresAt)
      if (expiresAt < new Date()) {
        return null
      }

      return entry.data
    } catch {
      return null
    }
  }

  /**
   * キャッシュを設定
   */
  async set<T>(
    type: 'lawList' | 'lawText' | 'updateList',
    id: string,
    data: T
  ): Promise<void> {
    await this.ensureInitialized()

    const key = this.getCacheKey(type, id)
    const path = this.getCachePath(key)
    const ttl = this.getTtl(type)

    const now = new Date()
    const entry: CacheEntry<T> = {
      data,
      cachedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
    }

    await writeFile(path, JSON.stringify(entry, null, 2), 'utf-8')
  }

  /**
   * キャッシュを削除
   */
  async delete(type: 'lawList' | 'lawText' | 'updateList', id: string): Promise<void> {
    await this.ensureInitialized()

    const key = this.getCacheKey(type, id)
    const path = this.getCachePath(key)

    try {
      const { unlink } = await import('fs/promises')
      await unlink(path)
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  /**
   * 全キャッシュをクリア
   */
  async clear(): Promise<void> {
    await this.ensureInitialized()

    const { readdir, unlink } = await import('fs/promises')
    try {
      const files = await readdir(this.cacheDir)
      await Promise.all(
        files.map((file) => unlink(join(this.cacheDir, file)).catch(() => {}))
      )
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  }

  /**
   * キャッシュ統計を取得
   */
  async getStats(): Promise<{
    totalFiles: number
    totalSize: number
    oldestEntry: Date | null
    newestEntry: Date | null
  }> {
    await this.ensureInitialized()

    const { readdir } = await import('fs/promises')
    try {
      const files = await readdir(this.cacheDir)
      let totalSize = 0
      let oldestEntry: Date | null = null
      let newestEntry: Date | null = null

      for (const file of files) {
        const path = join(this.cacheDir, file)
        const fileStat = await stat(path)
        totalSize += fileStat.size

        if (!oldestEntry || fileStat.mtime < oldestEntry) {
          oldestEntry = fileStat.mtime
        }
        if (!newestEntry || fileStat.mtime > newestEntry) {
          newestEntry = fileStat.mtime
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        oldestEntry,
        newestEntry,
      }
    } catch {
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null,
      }
    }
  }
}

/**
 * デフォルトキャッシュインスタンス
 */
export const defaultCache = new LawCache()
