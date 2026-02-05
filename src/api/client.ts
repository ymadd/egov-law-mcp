/**
 * e-Gov 法令 API クライアント
 */

import type { LawCategory, LawText, Article, SearchResult, ApiResponse } from './types.js'
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

  constructor(options: { timeout?: number } = {}) {
    this.timeout = options.timeout ?? 30000
  }

  /**
   * 法令を検索
   */
  async searchLaws(params: {
    keyword?: string
    category?: LawCategory
    lawType?: string
    promulgationDateFrom?: string
    promulgationDateTo?: string
  }): Promise<ApiResponse<SearchResult>> {
    const queryParams = new URLSearchParams()

    if (params.keyword) {
      queryParams.set('keyword', params.keyword)
    }
    if (params.category) {
      queryParams.set('category', String(params.category))
    }
    if (params.lawType) {
      queryParams.set('law_type', params.lawType)
    }
    if (params.promulgationDateFrom) {
      queryParams.set('promulgation_date_from', params.promulgationDateFrom)
    }
    if (params.promulgationDateTo) {
      queryParams.set('promulgation_date_to', params.promulgationDateTo)
    }

    const url = `${BASE_URL}/lawlists?${queryParams.toString()}`
    return this.fetchWithRetry(url, (xml) => parseLawList(xml))
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
    // まず法令本文を取得
    const lawResult = await this.getLawById(params.lawId)
    if (!lawResult.success) {
      return lawResult
    }

    // 取得したXMLから条文を抽出（再度XMLを取得）
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
   * 更新法令一覧を取得
   */
  async getUpdatedLaws(params: {
    from: string
    to?: string
  }): Promise<ApiResponse<SearchResult>> {
    const queryParams = new URLSearchParams()
    queryParams.set('updated_from', params.from)
    if (params.to) {
      queryParams.set('updated_to', params.to)
    }

    const url = `${BASE_URL}/lawlists/updated?${queryParams.toString()}`
    return this.fetchWithRetry(url, (xml) => parseLawList(xml))
  }

  /**
   * 類似法令を検索（法令番号が不明な場合のフォールバック）
   */
  async findSimilarLaws(query: string): Promise<ApiResponse<SearchResult>> {
    // キーワード検索を実行
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
        laws: sortedLaws.slice(0, 10), // 上位10件
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
