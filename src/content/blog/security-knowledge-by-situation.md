---
title: "セキュリティ、調べたら大量すぎた話と、あなたの玄関に鍵はいくつ必要か"
description: "セキュリティの勉強を始めると情報量に圧倒される。でも必要な守りの厚さは、住む場所によって変わる。シチュエーション別にまとめた"
date: 2026-04-11T00:00:00+09:00
author: subaru
authorEmoji: 🐙
tags:
- セキュリティ
- Webアプリ
- 設計
categories:
- engineering
image: images/blog-covers/security-knowledge-by-situation.webp
---

セキュリティの勉強をしよう、と思い立った日のことを覚えている。仕事でWebアプリを作っている以上、無知でいるのはまずい。そういう危機感みたいなものが急に湧いて、「Webアプリ セキュリティ」と検索した瞬間、大量のテキストが降ってきた。

SQLインジェクション、XSS、CSRF、SSRF、JWT、OAuth、HSTS、CSP、CORS、RBAC、STRIDE、MITRE ATT&CK、PCI DSS、SOC2、OWASP Top 10、ペネトレーションテスト、バグバウンティ、ゼロトラスト、Defense in Depth——。

スクロールしながら、これは一生終わらない、と思った。登山口に立ったら、山頂が見えない山だったときの感覚に近い。というか山の全体像すら見えていない。

---

しばらく途方に暮れた後で、ふと気づいた。

田舎に家を建てた友人の話を思い出したのだ。彼は移住したとき、玄関の鍵をほとんどかけなかった。近所の人の顔がわかって、見知らぬ人間が通れば一目瞭然な場所では、それで十分らしい。一方で、東京の繁華街近くに住んでいる僕の知り合いは、ディンプルキーにオートロック、さらに補助錠まで付けていた。

同じ「玄関」でも、必要な鍵の数はまるで違う。

セキュリティも、たぶんそういうことなんじゃないか。守るべきものの価値と、攻撃される可能性の高さで、必要な対策の厚さが変わる。全員が全部やる必要はないし、全員が何もしなくていいわけでもない。

そう考えてから、整理がだいぶ楽になった。

---

## シチュエーション1：田舎の鍵なし——個人ブログ・趣味の静的サイト

まず、このブログみたいな静的サイトの話から始めよう。

Astroや Hugo で作った、特にユーザーがログインしない、フォームもない、コメント欄もない。そういうサイトに必要なセキュリティは、実はかなり限られる。攻撃者にとっての「旨み」がほとんどないからだ。

やることは少ない。

- HTTPS にする（Let's Encrypt で無料）
- 依存ライブラリの CVE を Dependabot に監視させる
- コンテンツホスティング先（Cloudflare Pages など）のアクセストークンを GitHub Secrets に置く

以上である。XSSの対策を念入りに考えるより、記事を書く時間に使ったほうがいい。

唯一気をつけるとしたら、外部スクリプトの読み込みだ。Google Analytics や広告ネットワークを置く場合、[CSP（Content Security Policy）](/docs/concepts_webapp_security_headers)を設定しておくと、サードパーティのスクリプト汚染にある程度対応できる。でもそれくらい。

田舎に住んでいるなら、鍵の複雑さよりも、ドアが存在することの方が大事なのかもしれない。

---

## シチュエーション2：郊外の一軒家——ログイン機能のある個人サービス・社内ツール

ユーザーがアカウントを作れる。セッションがある。DB にデータが入っている。

このあたりから話が変わってくる。ドアに鍵が必要になる。

まずやるべきことは、認証まわりの基本を抑えることだ。[セッション管理とJWT・OAuthの落とし穴](/docs/concepts_webapp_security_authn_authz)は意外に深く、「ログインできたら OK」では全然ない。

ログイン後にセッション ID を再生成しているか。JWT の署名を検証しているか。パスワードを bcrypt か Argon2 でハッシュ化しているか。これを読んでいるあなたが「全部やってる」と自信を持って言えるなら、それはそれで素晴らしい。言えない場合は、まずここから始めるといい。

それから、[インジェクション攻撃](/docs/concepts_webapp_security_injection)と[XSS](/docs/concepts_webapp_security_xss)の基礎も押さえておきたい。プリペアドステートメントを使えば SQLi は大半防げるし、テンプレートエンジンの自動エスケープを信頼すれば XSS も減る。難しい話ではなく、「やっておかないとまずい最低限」の話だ。

社内ツールだから安心、という考え方にはあまり同意できない。内部犯行やラテラルムーブメント（内部に侵入してから横展開する攻撃）を考えると、社内だからといって認証を甘くする理由にはならない。郊外だからといって鍵をかけなくていいわけではない。

---

## シチュエーション3：都市部の普通の家——個人情報を扱うBtoCサービス

ユーザーの名前・メールアドレス・住所が入っている。サービスの規模が大きくなってくると、攻撃者にとっての「旨み」が一気に上がる。個人情報は、まとめて売れるものだ。

ここから先は、[OWASP Top 10](/docs/concepts_security_owasp_top10) を一度通読することをすすめる。Broken Access Control（認可の不備）が第1位であることが示すように、最も多い被害は「技術的に複雑な攻撃」ではなく、「あるべき認可チェックが抜けていた」という単純なミスによるものだ。

具体的に言うと、IDOR（Insecure Direct Object Reference）と呼ばれる攻撃がある。`/api/orders/12345` にアクセスしたとき、ログインユーザーが注文 12345 のオーナーかどうかを確認していないと、誰でも誰の注文でも見られる。これは実装ミスとしては地味だが、影響は致命的だ。

また、[CSRF](/docs/concepts_webapp_security_csrf_clickjacking) への対策も必要になってくる。状態変更を行う操作（住所変更・退会・送金など）に CSRF トークンか SameSite Cookie が設定されていない場合、攻撃者が用意したサイトにアクセスしただけでユーザーの意図しない操作が実行される。

それから、セキュリティヘッダーも設定しておきたい。[HSTS・CSP・X-Content-Type-Options](/docs/concepts_webapp_security_headers)。設定するだけで攻撃の幅が狭まる割に、手間は少ない。

住んでいる場所が都市になったなら、鍵はかける。でもそれだけでいい。金庫まではまだいらない。

---

## シチュエーション4：都市部の高級住宅——ECサイト・決済・大量の個人情報

クレジットカードが入っている。購買履歴が入っている。利用者が万単位いる。

もうここまで来ると、セキュリティは「やったほうがいいもの」ではなく「やらないと法的にアウトになるもの」の世界に入ってくる。PCI DSS（カード業界のセキュリティ基準）や個人情報保護法の対応が求められる。

技術的にやることは増える。[API セキュリティ](/docs/concepts_webapp_security_api) では、レートリミット・SSRF 対策・Mass Assignment 防止が重要になる。攻撃者は自動化ツールで大量のリクエストを送ってくるし、API の設計ミスが直接データ漏洩につながる。

[DevSecOps](/docs/concepts_security_devsecops) の観点も必要だ。Semgrep や Bandit といった SAST ツールを CI に組み込んで、コードのレビュー段階で脆弱性を検出する。依存ライブラリの CVE を Trivy や Snyk で定期的にスキャンする。リリース前に OWASP ZAP で DAST スキャンを走らせる。

インシデントが起きたときの対応も事前に決めておく必要がある。[インシデントレスポンス](/docs/concepts_security_incident_response) の手順、ログの保全、影響範囲の調査、通知の手続き。EC サイトで漏洩が起きたとき、「どうしよう」から始まる会社と、Playbook を開く会社では、対応の質が天と地ほど違う。

都市の高級住宅には、ディンプルキーと補助錠と、ホームセキュリティが必要だ。

---

## シチュエーション5：銀座の高層マンション・金庫付き——金融・医療・インフラ・大規模プラットフォーム

正直に言うと、このレベルになると、僕みたいな開発者が個人で調べて対応できる話ではなくなってくる。専任のセキュリティチームがいる世界だ。

それでも、知識として知っておく価値はある。

[脅威モデリング（STRIDE）](/docs/concepts_security_threat_modeling) で設計段階から攻撃経路を洗い出すこと。[Kubernetes セキュリティ](/docs/concepts_k8s_security_overview) でインフラレベルの攻撃面を最小化すること。[MITRE ATT&CK フレームワーク](/docs/concepts_security_mitre_attack) で攻撃者の戦術を体系的に理解して防御に活かすこと。[GRC（ガバナンス・リスク・コンプライアンス）](/docs/concepts_security_grc) で組織全体のリスク管理を構造化すること。

そして、ゼロトラストという考え方。「内側にいるから信頼する」をやめる。認証は常に行う。最小権限で動かす。[セキュリティ設計原則](/docs/concepts_security_design_principles) の話だが、この発想はどんなシチュエーションでも根底に置いておくといいと思う。

銀座の高層マンションには、生体認証と24時間警備と監視カメラが必要だ。それは確かに大げさに聞こえるが、守るものの価値に対して対策が釣り合っているなら、大げさではない。

---

## 結局、自分はどこにいるか

冒頭で「大量すぎて困った」と書いたが、今は少し整理できた気がしている。

セキュリティの知識が膨大なのは、守るべきものと場所が無数にあるからだ。全部やる必要はない。でも自分が今どの場所に立っているかを把握することが、最初のステップだと思う。

田舎に住んでいるのに24時間監視カメラを設置する必要はない。でも銀座に引っ越すのにドアの鍵をかけないのは怖すぎる。

まず自分のサービスを見て、そこにある「旨み」の量と、見られやすさを考える。攻撃者が得られるものが多く、人目につく場所にあるほど、鍵は必要になる。

それだけのことだ。

---

**ドキュメントシリーズへのリンク（詳細はここで）:**

- [セキュリティ概要・全体マップ](/docs/concepts_security_overview)
- [脅威モデリング（STRIDE）](/docs/concepts_security_threat_modeling)
- [セキュリティ設計原則（Zero Trust）](/docs/concepts_security_design_principles)
- [OWASP Top 10](/docs/concepts_security_owasp_top10)
- [認証・認可（OAuth2・JWT・MFA）](/docs/concepts_security_auth)
- [インジェクション攻撃（SQLi・XSS）](/docs/concepts_webapp_security_injection)
- [XSS・CSP](/docs/concepts_webapp_security_xss)
- [CSRF・Clickjacking・CORS](/docs/concepts_webapp_security_csrf_clickjacking)
- [認証・認可の実装ミス（セッション・JWT）](/docs/concepts_webapp_security_authn_authz)
- [API セキュリティ（OWASP API Top 10）](/docs/concepts_webapp_security_api)
- [セキュリティヘッダー完全ガイド](/docs/concepts_webapp_security_headers)
- [Webアプリセキュリティテスト実践](/docs/concepts_webapp_security_testing)
- [Kubernetes セキュリティ概要](/docs/concepts_k8s_security_overview)
- [インシデントレスポンス](/docs/concepts_security_incident_response)
- [DevSecOps](/docs/concepts_security_devsecops)
- [MITRE ATT&CK](/docs/concepts_security_mitre_attack)
- [GRC・リスク管理](/docs/concepts_security_grc)
