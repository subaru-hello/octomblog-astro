---
title: "Model Context Protocol（MCP）- AIとデータソースを繋ぐ標準プロトコル"
category: "概念"
series:
  - "Anthropic Research - プロダクト"
source: "https://www.anthropic.com/news/model-context-protocol"
tags: ["anthropic", "mcp", "protocol", "integration", "open-source", "ai-tools"]
date: "2026-04-09"
emoji: "🔌"
order: 2
---

## 概要

Anthropicが2024年11月25日にオープンソース化した標準プロトコル。AIアシスタントとデータが存在する各種システムとの接続を統一化し、「データソースごとに専用実装が必要」という従来の問題を解決する。

## 要点

- 新しいデータソースのたびにカスタム実装が必要だった問題を、統一プロトコルで解決する
- GitHub上で仕様書とSDKをオープンソースとして公開
- Claude Desktopアプリでのローカルサーバー接続に対応
- Block、Apollo等の早期導入企業や、Zed、Replit、Codeium、Sourcegraphなどの開発ツール企業が参加
- 全Claude.aiプランでサポート

## 主要概念・技術

### MCPが解決する問題

AIシステムをさまざまなデータソースに接続する際、従来は「データソースごとに専用のカスタム実装」が必要だった。組織内のツールが増えるほど実装コストが比例して増大する構造的問題があった。

MCPはこれを**単一の標準プロトコル**で解決する。一度MCPに対応すれば、対応済みの全AIシステムと接続できるという相互運用性を実現する。

### 技術的な構成

MCPの主要コンポーネント：

| コンポーネント | 内容 |
|---|---|
| 仕様書・SDK | GitHub上でオープンソース公開 |
| Claude Desktop対応 | ローカルMCPサーバーへの接続 |
| 事前構築済みサーバー | 主要サービス向けのリファレンス実装 |

### 対応済みサービス（事前構築済みMCPサーバー）

- Google Drive
- Slack
- GitHub
- Git
- PostgreSQL
- Puppeteer（ブラウザ自動化）

### エコシステムの広がり

**早期採用企業**: Block、Apollo

**開発ツールパートナー**: Zed、Replit、Codeium、Sourcegraph

これらのパートナーが参加することで、MCPは特定ベンダー依存のプロトコルではなく、業界標準として確立される方向性を示している。

### Building Effective Agentsとの関係

Anthropicの[エージェント構築ガイド](./concepts_anthropic-product_building-effective-agents.md)でも言及されており、「拡張LLM」の基盤ブロックとしてサードパーティツール統合の実装アプローチの一つに位置付けられている。
