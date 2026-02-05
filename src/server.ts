/**
 * e-Gov 法令 MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { EGovLawClient } from './api/client.js'
import { LawCache } from './cache/law-cache.js'
import {
  searchLaws,
  searchLawsToolDefinition,
  type SearchLawsParams,
} from './tools/search-laws.js'
import {
  getLawText,
  getLawTextToolDefinition,
  type GetLawTextParams,
} from './tools/get-law-text.js'
import {
  getArticle,
  getArticleToolDefinition,
  type GetArticleParams,
} from './tools/get-article.js'

/**
 * MCP Server を作成
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'egov-law-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  )

  const client = new EGovLawClient()
  const cache = new LawCache()

  // ツール一覧を返す
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        searchLawsToolDefinition,
        getLawTextToolDefinition,
        getArticleToolDefinition,
      ],
    }
  })

  // ツール実行
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    try {
      switch (name) {
        case 'search_laws': {
          const params = args as unknown as SearchLawsParams
          const result = await searchLaws(params, client, cache)
          return {
            content: [
              {
                type: 'text',
                text: result.content,
              },
            ],
            isError: !result.success,
          }
        }

        case 'get_law_text': {
          const params = args as unknown as GetLawTextParams
          const result = await getLawText(params, client, cache)
          return {
            content: [
              {
                type: 'text',
                text: result.content,
              },
            ],
            isError: !result.success,
          }
        }

        case 'get_article': {
          const params = args as unknown as GetArticleParams
          const result = await getArticle(params, client, cache)
          return {
            content: [
              {
                type: 'text',
                text: result.content,
              },
            ],
            isError: !result.success,
          }
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      }
    }
  })

  return server
}

/**
 * Server を開始
 */
export async function startServer(): Promise<void> {
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
