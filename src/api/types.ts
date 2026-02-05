/**
 * e-Gov 法令 API 型定義
 */

/** 法令カテゴリ */
export enum LawCategory {
  /** 憲法・法律 */
  Constitution = 1,
  /** 政令・勅令 */
  CabinetOrder = 2,
  /** 府省令 */
  MinisterialOrdinance = 3,
  /** その他 */
  Other = 4,
}

/** 法令情報 */
export interface LawInfo {
  /** 法令ID */
  lawId: string
  /** 法令番号 */
  lawNumber: string
  /** 法令名 */
  lawName: string
  /** 法令名かな */
  lawNameKana?: string
  /** 法令種別 */
  lawType: string
  /** 公布日 */
  promulgationDate?: string
  /** 施行日 */
  enforcementDate?: string
  /** 改正法令番号 */
  amendmentLawNumber?: string
  /** 改正法令名 */
  amendmentLawName?: string
}

/** 法令本文 */
export interface LawText {
  /** 法令ID */
  lawId: string
  /** 法令番号 */
  lawNumber: string
  /** 法令名 */
  lawName: string
  /** 本文 (Markdown形式) */
  content: string
  /** 目次 */
  toc?: TocItem[]
  /** 取得日時 */
  fetchedAt: string
}

/** 目次項目 */
export interface TocItem {
  /** タイトル */
  title: string
  /** 参照 (例: "第一章", "第一条") */
  ref: string
  /** 子項目 */
  children?: TocItem[]
}

/** 条文 */
export interface Article {
  /** 法令ID */
  lawId: string
  /** 条番号 */
  articleNum: string
  /** 条タイトル */
  articleTitle?: string
  /** 条文本文 */
  content: string
  /** 項 */
  paragraphs?: Paragraph[]
}

/** 項 */
export interface Paragraph {
  /** 項番号 */
  num: number
  /** 本文 */
  content: string
  /** 号 */
  items?: Item[]
}

/** 号 */
export interface Item {
  /** 号番号 */
  num: string
  /** 本文 */
  content: string
}

/** 検索結果 */
export interface SearchResult {
  /** 総件数 */
  totalCount: number
  /** 法令一覧 */
  laws: LawInfo[]
}

/** API エラー */
export interface ApiError {
  /** エラーコード */
  code: string
  /** エラーメッセージ */
  message: string
}

/** API レスポンス */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError }

/** キャッシュエントリ */
export interface CacheEntry<T> {
  /** データ */
  data: T
  /** 保存日時 (ISO 8601) */
  cachedAt: string
  /** 有効期限 (ISO 8601) */
  expiresAt: string
}

/** キャッシュ設定 */
export interface CacheConfig {
  /** 法令一覧の TTL (ミリ秒) */
  lawListTtl: number
  /** 法令本文の TTL (ミリ秒) */
  lawTextTtl: number
  /** 更新一覧の TTL (ミリ秒) */
  updateListTtl: number
}

/** デフォルトキャッシュ設定 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  lawListTtl: 24 * 60 * 60 * 1000, // 24時間
  lawTextTtl: 7 * 24 * 60 * 60 * 1000, // 7日間
  updateListTtl: 60 * 60 * 1000, // 1時間
}
