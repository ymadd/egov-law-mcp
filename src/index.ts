#!/usr/bin/env node
/**
 * e-Gov 法令 MCP Server
 *
 * 日本政府の e-Gov 法令 API をラップした MCP Server です。
 * 法令の検索、本文取得、条文取得が可能です。
 *
 * @example
 * ```bash
 * npx -y @claude-essentials/mcp-egov-law
 * ```
 */

import { startServer } from './server.js'

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
