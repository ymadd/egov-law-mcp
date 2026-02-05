/**
 * XML to Markdown 変換ユーティリティ
 */

import type { LawText, Article, TocItem } from '../api/types.js'

/**
 * 法令本文を Markdown に変換
 */
export function lawTextToMarkdown(lawText: LawText): string {
  const parts: string[] = []

  // タイトル
  parts.push(`# ${lawText.lawName}`)
  parts.push('')
  parts.push(`**法令番号**: ${lawText.lawNumber}`)
  parts.push(`**法令ID**: ${lawText.lawId}`)
  parts.push('')

  // 目次
  if (lawText.toc && lawText.toc.length > 0) {
    parts.push('## 目次')
    parts.push('')
    parts.push(tocToMarkdown(lawText.toc))
    parts.push('')
  }

  // 本文
  parts.push(lawText.content)

  return parts.join('\n')
}

/**
 * 目次を Markdown に変換
 */
export function tocToMarkdown(toc: TocItem[], level = 0): string {
  const indent = '  '.repeat(level)
  const lines: string[] = []

  for (const item of toc) {
    lines.push(`${indent}- ${item.title} (${item.ref})`)
    if (item.children && item.children.length > 0) {
      lines.push(tocToMarkdown(item.children, level + 1))
    }
  }

  return lines.join('\n')
}

/**
 * 条文を Markdown に変換
 */
export function articleToMarkdown(article: Article): string {
  const parts: string[] = []

  // タイトル
  const title = article.articleTitle || `第${article.articleNum}条`
  parts.push(`## ${title}`)
  parts.push('')

  // 本文
  parts.push(article.content)
  parts.push('')

  // 項の詳細
  if (article.paragraphs && article.paragraphs.length > 0) {
    parts.push('### 項の詳細')
    parts.push('')

    for (const para of article.paragraphs) {
      parts.push(`**第${para.num}項**`)
      parts.push('')
      parts.push(para.content)
      parts.push('')

      if (para.items && para.items.length > 0) {
        for (const item of para.items) {
          parts.push(`  - ${item.num}. ${item.content}`)
        }
        parts.push('')
      }
    }
  }

  return parts.join('\n')
}

/**
 * 検索結果を Markdown に変換
 */
export function searchResultToMarkdown(
  laws: Array<{
    lawId: string
    lawNumber: string
    lawName: string
    lawType?: string
    promulgationDate?: string
  }>
): string {
  if (laws.length === 0) {
    return '検索結果がありません。'
  }

  const parts: string[] = []
  parts.push(`検索結果: ${laws.length}件`)
  parts.push('')

  for (const law of laws) {
    parts.push(`### ${law.lawName}`)
    parts.push('')
    parts.push(`- **法令番号**: ${law.lawNumber}`)
    parts.push(`- **法令ID**: ${law.lawId}`)
    if (law.lawType) {
      parts.push(`- **種別**: ${law.lawType}`)
    }
    if (law.promulgationDate) {
      parts.push(`- **公布日**: ${law.promulgationDate}`)
    }
    parts.push('')
  }

  return parts.join('\n')
}

/**
 * エラーメッセージを Markdown に変換
 */
export function errorToMarkdown(code: string, message: string): string {
  return `## エラー

**コード**: ${code}
**メッセージ**: ${message}

### 対処方法

- キーワードや条件を変えて再検索してください
- 法令番号が正しいか確認してください
- しばらく待ってから再試行してください
`
}

/**
 * 法令名から類似候補を提案
 */
export function suggestSimilarLaws(
  query: string,
  candidates: Array<{ lawName: string; lawId: string }>
): string {
  if (candidates.length === 0) {
    return `「${query}」に該当する法令が見つかりませんでした。`
  }

  const parts: string[] = []
  parts.push(`「${query}」に該当する法令が見つかりませんでした。`)
  parts.push('')
  parts.push('以下の法令を探していますか？')
  parts.push('')

  for (const candidate of candidates.slice(0, 5)) {
    parts.push(`- ${candidate.lawName} (ID: ${candidate.lawId})`)
  }

  return parts.join('\n')
}
