/**
 * 法令本文取得ツール
 */

import type { LawText } from '../api/types.js'
import { EGovLawClient } from '../api/client.js'
import { LawCache } from '../cache/law-cache.js'
import {
  lawTextToMarkdown,
  errorToMarkdown,
  suggestSimilarLaws,
} from '../utils/xml-to-markdown.js'

export interface GetLawTextParams {
  /** 法令ID */
  law_id?: string
  /** 法令番号 */
  law_number?: string
}

export interface GetLawTextResult {
  success: boolean
  content: string
  data?: LawText
}

/**
 * 法令本文取得ツール
 */
export async function getLawText(
  params: GetLawTextParams,
  client: EGovLawClient,
  cache: LawCache
): Promise<GetLawTextResult> {
  const { law_id, law_number } = params

  if (!law_id && !law_number) {
    return {
      success: false,
      content: errorToMarkdown(
        'INVALID_PARAMS',
        '法令ID (law_id) または法令番号 (law_number) のいずれかを指定してください'
      ),
    }
  }

  // キャッシュキーを生成
  const cacheKey = law_id ?? law_number!

  // キャッシュをチェック
  const cached = await cache.get<LawText>('lawText', cacheKey)
  if (cached) {
    return {
      success: true,
      content: lawTextToMarkdown(cached),
      data: cached,
    }
  }

  // API を呼び出し
  let result
  if (law_id) {
    result = await client.getLawById(law_id)
  } else {
    result = await client.getLawByNumber(law_number!)
  }

  if (!result.success) {
    // 見つからない場合は類似候補を提案
    if (result.error.code === 'NOT_FOUND') {
      const query = law_id ?? law_number!
      const similar = await client.findSimilarLaws(query)

      if (similar.success && similar.data.laws.length > 0) {
        return {
          success: false,
          content: suggestSimilarLaws(
            query,
            similar.data.laws.map((law) => ({
              lawName: law.lawName,
              lawId: law.lawId,
            }))
          ),
        }
      }
    }

    return {
      success: false,
      content: errorToMarkdown(result.error.code, result.error.message),
    }
  }

  // キャッシュに保存
  await cache.set('lawText', cacheKey, result.data)

  // 法令IDでもキャッシュ（法令番号で取得した場合）
  if (law_number && result.data.lawId && result.data.lawId !== law_number) {
    await cache.set('lawText', result.data.lawId, result.data)
  }

  return {
    success: true,
    content: lawTextToMarkdown(result.data),
    data: result.data,
  }
}

/**
 * ツール定義
 */
export const getLawTextToolDefinition = {
  name: 'get_law_text',
  description: `法令の全文を取得します。法令IDまたは法令番号で指定できます。

使用例:
- 法令IDで取得: law_id="405AC0000000089"
- 法令番号で取得: law_number="平成十五年法律第五十七号"

主な法令ID:
- 民法: 129AC0000000089
- 会社法: 417AC0000000086
- 個人情報保護法: 415AC0000000057
- 下請法: 331AC0000000120
- 印紙税法: 342AC0000000023`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      law_id: {
        type: 'string',
        description: '法令ID (例: "405AC0000000089")',
      },
      law_number: {
        type: 'string',
        description: '法令番号 (例: "平成十五年法律第五十七号")',
      },
    },
  },
}
