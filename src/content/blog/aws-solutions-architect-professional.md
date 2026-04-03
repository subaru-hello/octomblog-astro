---
title: "Aws Solutions Architect Professionalに3ヶ月で合格した"
date: 2024-01-01T11:47:42+09:00
draft: false
author: subaru
authorEmoji: 🐙
tags:
- aws
- 資格勉強
categories:
- aws
image: images/blog-covers/aws-solutions-architect-professional.png
---


AWS Soluitons Architect Professional(以降SAP)を一発で合格することができました。

SAPを勉強中の皆さんの助けになればと思い、勉強のログを共有させていただきます。

## 戦績

- 点数

765点（ギリギリ┐(´д｀)┌）

![](https://storage.googleapis.com/zenn-user-upload/5d2b65c5acdf-20240101.png)

- 資格取得にかけた時間

約160時間~170時間

- 資格取得にかかった期間

2ヶ月半

- 資格取得にかかった金額

2万6千円(SAAを合格した時のバウチャーを使用したら受験費用が半額になった)

## 資格対戦時における筆者のステータス

国際政治経済学部国際経済学科を卒業

- webエンジニア歴約2年
	- Typescript, React, Node.js, GraphQLをメインに使用している

- Webアプリ開発会社に勤務（10~19時週5フル出社）

- AWSサービス使用歴は10か月(2023年12月9日時点)

- AWS Solution Architect Asocciateを保持している（2023年8月取得）

- 仕事で開発中のサービスの検証２面を作成したことがある（ECS, ALB, CloudFront ,Lambda,Cognito,API Gateway, CloudWatch, Elasticache等）

## 資格勉強の時に参考にした教材

英語教材はChromeの日本語翻訳を使用しながら使っていました。

### kindleで購入した過去問

**AWS認定ソリューションアーキテクト-プロフェッショナル ~試験特性から導き出した演習問題と詳細解説**

[https://www.amazon.co.jp/AWS認定ソリューションアーキテクト-プロフェッショナル-試験特性から導き出した演習問題と詳細解説-平山-毅/dp/4865942483/](https://www.amazon.co.jp/AWS%E8%AA%8D%E5%AE%9A%E3%82%BD%E3%83%AA%E3%83%A5%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%88-%E3%83%97%E3%83%AD%E3%83%95%E3%82%A7%E3%83%83%E3%82%B7%E3%83%A7%E3%83%8A%E3%83%AB-%E8%A9%A6%E9%A8%93%E7%89%B9%E6%80%A7%E3%81%8B%E3%82%89%E5%B0%8E%E3%81%8D%E5%87%BA%E3%81%97%E3%81%9F%E6%BC%94%E7%BF%92%E5%95%8F%E9%A1%8C%E3%81%A8%E8%A9%B3%E7%B4%B0%E8%A7%A3%E8%AA%AC-%E5%B9%B3%E5%B1%B1-%E6%AF%85/dp/4865942483/ref=pd_bxgy_img_d_sccl_1/355-5105776-1820511?pd_rd_w=rNSO6&content-id=amzn1.sym.5773d2b1-1110-481e-bc73-38bad5475a70&pf_rd_p=5773d2b1-1110-481e-bc73-38bad5475a70&pf_rd_r=2H1MAAE13T64D0GFPJMG&pd_rd_wg=2E5aw&pd_rd_r=54bc7513-8e0c-4ad1-b7e1-e223113df346&pd_rd_i=4865942483&psc=1)

### udemy購入教材

**Be an AWS Solutions Architect Pro! AWS Certified Solutions Architect Professional Practice Tests for the SAP-C02 Exam**

https://www.udemy.com/share/106RD43@zCuFLFSS781rZuMEvVVjrfSsyr5-qD9nZiKcfCAEvP5Wh5Yr_7Etzfnzpbc4Ao12Ng==/

**[NEW 2023] AWS Certified Solutions Architect Professional Video Course | incl. AWS Solutions Architect PRO Practice Test**

https://www.udemy.com/share/104gnw3@YrXSHFWuS_2oRSOD5kBqWnjFnc23anSo62dL54KO8IDyBuovHvBGLmNOfTp5Dhwpbg==/

**NEW 2023 AWS Certified Solutions Architect Professional Practice Test Questions [SAP-C02] Exam Simulator + Explanations**

https://www.udemy.com/share/104bsg3@u0Cz2F1cyodQqXeS_cQ5aAOur5d2BVi4nC7kM1qbqJ_ji6DSLZxO4WM4ZlAD_ET40g==/

### 各AWSサービスを説明する記事

大体DevelopersIOを参考にしていました。

過去問を解いて、何回も間違える問題で使用されているサービスをDevelopersIOで調べる流れです。

オンプレとクラウドのハイブリッド環境におけるhogehoge系(移行戦略、ルーティング戦略等)やアカウント管理、認証認可戦略辺りが個人的に苦手だったので、それらが図解されている記事を読み漁りました。

参考までに、一部記事を以下に置いておきます。

- Site to Site VPC https://docs.aws.amazon.com/ja_jp/vpn/latest/s2svpn/how_it_works.html
- 移行戦略

https://pages.awscloud.com/rs/112-TZM-766/images/Migrating-to-AWS_Best-Practices-and-Strategies_eBook.pdf

- アカウント管理・認証認可

https://dev.classmethod.jp/articles/iam-role-passrole-assumerole/

- オンプレ↔︎クラウドの名前解決

https://aws.amazon.com/jp/cdp/route53/

## 学習方法

過去問を何周もすることを通して知識を蓄えていきました。

まず過去問、そしてわからないサービスをネットで検索。（Site To Site VPCやAssumeRoleはAWS公式Docsを１０回位見返して覚えたような気がします。）

アーキテクトアソシエイトを取得した段階で、各サービスの雰囲気は掴めていたので、参考書で一つ一つのサービスを理解してから過去問に移る方式は非効率だと考えたためです。

「資格勉強の時に使用した教材」で紹介した教材をそれぞれ４周ずつ解きました。

**Be an AWS Solutions Architect Pro! AWS Certified Solutions Architect Professional Practice Tests for the SAP-C02 Exam: ４周 (1ヶ月半)**

**NEW 2023 AWS Certified Solutions Architect Professional Practice Test Questions [SAP-C02] Exam Simulator + Explanations: ４周 (1ヶ月)**

時系列で言うと、

- 9~10月末

**Be an AWS Solutions Architect Pro! AWS Certified Solutions Architect Professional Practice Tests for the SAP-C02 Exam: ４周 (1ヶ月半)**

- 11月

AWS Skill Builder(https://explore.skillbuilder.aws/learn/course/13272/aws-certified-solutions-architect-professional-official-practice-question-set-sap-c02-japanese)

 　→20問中8問正答

AWSが公式で出しているSAP試験演習(https://d1.awsstatic.com/ja_JP/training-and-certification/docs-sa-pro/AWS-Certified-Solutions-Architect-Professional_Sample-Questions.pdf)

　10問中4問正答

Skill BuilderとAWS公式が出している試験演習を解いたらそれぞれ正答率が４割だったので焦って違う過去問に手を出しちゃいました。（使用する過去問は一つの方がいいって林先生も言っていたのに。。）

**NEW 2023 AWS Certified Solutions Architect Professional Practice Test Questions [SAP-C02] Exam Simulator + Explanations: ４周 (1ヶ月)**

- 11月後半〜12月9日(試験当日)

**Be an AWS Solutions Architect Pro! AWS Certified Solutions Architect Professional Practice Tests for the SAP-C02 Exam: 1周 (2週間)**

**AWS認定ソリューションアーキテクト-プロフェッショナル ~試験特性から導き出した演習問題と詳細解説: 1周 (2週間)**

[https://www.amazon.co.jp/AWS認定ソリューションアーキテクト-プロフェッショナル-試験特性から導き出した演習問題と詳細解説-平山-毅/dp/4865942483/](https://www.amazon.co.jp/AWS%E8%AA%8D%E5%AE%9A%E3%82%BD%E3%83%AA%E3%83%A5%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%88-%E3%83%97%E3%83%AD%E3%83%95%E3%82%A7%E3%83%83%E3%82%B7%E3%83%A7%E3%83%8A%E3%83%AB-%E8%A9%A6%E9%A8%93%E7%89%B9%E6%80%A7%E3%81%8B%E3%82%89%E5%B0%8E%E3%81%8D%E5%87%BA%E3%81%97%E3%81%9F%E6%BC%94%E7%BF%92%E5%95%8F%E9%A1%8C%E3%81%A8%E8%A9%B3%E7%B4%B0%E8%A7%A3%E8%AA%AC-%E5%B9%B3%E5%B1%B1-%E6%AF%85/dp/4865942483/ref=pd_bxgy_img_d_sccl_1/355-5105776-1820511?pd_rd_w=rNSO6&content-id=amzn1.sym.5773d2b1-1110-481e-bc73-38bad5475a70&pf_rd_p=5773d2b1-1110-481e-bc73-38bad5475a70&pf_rd_r=2H1MAAE13T64D0GFPJMG&pd_rd_wg=2E5aw&pd_rd_r=54bc7513-8e0c-4ad1-b7e1-e223113df346&pd_rd_i=4865942483&psc=1)

## やらなくても良かったこと
### 動画で理解する

オンライン公演やUdemyの動画で解説系の動画を見て、理解した気になること。

個人的に、動画を見るより、DevelopersIOで出されたブログに載っている図解を見た後に過去問を解き直した方が点数が上がりました。

多分、購入した動画教材が英語だったからです。ぴえん。

### 間違えた問題の傾向と対策を練らない

一日で解く問題数の量をこなすことが目的になってしまうこと。

各サービスの特徴を理解し、サービスをいい感じに活用することで、顧客が解決したい課題を解決することが目標である。

問題集を回す目的は、Well ArchitectedなAWS Solutionを提案するストックを増やす為。

間違えた設問で出てきたサービスを理解しないまま放置しておくと、似たような設問へ応用が効かずに間違える傾向がある為、結果として時間がかかる。

「ああ、また間違えた、、なんでだろう、、まあいいや、今日のノルマは30問解くことだから、次の問題いっちゃおう⭐️」

いっちゃおう⭐️じゃない。

「その選択肢(正解の選択肢)を選ばなかった理由は〇〇だったのに、なんで設問のシチュエーションにおいてその選択肢が正解なるんだろう、、」

自分が設問を選んだ理由と正答のギャップを覚える作業に価値があるんだな〜とSAP資格を通して学習しました。

## 誤った選択肢を選んでしまう原因
誤った選択肢を選んでしまう原因は３つあるなと思いました。

- サービスの特性を知らない。
- サービスの特性をある程度知っているが、他サービスに比べた時の優位性を知らない。
- サービスの特性は理解しているが、シチュエーションにおいて他の選択肢に書かれたサービスの使い方の方がより最適な提案になっている。

### サービスの特性を知らない

Bedrock,Kendra,Amazon Q等のいわゆる生成AIを活用したサービスなど、最近リリースされたようなサービスもあれば、購入した問題集には載ってなかったサービスもある。

「問題を解く→解説を読む→解説でわからないサービスを調べる」というサイクルでは拾いきれなかった問題ならいいですが、一度でもみたことのあるサービスの特性は覚えておきたいですよね。

[AWSの公式ページ](https://d1.awsstatic.com/ja_JP/training-and-certification/docs-sa-pro/AWS-Certified-Solutions-Architect-Professional_Exam-Guide.pdf)に載っている試験で出題されるサービスを見て、見たことのないサービスを調べる。

これで、「サービスの特性を知らない」ということはなくなると思います。

あとは、シチュエーションに応じたサービスの使い方を覚えるだけですね。

### サービスの特性をある程度知っているが、他サービスに比べた時の優位性を知らない。

バッチ処理をどのサービスを使って実施するか、シークレットの管理はどのサービスを使ったらいいか、認証・認可のフローはWebIdentity？SAML?などなど、SAPではサービスの特性について聞かれる問題はほとんどありませんでした。（過去問を解いた感じです。本試験のことは言及できませんが。）

似たサービスはまとめて覚えちゃうのがいいですね。

[Site to Site VPN](https://docs.aws.amazon.com/ja_jp/vpn/latest/s2svpn/how_it_works.html)なんかは特に。

### サービスの特性は理解しているが、シチュエーションにおいて他の選択肢に書かれたサービスの使い方の方がより最適な提案になっている。

オンプレミス環境からクラウドへの移行戦略、マルチアカウント環境における適した権限管理、重要なビジネスロジックを生成するバッチ処理、キャッシュ管理。

今例に挙げた上記のシチュエーションは、顧客が何を重視しているかによって、提案すべきサービスが変わってきますよね。

ネットワークの帯域幅が狭い中でなるはやで完了させたい、既存のワークロードに影響を与えたくない、コストは最低で実施したい、15分以上かかるバッチ処理、キャッシュはクライアント側で管理したい等、顧客の優先事項は様々。

私は、[https://www.amazon.co.jp/AWS認定ソリューションアーキテクト-プロフェッショナル-試験特性から導き出した演習問題と詳細解説-平山-毅/dp/4865942483/](https://www.amazon.co.jp/AWS%E8%AA%8D%E5%AE%9A%E3%82%BD%E3%83%AA%E3%83%A5%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%88-%E3%83%97%E3%83%AD%E3%83%95%E3%82%A7%E3%83%83%E3%82%B7%E3%83%A7%E3%83%8A%E3%83%AB-%E8%A9%A6%E9%A8%93%E7%89%B9%E6%80%A7%E3%81%8B%E3%82%89%E5%B0%8E%E3%81%8D%E5%87%BA%E3%81%97%E3%81%9F%E6%BC%94%E7%BF%92%E5%95%8F%E9%A1%8C%E3%81%A8%E8%A9%B3%E7%B4%B0%E8%A7%A3%E8%AA%AC-%E5%B9%B3%E5%B1%B1-%E6%AF%85/dp/4865942483/ref=pd_bxgy_img_d_sccl_1/355-5105776-1820511?pd_rd_w=rNSO6&content-id=amzn1.sym.5773d2b1-1110-481e-bc73-38bad5475a70&pf_rd_p=5773d2b1-1110-481e-bc73-38bad5475a70&pf_rd_r=2H1MAAE13T64D0GFPJMG&pd_rd_wg=2E5aw&pd_rd_r=54bc7513-8e0c-4ad1-b7e1-e223113df346&pd_rd_i=4865942483&psc=1)を解くことで対策をしました。

Udemyの過去問を何周もし、各サービスの特性をある程度理解できた後にこの本を解くと、Udemyの過去問で間違えた問題の、間違えた理由を言語化につながります。

一個前の試験タイプ（SAP-C01）ですが、顧客がソリューションアーキテクトを雇うシチュエーションはSAP-C02とほぼ同じなので、SAP-C02の学習にもかなり役に立ちました。

## 総括

またSolutions Architect Professionalを一から取得し直すとしたら、下記の流れで戦うと思います。

習慣がついて問題を解くことが辛くなくなるので、毎日コツコツ問題を解くとが大事だと思っています。最初の頃は毎日15問ずつ解くと決めていました。(ノってきたら一日30問、45問と増やしていく。)

1. **NEW 2023 AWS Certified Solutions Architect Professional Practice Test Questions [SAP-C02] Exam Simulator + Explanations**を2周する
    ２回以上間違えた問題は都度DevelopesIOやAWS Docsで調べる。ゆっくりでもいいから理解に徹する。（ゆっくりでもいいから理解することが大事だと牛尾さんも言っていた。）

2. AWSが公式で出しているSAP試験やSkill Builderの問題（無料）を解いて、自分のレベル感を確認する
3. **AWS認定ソリューションアーキテクト-プロフェッショナル ~試験特性から導き出した演習問題と詳細解説を2周する**

今までブラックボックスだったインフラ領域が、うっすらグレーボックスくらいに変わった気がして嬉しいです。

インフラ領域の霧が晴れたことで、顧客からのinputを受け付けて顧客へoutputを返す一連のフローが今までよりクリアになりました。これで、問題の切り分けを今までより一層的確にできるようになりそうです。

本記事を読むことで、一人でも多くのProが生まれることを願っています。