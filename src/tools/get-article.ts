/**
 * 条文取得ツール
 */

import type { Article } from '../api/types.js'
import { EGovLawClient } from '../api/client.js'
import { LawCache } from '../cache/law-cache.js'
import { articleToMarkdown, errorToMarkdown } from '../utils/xml-to-markdown.js'

export interface GetArticleParams {
  /** 法令ID */
  law_id: string
  /** 条番号 (例: "第一条", "第二十条", "1", "20") */
  article: string
  /** 項番号 (省略時は全項を取得) */
  paragraph?: number
}

export interface GetArticleResult {
  success: boolean
  content: string
  data?: Article
}

/**
 * 条文取得ツール
 */
export async function getArticle(
  params: GetArticleParams,
  client: EGovLawClient,
  cache: LawCache
): Promise<GetArticleResult> {
  const { law_id, article, paragraph } = params

  if (!law_id) {
    return {
      success: false,
      content: errorToMarkdown('INVALID_PARAMS', '法令ID (law_id) を指定してください'),
    }
  }

  if (!article) {
    return {
      success: false,
      content: errorToMarkdown(
        'INVALID_PARAMS',
        '条番号 (article) を指定してください（例: "第一条", "1"）'
      ),
    }
  }

  // キャッシュキーを生成
  const cacheKey = `${law_id}_${article}${paragraph ? `_${paragraph}` : ''}`

  // キャッシュをチェック（法令本文キャッシュから抽出を試みる）
  const cachedLawText = await cache.get<{ content: string }>('lawText', law_id)

  // API を呼び出し
  const result = await client.getArticle({
    lawId: law_id,
    article,
    paragraph,
  })

  if (!result.success) {
    return {
      success: false,
      content: errorToMarkdown(result.error.code, result.error.message),
    }
  }

  return {
    success: true,
    content: articleToMarkdown(result.data),
    data: result.data,
  }
}

/**
 * ツール定義
 */
export const getArticleToolDefinition = {
  name: 'get_article',
  description: `特定の条文を取得します。法令IDと条番号を指定して、特定の条文を取得できます。

使用例:
- 民法第1条を取得: law_id="129AC0000000089", article="第一条"
- 民法第2条第2項を取得: law_id="129AC0000000089", article="第二条", paragraph=2

条番号の指定方法:
- 漢数字: "第一条", "第二十条", "第百二十三条"
- アラビア数字: "1", "20", "123"

主な法令ID:
- 民法: 129AC0000000089
- 会社法: 417AC0000000086
- 個人情報保護法: 415AC0000000057
- 下請法: 331AC0000000120
- 消費者契約法: 412AC0000000061`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      law_id: {
        type: 'string',
        description: '法令ID (例: "129AC0000000089")',
      },
      article: {
        type: 'string',
        description: '条番号 (例: "第一条", "1")',
      },
      paragraph: {
        type: 'number',
        description: '項番号 (省略時は全項を取得)',
      },
    },
    required: ['law_id', 'article'],
  },
}
