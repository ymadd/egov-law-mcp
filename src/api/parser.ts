/**
 * e-Gov 法令 API XML パーサー
 */

import { XMLParser } from 'fast-xml-parser'
import type {
  LawInfo,
  LawText,
  Article,
  Paragraph,
  Item,
  TocItem,
  SearchResult,
} from './types.js'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => {
    const arrayTags = [
      'LawNameListInfo',
      'Part',
      'Chapter',
      'Section',
      'Subsection',
      'Division',
      'Article',
      'Paragraph',
      'Item',
      'Subitem1',
      'Subitem2',
      'Sentence',
    ]
    return arrayTags.includes(name)
  },
})

/**
 * 法令一覧XMLをパース
 */
export function parseLawList(xml: string): SearchResult {
  const result = parser.parse(xml)
  const dataRoot = result.DataRoot || result

  // e-Gov APIの構造: DataRoot > ApplData > LawNameListInfo
  const applData = dataRoot.ApplData || dataRoot
  const lawList = applData.LawNameListInfo || dataRoot.LawNameListInfo || []

  const laws: LawInfo[] = ensureArray(lawList).map((item: Record<string, unknown>) => ({
    lawId: String(item.LawId || ''),
    lawNumber: String(item.LawNo || ''),
    lawName: String(item.LawName || ''),
    lawNameKana: item.LawNameKana ? String(item.LawNameKana) : undefined,
    lawType: String(item.LawType || ''),
    promulgationDate: item.PromulgationDate
      ? String(item.PromulgationDate)
      : undefined,
    enforcementDate: item.EnforcementDate
      ? String(item.EnforcementDate)
      : undefined,
  }))

  return {
    totalCount: laws.length,
    laws,
  }
}

/**
 * 法令本文XMLをパース
 */
export function parseLawText(xml: string): LawText {
  const result = parser.parse(xml)
  const dataRoot = result.DataRoot || result

  // e-Gov APIの構造: DataRoot > ApplData > LawFullText > Law
  const applData = dataRoot.ApplData || dataRoot
  const lawFullText = applData.LawFullText || applData
  const lawData = lawFullText.Law || lawFullText

  // 法令IDを取得（ApplDataから）
  const lawId = applData.LawId || lawData['@_LawId'] || ''

  const lawNum = lawData.LawNum || lawData['@_LawNum'] || ''
  const lawBody = lawData.LawBody || {}
  const lawTitle = lawBody.LawTitle || lawData.LawTitle || ''

  const toc = extractToc(lawBody)
  const content = extractLawContent(lawBody)

  return {
    lawId: String(lawId),
    lawNumber: String(lawNum),
    lawName: extractText(lawTitle),
    content,
    toc,
    fetchedAt: new Date().toISOString(),
  }
}

/**
 * 条文をパース
 */
export function parseArticle(
  xml: string,
  targetArticle: string,
  targetParagraph?: number
): Article | null {
  const result = parser.parse(xml)
  const dataRoot = result.DataRoot || result

  // e-Gov APIの構造: DataRoot > ApplData > LawFullText > Law
  const applData = dataRoot.ApplData || dataRoot
  const lawFullText = applData.LawFullText || applData
  const lawData = lawFullText.Law || lawFullText
  const lawBody = lawData.LawBody || {}

  // 法令IDを取得（ApplDataから）
  const lawId = applData.LawId || lawData['@_LawId'] || ''

  const article = findArticle(lawBody, targetArticle)
  if (!article) {
    return null
  }

  const paragraphs = extractParagraphs(article, targetParagraph)

  return {
    lawId: String(lawId),
    articleNum: targetArticle,
    articleTitle: article.ArticleTitle
      ? extractText(article.ArticleTitle)
      : undefined,
    content: extractArticleContent(article, targetParagraph),
    paragraphs,
  }
}

/**
 * 目次を抽出
 */
function extractToc(lawBody: Record<string, unknown>): TocItem[] {
  const toc: TocItem[] = []
  const mainProvision = lawBody.MainProvision as Record<string, unknown>
  if (!mainProvision) return toc

  // 編・章・節などを再帰的に抽出
  const parts = ensureArray(mainProvision.Part)
  for (const part of parts) {
    const partItem = extractTocItem(part as Record<string, unknown>, 'Part')
    if (partItem) toc.push(partItem)
  }

  const chapters = ensureArray(mainProvision.Chapter)
  for (const chapter of chapters) {
    const chapterItem = extractTocItem(
      chapter as Record<string, unknown>,
      'Chapter'
    )
    if (chapterItem) toc.push(chapterItem)
  }

  // 章がない場合は条を直接追加
  if (toc.length === 0) {
    const articles = ensureArray(mainProvision.Article)
    for (const article of articles) {
      const articleTitle =
        (article as Record<string, unknown>).ArticleTitle ||
        (article as Record<string, unknown>)['@_Num']
      toc.push({
        title: extractText(articleTitle),
        ref: `第${(article as Record<string, unknown>)['@_Num']}条`,
      })
    }
  }

  return toc
}

/**
 * 目次項目を抽出
 */
function extractTocItem(
  node: Record<string, unknown>,
  type: string
): TocItem | null {
  if (!node) return null

  const titleKey = `${type}Title`
  const numKey = '@_Num'
  const title = node[titleKey] || node[numKey]
  if (!title) return null

  const item: TocItem = {
    title: extractText(title),
    ref: `${getTypePrefix(type)}${node[numKey] || ''}`,
  }

  // 子要素を抽出
  const childTypes = ['Chapter', 'Section', 'Subsection', 'Article']
  for (const childType of childTypes) {
    const children = ensureArray(node[childType])
    if (children.length > 0) {
      item.children = children
        .map((child) =>
          extractTocItem(child as Record<string, unknown>, childType)
        )
        .filter((c): c is TocItem => c !== null)
      break
    }
  }

  return item
}

/**
 * 型プレフィックスを取得
 */
function getTypePrefix(type: string): string {
  const prefixes: Record<string, string> = {
    Part: '第',
    Chapter: '第',
    Section: '第',
    Subsection: '第',
    Article: '第',
  }
  return prefixes[type] || ''
}

/**
 * 法令本文を抽出
 */
function extractLawContent(lawBody: Record<string, unknown>): string {
  const parts: string[] = []

  // 前文
  const preamble = lawBody.Preamble as Record<string, unknown>
  if (preamble) {
    parts.push('## 前文\n')
    parts.push(extractParagraphsText(preamble))
  }

  // 本則
  const mainProvision = lawBody.MainProvision as Record<string, unknown>
  if (mainProvision) {
    parts.push('## 本則\n')
    parts.push(extractMainProvisionContent(mainProvision))
  }

  // 附則
  const supplementaryProvisions = lawBody.SupplementaryProvisions
  if (supplementaryProvisions) {
    parts.push('## 附則\n')
    const suppArray = ensureArray(supplementaryProvisions)
    for (const supp of suppArray) {
      parts.push(extractSupplementaryContent(supp as Record<string, unknown>))
    }
  }

  return parts.join('\n')
}

/**
 * 本則内容を抽出
 */
function extractMainProvisionContent(
  mainProvision: Record<string, unknown>
): string {
  const parts: string[] = []

  // 編
  const partsList = ensureArray(mainProvision.Part)
  for (const part of partsList) {
    parts.push(extractPartContent(part as Record<string, unknown>))
  }

  // 章（編がない場合）
  if (partsList.length === 0) {
    const chapters = ensureArray(mainProvision.Chapter)
    for (const chapter of chapters) {
      parts.push(extractChapterContent(chapter as Record<string, unknown>))
    }
  }

  // 条（章もない場合）
  if (partsList.length === 0) {
    const articles = ensureArray(mainProvision.Article)
    for (const article of articles) {
      parts.push(extractArticleContent(article as Record<string, unknown>))
    }
  }

  return parts.join('\n')
}

/**
 * 編内容を抽出
 */
function extractPartContent(part: Record<string, unknown>): string {
  const parts: string[] = []
  const title = part.PartTitle
  if (title) {
    parts.push(`### ${extractText(title)}\n`)
  }

  const chapters = ensureArray(part.Chapter)
  for (const chapter of chapters) {
    parts.push(extractChapterContent(chapter as Record<string, unknown>))
  }

  return parts.join('\n')
}

/**
 * 章内容を抽出
 */
function extractChapterContent(chapter: Record<string, unknown>): string {
  const parts: string[] = []
  const title = chapter.ChapterTitle
  if (title) {
    parts.push(`#### ${extractText(title)}\n`)
  }

  // 節
  const sections = ensureArray(chapter.Section)
  for (const section of sections) {
    parts.push(extractSectionContent(section as Record<string, unknown>))
  }

  // 条（節がない場合）
  if (sections.length === 0) {
    const articles = ensureArray(chapter.Article)
    for (const article of articles) {
      parts.push(extractArticleContent(article as Record<string, unknown>))
    }
  }

  return parts.join('\n')
}

/**
 * 節内容を抽出
 */
function extractSectionContent(section: Record<string, unknown>): string {
  const parts: string[] = []
  const title = section.SectionTitle
  if (title) {
    parts.push(`##### ${extractText(title)}\n`)
  }

  const articles = ensureArray(section.Article)
  for (const article of articles) {
    parts.push(extractArticleContent(article as Record<string, unknown>))
  }

  return parts.join('\n')
}

/**
 * 条文内容を抽出
 */
function extractArticleContent(
  article: Record<string, unknown>,
  targetParagraph?: number
): string {
  const parts: string[] = []

  // 条タイトル
  const caption = article.ArticleCaption
  const title = article.ArticleTitle
  const num = article['@_Num']

  if (caption) {
    parts.push(`**${extractText(caption)}**`)
  }
  if (title || num) {
    const titleText = title ? extractText(title) : `第${num}条`
    parts.push(`**${titleText}**\n`)
  }

  // 項
  const paragraphs = ensureArray(article.Paragraph)
  for (const para of paragraphs) {
    const paraNum = (para as Record<string, unknown>)['@_Num']
    if (targetParagraph !== undefined && Number(paraNum) !== targetParagraph) {
      continue
    }
    parts.push(extractParagraphContent(para as Record<string, unknown>))
  }

  return parts.join('\n')
}

/**
 * 項内容を抽出
 */
function extractParagraphContent(paragraph: Record<string, unknown>): string {
  const parts: string[] = []
  const num = paragraph['@_Num']

  // 項番号と本文
  const sentence = paragraph.ParagraphSentence
  if (sentence) {
    const prefix = num && num !== '1' ? `${num}　` : ''
    parts.push(`${prefix}${extractSentenceText(sentence)}`)
  }

  // 号
  const items = ensureArray(paragraph.Item)
  for (const item of items) {
    parts.push(extractItemContent(item as Record<string, unknown>, 1))
  }

  return parts.join('\n')
}

/**
 * 号内容を抽出
 */
function extractItemContent(
  item: Record<string, unknown>,
  level: number
): string {
  const parts: string[] = []
  const num = item['@_Num']
  const indent = '  '.repeat(level)

  const sentence = item.ItemSentence
  if (sentence) {
    parts.push(`${indent}${num}　${extractSentenceText(sentence)}`)
  }

  // 下位の号
  const subitems = ensureArray(item.Subitem1 || item.Subitem2)
  for (const subitem of subitems) {
    parts.push(extractItemContent(subitem as Record<string, unknown>, level + 1))
  }

  return parts.join('\n')
}

/**
 * 文を抽出
 */
function extractSentenceText(sentence: unknown): string {
  if (!sentence) return ''

  if (typeof sentence === 'string') return sentence

  const sentences = ensureArray(
    (sentence as Record<string, unknown>).Sentence || sentence
  )
  return sentences.map((s) => extractText(s)).join('')
}

/**
 * 段落テキストを抽出
 */
function extractParagraphsText(node: Record<string, unknown>): string {
  const paragraphs = ensureArray(node.Paragraph)
  return paragraphs
    .map((p) => extractParagraphContent(p as Record<string, unknown>))
    .join('\n')
}

/**
 * 附則内容を抽出
 */
function extractSupplementaryContent(supp: Record<string, unknown>): string {
  const parts: string[] = []

  const label = supp.SupplementaryProvisionLabel
  if (label) {
    parts.push(`### ${extractText(label)}\n`)
  }

  const articles = ensureArray(supp.Article)
  for (const article of articles) {
    parts.push(extractArticleContent(article as Record<string, unknown>))
  }

  return parts.join('\n')
}

/**
 * 条を検索
 */
function findArticle(
  lawBody: Record<string, unknown>,
  targetArticle: string
): Record<string, unknown> | null {
  // 条番号を正規化 (例: "第一条" -> "1", "第二十条" -> "20")
  const normalizedTarget = normalizeArticleNum(targetArticle)

  const mainProvision = lawBody.MainProvision as Record<string, unknown>
  if (!mainProvision) return null

  // 再帰的に検索
  return findArticleRecursive(mainProvision, normalizedTarget)
}

/**
 * 再帰的に条を検索
 */
function findArticleRecursive(
  node: Record<string, unknown>,
  targetNum: string
): Record<string, unknown> | null {
  // 直接の条
  const articles = ensureArray(node.Article)
  for (const article of articles) {
    const num = (article as Record<string, unknown>)['@_Num']
    if (String(num) === targetNum) {
      return article as Record<string, unknown>
    }
  }

  // 編・章・節を検索
  for (const key of ['Part', 'Chapter', 'Section', 'Subsection', 'Division']) {
    const children = ensureArray(node[key])
    for (const child of children) {
      const found = findArticleRecursive(
        child as Record<string, unknown>,
        targetNum
      )
      if (found) return found
    }
  }

  return null
}

/**
 * 条番号を正規化
 */
function normalizeArticleNum(articleStr: string): string {
  // "第一条" -> "1", "第二十条" -> "20" など
  const kanjiNums: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    百: 100,
  }

  // 既に数字の場合
  const numMatch = articleStr.match(/\d+/)
  if (numMatch) return numMatch[0]

  // 漢数字を変換
  const kanjiMatch = articleStr.match(/第(.+)条/)
  if (!kanjiMatch) return articleStr

  const kanjiPart = kanjiMatch[1]
  let result = 0
  let temp = 0

  for (const char of kanjiPart) {
    const num = kanjiNums[char]
    if (num === undefined) continue

    if (num === 10) {
      result += temp === 0 ? 10 : temp * 10
      temp = 0
    } else if (num === 100) {
      result += temp === 0 ? 100 : temp * 100
      temp = 0
    } else {
      temp = num
    }
  }
  result += temp

  return String(result)
}

/**
 * 項を抽出
 */
function extractParagraphs(
  article: Record<string, unknown>,
  targetParagraph?: number
): Paragraph[] {
  const paragraphs = ensureArray(article.Paragraph)
  const result: Paragraph[] = []

  for (const para of paragraphs) {
    const num = Number((para as Record<string, unknown>)['@_Num']) || 1
    if (targetParagraph !== undefined && num !== targetParagraph) {
      continue
    }

    const sentence = (para as Record<string, unknown>).ParagraphSentence
    const items = ensureArray((para as Record<string, unknown>).Item)

    result.push({
      num,
      content: extractSentenceText(sentence),
      items: items.map((item) => ({
        num: String((item as Record<string, unknown>)['@_Num']),
        content: extractSentenceText(
          (item as Record<string, unknown>).ItemSentence
        ),
      })),
    })
  }

  return result
}

/**
 * テキストを抽出
 */
function extractText(node: unknown): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)

  const obj = node as Record<string, unknown>
  if (obj['#text']) return String(obj['#text'])

  // 子要素からテキストを結合
  const texts: string[] = []
  for (const value of Object.values(obj)) {
    if (typeof value === 'string') {
      texts.push(value)
    } else if (Array.isArray(value)) {
      texts.push(...value.map((v) => extractText(v)))
    } else if (typeof value === 'object') {
      texts.push(extractText(value))
    }
  }
  return texts.join('')
}

/**
 * 配列を確保
 */
function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}
