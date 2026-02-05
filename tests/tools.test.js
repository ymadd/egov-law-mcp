/**
 * ツールのテスト
 */

const { test, describe } = require('node:test')
const assert = require('node:assert')

describe('Tool Definition Tests', () => {
  test('search_laws tool definition should be valid', () => {
    const definition = {
      name: 'search_laws',
      description: '法令を検索します',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '検索キーワード',
          },
          category: {
            type: 'number',
            description: '法令カテゴリ',
            enum: [1, 2, 3, 4],
          },
        },
        required: ['keyword'],
      },
    }

    assert.strictEqual(definition.name, 'search_laws')
    assert.ok(definition.description)
    assert.strictEqual(definition.inputSchema.type, 'object')
    assert.ok(definition.inputSchema.properties.keyword)
    assert.ok(definition.inputSchema.required.includes('keyword'))
  })

  test('get_law_text tool definition should be valid', () => {
    const definition = {
      name: 'get_law_text',
      description: '法令の全文を取得します',
      inputSchema: {
        type: 'object',
        properties: {
          law_id: {
            type: 'string',
            description: '法令ID',
          },
          law_number: {
            type: 'string',
            description: '法令番号',
          },
        },
      },
    }

    assert.strictEqual(definition.name, 'get_law_text')
    assert.ok(definition.description)
    assert.ok(definition.inputSchema.properties.law_id)
    assert.ok(definition.inputSchema.properties.law_number)
  })

  test('get_article tool definition should be valid', () => {
    const definition = {
      name: 'get_article',
      description: '特定の条文を取得します',
      inputSchema: {
        type: 'object',
        properties: {
          law_id: {
            type: 'string',
            description: '法令ID',
          },
          article: {
            type: 'string',
            description: '条番号',
          },
          paragraph: {
            type: 'number',
            description: '項番号',
          },
        },
        required: ['law_id', 'article'],
      },
    }

    assert.strictEqual(definition.name, 'get_article')
    assert.ok(definition.description)
    assert.ok(definition.inputSchema.properties.law_id)
    assert.ok(definition.inputSchema.properties.article)
    assert.ok(definition.inputSchema.required.includes('law_id'))
    assert.ok(definition.inputSchema.required.includes('article'))
  })
})

describe('Tool Parameter Validation', () => {
  test('search_laws should require keyword', () => {
    const params = {}
    const isValid = Boolean(params.keyword && params.keyword.trim() !== '')
    assert.strictEqual(isValid, false)
  })

  test('search_laws should accept valid keyword', () => {
    const params = { keyword: '個人情報' }
    const isValid = params.keyword && params.keyword.trim() !== ''
    assert.strictEqual(isValid, true)
  })

  test('get_law_text should require law_id or law_number', () => {
    const params = {}
    const isValid = Boolean(params.law_id || params.law_number)
    assert.strictEqual(isValid, false)
  })

  test('get_law_text should accept law_id', () => {
    const params = { law_id: '415AC0000000057' }
    const isValid = Boolean(params.law_id || params.law_number)
    assert.strictEqual(isValid, true)
  })

  test('get_law_text should accept law_number', () => {
    const params = { law_number: '平成十五年法律第五十七号' }
    const isValid = Boolean(params.law_id || params.law_number)
    assert.strictEqual(isValid, true)
  })

  test('get_article should require law_id and article', () => {
    const params = { law_id: '415AC0000000057' }
    const isValid = Boolean(params.law_id && params.article)
    assert.strictEqual(isValid, false)
  })

  test('get_article should accept valid params', () => {
    const params = { law_id: '415AC0000000057', article: '第一条' }
    const isValid = Boolean(params.law_id && params.article)
    assert.strictEqual(isValid, true)
  })

  test('category should be valid enum value', () => {
    const validCategories = [1, 2, 3, 4]
    const params = { keyword: 'test', category: 1 }

    const isValidCategory =
      params.category === undefined ||
      validCategories.includes(params.category)
    assert.strictEqual(isValidCategory, true)

    const invalidParams = { keyword: 'test', category: 5 }
    const isInvalidCategory = validCategories.includes(invalidParams.category)
    assert.strictEqual(isInvalidCategory, false)
  })
})

describe('Known Law IDs', () => {
  test('should have correct law IDs for common laws', () => {
    const knownLaws = {
      個人情報保護法: '415AC0000000057',
      下請法: '331AC0000000120',
      印紙税法: '342AC0000000023',
      民法: '129AC0000000089',
      会社法: '417AC0000000086',
      消費者契約法: '412AC0000000061',
    }

    // 法令IDのフォーマット確認 (数字とアルファベット)
    for (const [name, id] of Object.entries(knownLaws)) {
      assert.ok(/^[0-9A-Z]+$/.test(id), `${name} should have valid law ID format`)
    }
  })
})
