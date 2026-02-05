/**
 * 法令検索ツール
 */

import type { LawCategory, SearchResult } from '../api/types.js'
import { EGovLawClient } from '../api/client.js'
import { LawCache } from '../cache/law-cache.js'
import { searchResultToMarkdown, errorToMarkdown } from '../utils/xml-to-markdown.js'

export interface SearchLawsParams {
  /** 検索キーワード */
  keyword: string
  /** 法令カテゴリ (1: 憲法・法律, 2: 政令・勅令, 3: 府省令, 4: その他) */
  category?: number
}

export interface SearchLawsResult {
  success: boolean
  content: string
  data?: SearchResult
}

/**
 * 法令検索ツール
 */
export async function searchLaws(
  params: SearchLawsParams,
  client: EGovLawClient,
  cache: LawCache
): Promise<SearchLawsResult> {
  const { keyword, category } = params

  if (!keyword || keyword.trim() === '') {
    return {
      success: false,
      content: errorToMarkdown('INVALID_PARAMS', '検索キーワードを指定してください'),
    }
  }

  // キャッシュキーを生成
  const cacheKey = `search_${keyword}_${category ?? 'all'}`

  // キャッシュをチェック
  const cached = await cache.get<SearchResult>('lawList', cacheKey)
  if (cached) {
    return {
      success: true,
      content: searchResultToMarkdown(cached.laws),
      data: cached,
    }
  }

  // API を呼び出し
  const result = await client.searchLaws({
    keyword,
    category: category as LawCategory | undefined,
  })

  if (!result.success) {
    return {
      success: false,
      content: errorToMarkdown(result.error.code, result.error.message),
    }
  }

  // キャッシュに保存
  await cache.set('lawList', cacheKey, result.data)

  return {
    success: true,
    content: searchResultToMarkdown(result.data.laws),
    data: result.data,
  }
}

/**
 * ツール定義
 */
export const searchLawsToolDefinition = {
  name: 'search_laws',
  description: `法令を検索します。キーワードやカテゴリで日本の法令を検索できます。

カテゴリ:
- 1: 憲法・法律
- 2: 政令・勅令
- 3: 府省令
- 4: その他

使用例:
- 個人情報保護に関する法令を検索
- 契約に関する法律を検索
- 特定のカテゴリの法令を検索`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      keyword: {
        type: 'string',
        description: '検索キーワード（法令名、条文内容など）',
      },
      category: {
        type: 'number',
        description: '法令カテゴリ (1: 憲法・法律, 2: 政令・勅令, 3: 府省令, 4: その他)',
        enum: [1, 2, 3, 4],
      },
    },
    required: ['keyword'],
  },
}
