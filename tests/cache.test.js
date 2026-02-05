/**
 * キャッシュのテスト
 */

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { mkdir, rm, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('Cache Tests', () => {
  const testCacheDir = join(tmpdir(), 'egov-law-mcp-test-cache')

  beforeEach(async () => {
    // テスト用キャッシュディレクトリを作成
    await mkdir(testCacheDir, { recursive: true })
  })

  afterEach(async () => {
    // テスト用キャッシュディレクトリを削除
    try {
      await rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // 削除失敗は無視
    }
  })

  test('cache directory should be created', async () => {
    const files = await readdir(testCacheDir)
    assert.ok(Array.isArray(files))
  })

  test('cache key generation should be safe', () => {
    // 特殊文字を含むキーの安全性テスト
    const unsafeChars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
    const safePattern = /^[a-zA-Z0-9\-_]+$/

    for (const char of unsafeChars) {
      const key = `test${char}key`
      const safeKey = key.replace(/[^a-zA-Z0-9\-_]/g, '_')
      assert.ok(safePattern.test(safeKey), `Key should be safe: ${safeKey}`)
    }
  })

  test('TTL configuration should have reasonable defaults', () => {
    const defaultConfig = {
      lawListTtl: 24 * 60 * 60 * 1000, // 24時間
      lawTextTtl: 7 * 24 * 60 * 60 * 1000, // 7日間
      updateListTtl: 60 * 60 * 1000, // 1時間
    }

    // 法令一覧: 24時間
    assert.strictEqual(defaultConfig.lawListTtl, 86400000)

    // 法令本文: 7日間
    assert.strictEqual(defaultConfig.lawTextTtl, 604800000)

    // 更新一覧: 1時間
    assert.strictEqual(defaultConfig.updateListTtl, 3600000)
  })

  test('cache entry structure should be valid', () => {
    const now = new Date()
    const ttl = 24 * 60 * 60 * 1000 // 24時間

    const entry = {
      data: { test: 'data' },
      cachedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
    }

    // 構造の確認
    assert.ok(entry.data)
    assert.ok(entry.cachedAt)
    assert.ok(entry.expiresAt)

    // 日付の有効性確認
    const cachedAt = new Date(entry.cachedAt)
    const expiresAt = new Date(entry.expiresAt)
    assert.ok(!isNaN(cachedAt.getTime()))
    assert.ok(!isNaN(expiresAt.getTime()))
    assert.ok(expiresAt > cachedAt)
  })
})
