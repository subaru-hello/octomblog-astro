---
title: "Project Glasswing - AIによる世界のソフトウェアセキュリティ保護"
category: "概念"
series:
  - "Anthropic Research - プロダクト"
source: "https://www.anthropic.com/glasswing"
tags: ["anthropic", "security", "vulnerability", "glasswing", "claude-mythos", "cybersecurity", "open-source"]
date: "2026-04-09"
emoji: "🛡️"
order: 6
---

## 概要

AnthropicがAWS、Apple、Google、Microsoft、NVIDIAなど12の主要パートナーと共同で推進する大規模セキュリティイニシアティブ。新型AIモデル「Claude Mythos Preview」を使って世界の重要ソフトウェアの脆弱性を発見・修正することを目標とする。

## 要点

- 中核はAnthropicが開発した**Claude Mythos Preview** — CyberGymベンチマークで83.1%の脆弱性再現率（Opus 4.6は66.6%）
- OpenBSD、FFmpeg、Linuxカーネルなど長年発見されなかった脆弱性を特定済み
- Mythos Preview利用料として最大1億ドルのクレジットを提供
- オープンソースセキュリティへの直接寄付として250万ドル（Alpha-Omega/OpenSSF経由）、Apache Software Foundationへ150万ドル
- 40以上の追加組織にアクセス権を付与

## 主要概念・技術

### Claude Mythos Previewの能力

従来のAIを大幅に上回るサイバーセキュリティ能力を持つ専用モデル：

- 全ての主要OSおよびWebブラウザで数千の未発見脆弱性を検出
- 自律的なエクスプロイト開発が可能
- 長年見落とされてきた深い欠陥の発見

#### CyberGymベンチマーク

| モデル | 脆弱性再現率 |
|---|---|
| Claude Mythos Preview | 83.1% |
| Claude Opus 4.6 | 66.6% |

### 具体的な発見実績

| 対象 | 内容 |
|---|---|
| OpenBSD | 27年前から存在したリモートクラッシュ脆弱性 |
| FFmpeg | 16年前から存在し、500万回の自動テストでも見逃された欠陥 |
| Linuxカーネル | 長期間見落とされていた問題を特定 |

OpenBSDやFFmpegはセキュリティに定評あるプロジェクトであり、そこで長年未発見だった脆弱性を発見したことは、AIが従来の静的解析や自動テストでは届かない深さの探索を実現していることを示している。

### 財務的コミットメント

| 対象 | 内容 |
|---|---|
| Mythos Preview利用クレジット | 最大1億ドル |
| Alpha-Omega / OpenSSF | 250万ドル（オープンソースセキュリティ組織） |
| Apache Software Foundation | 150万ドル |

### 展開戦略と料金

40以上の組織が自社およびオープンソースシステムのスキャンにMythos Previewを利用できる。商用利用の料金は1トークンあたり25〜125ドルに設定されている。

### 国家安全保障との位置付け

Anthropicは米国政府と継続的に協議しており、民主主義国家がAI技術において「決定的なリード」を維持することが戦略的目標として強調されている。

### 攻防における意義

このイニシアティブは、サイバーセキュリティにおける攻撃と防御の軍拡競争が新段階に入ったことを示す。同じAI能力が攻撃者に悪用される前に、防御側が優位を確保することが戦略的焦点であり、Anthropicは「防御側の先行投資」としてこのプロジェクトを位置付けている。
