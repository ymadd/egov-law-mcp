/**
 * e-Gov 法令 API クライアント
 */

import type { LawCategory, LawText, Article, SearchResult, ApiResponse, LawInfo } from './types.js'
import { parseLawList, parseLawText, parseArticle } from './parser.js'

const BASE_URL = 'https://laws.e-gov.go.jp/api/1'
const MAX_RETRIES = 3
const RETRY_DELAY = 1000

interface RequestOptions {
  timeout?: number
  retries?: number
}

/**
 * e-Gov 法令 API クライアント
 */
export class EGovLawClient {
  private readonly timeout: number
  private lawListCache: Map<number, LawInfo[]> = new Map()

  constructor(options: { timeout?: number } = {}) {
    this.timeout = options.timeout ?? 30000
  }

  /**
   * 法令を検索
   * e-Gov APIにはキーワード検索がないため、カテゴリ一覧を取得してクライアント側でフィルタリング
   */
  async searchLaws(params: {
    keyword?: string
    category?: LawCategory
  }): Promise<ApiResponse<SearchResult>> {
    const { keyword, category } = params

    // カテゴリが指定されていない場合は全カテゴリを検索
    const categories = category ? [category] : [1, 2, 3, 4]
    const allLaws: LawInfo[] = []

    for (const cat of categories) {
      const result = await this.getLawListByCategory(cat as LawCategory)
      if (result.success) {
        allLaws.push(...result.data.laws)
      }
    }

    // キーワードでフィルタリング
    let filteredLaws = allLaws
    if (keyword) {
      const normalizedKeyword = keyword.toLowerCase()
      filteredLaws = allLaws.filter(
        (law) =>
          law.lawName.toLowerCase().includes(normalizedKeyword) ||
          law.lawNumber.includes(keyword) ||
          (law.lawNameKana && law.lawNameKana.includes(keyword))
      )
    }

    return {
      success: true,
      data: {
        totalCount: filteredLaws.length,
        laws: filteredLaws.slice(0, 100), // 最大100件
      },
    }
  }

  /**
   * カテゴリ別法令一覧を取得
   */
  async getLawListByCategory(category: LawCategory): Promise<ApiResponse<SearchResult>> {
    // キャッシュをチェック
    const cached = this.lawListCache.get(category)
    if (cached) {
      return {
        success: true,
        data: {
          totalCount: cached.length,
          laws: cached,
        },
      }
    }

    const url = `${BASE_URL}/lawlists/${category}`
    const result = await this.fetchWithRetry(url, (xml) => parseLawList(xml))

    if (result.success) {
      this.lawListCache.set(category, result.data.laws)
    }

    return result
  }

  /**
   * 法令IDで法令本文を取得
   */
  async getLawById(lawId: string): Promise<ApiResponse<LawText>> {
    const url = `${BASE_URL}/lawdata/${encodeURIComponent(lawId)}`
    return this.fetchWithRetry(url, (xml) => parseLawText(xml))
  }

  /**
   * 法令番号で法令本文を取得
   */
  async getLawByNumber(lawNumber: string): Promise<ApiResponse<LawText>> {
    // まず法令番号で検索して法令IDを取得
    const searchResult = await this.searchLaws({ keyword: lawNumber })
    if (!searchResult.success) {
      return searchResult
    }

    // 完全一致する法令を探す
    const exactMatch = searchResult.data.laws.find(
      (law) => law.lawNumber === lawNumber
    )
    if (!exactMatch) {
      // 部分一致を試みる
      const partialMatch = searchResult.data.laws.find(
        (law) => law.lawNumber.includes(lawNumber) || lawNumber.includes(law.lawNumber)
      )
      if (partialMatch) {
        return this.getLawById(partialMatch.lawId)
      }

      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `法令番号「${lawNumber}」に該当する法令が見つかりませんでした`,
        },
      }
    }

    return this.getLawById(exactMatch.lawId)
  }

  /**
   * 条文を取得
   */
  async getArticle(params: {
    lawId: string
    article: string
    paragraph?: number
  }): Promise<ApiResponse<Article>> {
    const url = `${BASE_URL}/lawdata/${encodeURIComponent(params.lawId)}`
    return this.fetchWithRetry(url, (xml) => {
      const article = parseArticle(xml, params.article, params.paragraph)
      if (!article) {
        throw new Error(
          `条文「${params.article}」が見つかりませんでした`
        )
      }
      return article
    })
  }

  /**
   * 類似法令を検索（法令番号が不明な場合のフォールバック）
   */
  async findSimilarLaws(query: string): Promise<ApiResponse<SearchResult>> {
    const result = await this.searchLaws({ keyword: query })
    if (!result.success) {
      return result
    }

    // 関連度でソート（名前の部分一致を優先）
    const sortedLaws = [...result.data.laws].sort((a, b) => {
      const aMatch = a.lawName.includes(query) ? 1 : 0
      const bMatch = b.lawName.includes(query) ? 1 : 0
      return bMatch - aMatch
    })

    return {
      success: true,
      data: {
        totalCount: sortedLaws.length,
        laws: sortedLaws.slice(0, 10),
      },
    }
  }

  /**
   * リトライ付きフェッチ
   */
  private async fetchWithRetry<T>(
    url: string,
    parser: (xml: string) => T,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const maxRetries = options.retries ?? MAX_RETRIES
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(
          () => controller.abort(),
          options.timeout ?? this.timeout
        )

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/xml',
          },
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          if (response.status === 404) {
            return {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: 'リソースが見つかりませんでした',
              },
            }
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const xml = await response.text()

        // APIエラーレスポンスをチェック
        if (xml.includes('<Code>1</Code>')) {
          const messageMatch = xml.match(/<Message>([^<]*)<\/Message>/)
          const errorMessage = messageMatch ? messageMatch[1] : 'APIエラーが発生しました'
          return {
            success: false,
            error: {
              code: 'API_ERROR',
              message: errorMessage,
            },
          }
        }

        const data = parser(xml)
        return { success: true, data }
      } catch (error) {
        lastError = error as Error

        // 最後の試行でなければリトライ
        if (attempt < maxRetries) {
          await this.delay(RETRY_DELAY * attempt)
        }
      }
    }

    return {
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: lastError?.message ?? 'リクエストに失敗しました',
      },
    }
  }

  /**
   * 遅延
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * デフォルトクライアントインスタンス
 */
export const defaultClient = new EGovLawClient()
