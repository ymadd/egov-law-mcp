# e-Gov Law MCP Server

日本政府の [e-Gov 法令 API](https://laws.e-gov.go.jp/api/) をラップした Model Context Protocol (MCP) サーバーです。

## 機能

- **法令検索** (`search_laws`) - キーワードやカテゴリで法令を検索
- **法令本文取得** (`get_law_text`) - 法令 ID または法令番号から全文を取得
- **条文取得** (`get_article`) - 特定の条文を取得

## インストール

### Claude Code で使う

```bash
npx -y egov-law-mcp
```

### claude_desktop_config.json に追加

```json
{
  "mcpServers": {
    "egov-law": {
      "command": "npx",
      "args": ["-y", "egov-law-mcp"]
    }
  }
}
```

## ツール

### search_laws

法令を検索します。

**パラメータ:**
- `keyword` (string, 必須): 検索キーワード
- `category` (number, optional): 法令カテゴリ
  - 1: 憲法・法律
  - 2: 政令・勅令
  - 3: 府省令
  - 4: その他

**例:**
```
search_laws({ keyword: "個人情報保護" })
search_laws({ keyword: "契約", category: 1 })
```

### get_law_text

法令の全文を取得します。

**パラメータ:**
- `law_id` (string): 法令 ID (例: "405AC0000000089")
- `law_number` (string): 法令番号 (例: "平成十五年法律第五十七号")

どちらか一方が必須です。

**例:**
```
get_law_text({ law_id: "405AC0000000089" })
get_law_text({ law_number: "平成十五年法律第五十七号" })
```

### get_article

特定の条文を取得します。

**パラメータ:**
- `law_id` (string, 必須): 法令 ID
- `article` (string, 必須): 条番号 (例: "第一条", "第二十条")
- `paragraph` (number, optional): 項番号

**例:**
```
get_article({ law_id: "405AC0000000089", article: "第一条" })
get_article({ law_id: "405AC0000000089", article: "第二条", paragraph: 2 })
```

## キャッシュ

API レスポンスは自動的にキャッシュされます：

| データ種別 | キャッシュ期間 |
|-----------|--------------|
| 法令一覧 | 24時間 |
| 法令本文 | 7日間 |
| 更新一覧 | 1時間 |

キャッシュは `~/.cache/egov-law-mcp/` に保存されます。

## 対象法令の例

- **印紙税法** - 契約書への収入印紙
- **下請法** - 下請取引の公正化
- **個人情報保護法** - データ保護義務
- **民法** - 契約の基本原則
- **消費者契約法** - B2C 契約の制限
- **会社法** - 企業統治

## e-Gov API について

このサーバーは [e-Gov 法令 API](https://laws.e-gov.go.jp/api/) を使用しています。API は無料で利用可能で、認証不要です。

## ライセンス

MIT
