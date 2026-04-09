---
title: MITRE ATT&CK フレームワーク
category: "概念"
emoji: "🗺️"
order: 811
date: "2026-04-08"
series: [セキュリティ]
tags: ["セキュリティ", "MITRE ATT&CK", "TTPs", "脅威インテリジェンス", "Red Team", "Blue Team"]
source: "MITRE ATT&CK Design and Philosophy（MITRE, 2020）/ The MITRE ATT&CK Framework（Katie Nickels, 2019）/ ATT&CK for Enterprise（attack.mitre.org）/ Threat Intelligence and the Limits of Malware Analysis（Bianco, 2014）"
---

## MITRE ATT&CK とは

**実際の攻撃から帰納的に構築された、攻撃者の戦術・技術・手順（TTPs）のナレッジベース。**

MITRE（米国の非営利研究機関）が2013年から公開・更新している。  
Red Team・Blue Team・脅威インテリジェンス・SOC 運用など、セキュリティのあらゆる場面で参照される共通言語。

```
ATT&CK = Adversarial Tactics, Techniques, and Common Knowledge
```

---

## なぜ ATT&CK が重要か

### Pyramid of Pain（苦痛のピラミッド）

David Bianco（2014年）が提唱した概念。攻撃者の「行動指標」の種類によって、それを無効化したときに攻撃者が感じる「苦痛」の大きさが異なる。

```
          /  TTPs   \   ← 最も苦痛（行動パターンそのものを変える必要がある）
         /───────────\
        / Tools       \
       /───────────────\
      / Network / Host  \  ← Artifacts
     /───────────────────\
    / Domain Names         \
   /───────────────────────\
  / IP Addresses             \
 /─────────────────────────────\
/ Hash Values（最も簡単に変更可）\
```

**IOC（IP・ハッシュ値）のブロックは簡単に回避される。  
TTPs（どう行動するか）を検知・対応することが最も効果的な防御になる。**

ATT&CK は TTPs を体系化したナレッジベースとして、この最上位レイヤーの防御を支援する。

---

## ATT&CK の構造

### 3つの概念

| 概念 | 説明 | 例 |
|---|---|---|
| **戦術（Tactics）** | 攻撃者が達成しようとする目標（Why） | 初期侵入・権限昇格・データ持ち出し |
| **技術（Techniques）** | 戦術を達成する手段（How） | フィッシング・Pass-the-Hash |
| **手順（Procedures）** | 特定の脅威アクターが使う具体的な実装 | APT29 が使う特定のPowerShellコマンド |

### Enterprise Matrix の14戦術

ATT&CK Enterprise（Webシステム・クラウドが対象）の14の戦術列。  
攻撃者のキルチェーンに沿って左から右に並んでいる。

| # | 戦術 | 英語 | 概要 |
|---|---|---|---|
| TA0043 | 偵察 | Reconnaissance | 攻撃前の情報収集 |
| TA0042 | リソース開発 | Resource Development | インフラ・ツール・アカウントの準備 |
| TA0001 | 初期侵入 | Initial Access | ターゲットへの最初の足がかり |
| TA0002 | 実行 | Execution | 悪意あるコードの実行 |
| TA0003 | 永続化 | Persistence | 侵入後のアクセス維持 |
| TA0004 | 権限昇格 | Privilege Escalation | より高い権限の取得 |
| TA0005 | 防御回避 | Defense Evasion | セキュリティツールの回避 |
| TA0006 | 認証情報アクセス | Credential Access | パスワード・トークンの窃取 |
| TA0007 | 探索 | Discovery | 内部環境の把握 |
| TA0008 | 横断 | Lateral Movement | 他のシステムへの移動 |
| TA0009 | 収集 | Collection | ターゲットデータの収集 |
| TA0011 | C2通信 | Command & Control | 外部との通信チャネル確立 |
| TA0010 | 持ち出し | Exfiltration | データの外部転送 |
| TA0040 | 影響 | Impact | システム・データの破壊や暗号化 |

---

## 技術（Techniques）の読み方

各技術には一意のIDが割り当てられ、サブ技術も存在する。

```
T1566          ← フィッシング（Phishing）
├── T1566.001  ← スピアフィッシング（添付ファイル）
├── T1566.002  ← スピアフィッシング（リンク）
└── T1566.003  ← スピアフィッシング（サービス経由）
```

各技術のページには以下が記載されている：
- **説明**: 攻撃手法の詳細
- **手順の例**: 実際の APT グループが使った具体的な事例
- **検知方法（Detection）**: SOCが監視すべきログ・イベント
- **緩和策（Mitigation）**: 防御のための設定・対策

---

## 主要な攻撃技術の例

### T1078: Valid Accounts（正規アカウントの悪用）

```
攻撃者が盗んだ認証情報で正規アカウントとしてログインする。
アンチウイルスには引っかからない。

検知: 通常と異なる時間・場所・デバイスからのログインを SIEM で相関検知
緩和: MFA の必須化・異常ログイン検知・CrowdStrike / Entra ID Protection
```

### T1059: Command and Scripting Interpreter（スクリプトインタープリタ）

```
PowerShell / Bash / Python などを使って悪意あるコードを実行する。
ファイルレス攻撃（メモリ上で実行）に使われることが多い。

サブ技術:
  T1059.001: PowerShell
  T1059.003: Windows Command Shell
  T1059.006: Python

検知: 難読化されたコマンドライン引数・Base64エンコードの検出
緩和: PowerShell Constrained Language Mode・AppLocker
```

### T1055: Process Injection（プロセスインジェクション）

```
正規プロセス（explorer.exe 等）に悪意あるコードを注入して実行する。
セキュリティツールから見えにくくなる（Defense Evasion にも分類）。

検知: 異常なプロセス間のメモリ書き込み・CreateRemoteThread API コール
緩和: EDR（Endpoint Detection & Response）による行動ベース検知
```

### T1486: Data Encrypted for Impact（ランサムウェア）

```
ファイルを暗号化して身代金を要求する。
Impact（影響）戦術の代表的な技術。

検知: 大量ファイルのアクセス・暗号化拡張子への変更
緩和: 定期バックアップ（オフライン・エアギャップ）・最小権限
```

---

## ATT&CK の活用パターン

### Red Team での活用

```
エミュレーションプラン:
  特定の APT グループ（例: APT29 / Cozy Bear）の TTPs を ATT&CK で確認
  → 同じ手順で攻撃をシミュレーション
  → 組織の検知・対応能力を評価する

ツール: MITRE Caldera（自動攻撃エミュレーション）
        Atomic Red Team（GitHub, Red Canary）
```

### Blue Team / SOC での活用

```
検知カバレッジの可視化:
  ATT&CK Navigator（無料Webツール）でマトリクスに色付け
  → 自組織が検知できる技術（緑）・できない技術（赤）を可視化
  → 検知ギャップを埋めるための SIEM ルール開発に優先順位をつける
```

### 脅威インテリジェンスでの活用

```
インシデント報告書の標準化:
  「攻撃者はフィッシングを使った」→「T1566.001 を使用した」
  と表現することで、組織をまたいだ情報共有が可能になる。

CTI（Cyber Threat Intelligence）プラットフォームとの統合:
  MISP・OpenCTI・Anomali などで IOC と TTP を関連付けて管理
```

---

## ATT&CK Navigator

ATT&CK の公式無料Webツール。マトリクスを可視化・注釈できる。

```
活用例:
  ① 自組織の検知カバレッジを色分け（青=検知あり、赤=検知なし）
  ② インシデントで使われた技術を赤でマーク → 事後報告に使用
  ③ 脅威グループ（APT29等）の既知TTPs を重ねてリスク評価
  ④ 複数のレイヤーを比較（Red Team vs Blue Team のカバレッジギャップ分析）
```

---

## ATT&CK と他のフレームワークとの関係

| フレームワーク | 関係 |
|---|---|
| Cyber Kill Chain（Lockheed Martin） | 攻撃フェーズを7段階で定義。ATT&CKよりマクロな視点 |
| NIST CSF | リスク管理・ガバナンスのフレームワーク。ATT&CKで検知・対応を強化できる |
| D3FEND | MITRE が提供する防御側のナレッジベース。ATT&CKの攻撃に対応する防御策を定義 |
| SHIELD（Active Defense） | MITRE の能動的防御フレームワーク。攻撃者を罠にかける技術を定義 |

### Cyber Kill Chain との比較

```
Kill Chain（7段階）:
  偵察 → 武器化 → 配送 → 攻撃実行 → インストール → C2確立 → 目的実行

ATT&CK（14戦術）:
  より細かく、実際の攻撃者の行動に基づく。
  Kill Chain は「攻撃の流れを断ち切る」思想。
  ATT&CK は「個々の TTPs を検知・対応する」思想。
```

---

## 参考文献

- MITRE Corporation『ATT&CK Design and Philosophy』（2020, 無料公開）— ATT&CK の設計思想と活用方法の公式解説
- attack.mitre.org — ATT&CK の公式ナレッジベース（常に最新版）
- David Bianco『The Pyramid of Pain』（2014）— IOC vs TTPs の重要性を提唱したブログ記事
- Katie Nickels & John Wunder『Finding the Middle Ground in Threat Intel』（SANS, 2019）— ATT&CK を実際の CTI 業務に活用する方法
- Red Canary『Atomic Red Team』（GitHub）— ATT&CK の各技術をテストするオープンソースのテストケース集
