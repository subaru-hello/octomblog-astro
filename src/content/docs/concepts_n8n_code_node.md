---
category: "概念"
order: 126
title: n8n Codeノード・カスタム処理
description: n8nのCodeノードでJavaScript/Pythonを記述してカスタム処理を実装する方法。データ変換・外部ライブラリ利用・複数item処理のパターンを解説。
tags: ["n8n", "Codeノード", "JavaScript", "Python", "カスタム処理", "データ変換"]
emoji: "💻"
date: "2026-04-09"
source: "https://docs.n8n.io/code/"
series:
  - n8nワークフロー自動化
---

## Codeノードとは

組み込みノードで対応できない処理をJavaScriptまたはPythonで自由に記述できるノード。データ変換・複雑な計算・文字列操作などに使用する。

## 対応言語と実行環境

| 言語 | 環境 | 利用可能なもの |
|---|---|---|
| JavaScript | Node.js | 標準ライブラリ + 一部npm（後述） |
| Python | Python 3 | 標準ライブラリのみ |

## 基本的な書き方（JavaScript）

### 全itemを処理する場合（デフォルト）

```javascript
// 入力: 全itemの配列を処理
for (const item of $input.all()) {
  item.json.fullName = `${item.json.firstName} ${item.json.lastName}`;
}
return $input.all();
```

### 各itemを個別処理する場合（Run Once for Each Item）

```javascript
// 入力: 1件のitem
const name = $json.name;
const email = $json.email.toLowerCase();

return { json: { name, email } };
```

## よく使うパターン

### 配列の整形・フィルタリング

```javascript
const items = $input.all();
const filtered = items.filter(item => item.json.status === 'active');
return filtered.map(item => ({
  json: {
    id: item.json.id,
    name: item.json.name,
  }
}));
```

### 日付フォーマット変換

```javascript
const date = new Date($json.createdAt);
return {
  json: {
    ...$json,
    formattedDate: date.toLocaleDateString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    })
  }
};
```

### 前のノードのデータ参照

```javascript
// 別ノード「GetUser」のデータを参照
const user = $('GetUser').first().json;
return { json: { ...$json, userId: user.id } };
```

## 利用可能なビルトイン変数

| 変数 | 内容 |
|---|---|
| `$input.all()` | 全inputアイテムの配列 |
| `$input.first()` | 最初のinputアイテム |
| `$json` | 現在のitemのjsonデータ |
| `$('NodeName').all()` | 指定ノードの全出力 |
| `$now` | 現在日時（Luxonオブジェクト） |
| `$env.VAR_NAME` | 環境変数の値 |

## npmパッケージの利用

n8nのセルフホスト環境では、環境変数でnpmパッケージを許可できる。

```bash
# docker-compose.yml or .env
NODE_FUNCTION_ALLOW_EXTERNAL=lodash,crypto-js,papaparse
```

```javascript
const _ = require('lodash');
const grouped = _.groupBy($input.all().map(i => i.json), 'category');
return [{ json: grouped }];
```

## Pythonでの記述

```python
items = _input.all()
result = []
for item in items:
    data = item.json
    data['upper_name'] = data['name'].upper()
    result.append({'json': data})
return result
```

## ユースケース

| ユースケース | 説明 | リンク |
|---|---|---|
| 複雑なデータ変換 | JavaScriptで多段変換処理 | [→ doc](./concepts_n8n_usecase_data_transform_js.md) |
| PDF自動生成 | npmライブラリでPDF作成 | [→ doc](./concepts_n8n_usecase_pdf_generation.md) |
| カスタムバリデーション | 入力データの検証ロジック実装 | [→ doc](./concepts_n8n_usecase_custom_validation.md) |

## 公式ドキュメント

- https://docs.n8n.io/code/
- https://docs.n8n.io/code/builtin/
