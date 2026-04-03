---
title: "PipecdのControl PlaneとPipedを起動してみる"
date: 2024-10-14T22:09:38+09:00
description: "PipecdのControl PlaneとPipedを起動してみる"
draft: false
author: subaru
authorEmoji: 🐙
tags:
  - 触ってみる
  - CICD
categories:
  - 開発生産性
image: images/blog-covers/pipecd.png
---

## はじめに

今回は、[PipeCD](https://github.com/pipe-cd/tutorial/blob/main/content/ja/30-install/01-git.md)を実際に触ってみて、Control PlaneとPipedを起動するまでの手順をまとめてみた。普段はKubernetes（k8s）を触ったことがないので、業務でも使っているECSをPipedにデプロイしてみることにした（言葉の使い方が合っているのかわからないけど）。

## PipeCDとは
![](https://storage.googleapis.com/zenn-user-upload/6aa76b8598d9-20241014.png)
PipeCDは、様々なサーバーレスプラットフォームで統一的なGitOpsを提供するProgressive Deliveryツールとある。CI/CDのうち、特にCD（Continuous Delivery）を担当していて、指定された場所に配置されたアーティファクトを実際にデプロイし、ユーザーに届ける役割を持っている。（参考：[CyberAgent技術ブログ](https://www.cyberagent.co.jp/way/list/detail/id=30032）)


![](https://storage.googleapis.com/zenn-user-upload/b9e32d9c68f7-20241014.png)

これまで自分は、GitHub、JenkinsとAWS Codeシリーズを組み合わせたCI/CDパターンしか経験がなく、PipeCDの全貌がすぐにはイメージできなかった。でも、例えばあるサービスはk8s、別のサービスはECSを使っているような企業で、ノウハウを横断的に共有したい場合には、PipeCDを使うと便利なのかもしれない。

また、PipeCDはカナリアリリースやブルーグリーンデプロイメントという2つのデプロイ手法を採用している。これらはいずれも、システムの状態を監視し、設定した閾値を超えるメトリクスが検知された場合にすぐにロールバックできるという点で、プログレッシブデリバリーの概念を踏襲したリリース手法だ。

### Progressive Delivery
> PipeCDには[Automated deplyment analysis](https://pipecd.dev/docs/user-guide/automated-deployment-analysis/)という、メトリクスツールと連携して、メトリクスが設定した閾値を満たしていない場合に自動でロールバックする機能があります。これはまさにProgressive Deliveryのための機能です。
> Bucketeerでは、Analysis用のテンプレートファイル (analysis-template.yaml) にリクエストのエラーレートが1%以上だと失敗となるような設定を書いています。このテンプレートをデプロイ設定ファイル (.pipe.yaml) から参照して、デプロイパイプラインに分析ステージを設定しています。
(引用: https://developers.cyberagent.co.jp/blog/archives/30573/)

自分はこれまで、デプロイ完了後に手動でエラーが出ていないかを確認していた（AWSマネジメントコンソールからCloudWatch Logsを見たり、該当ページへアクセスして動作確認したり）。でも、メトリクスに閾値を設定して、Control Plane上で全て完結できるのはすごく便利だと感じた。

### Controll Plane and Piped
![](https://storage.googleapis.com/zenn-user-upload/cf394512ed7f-20241014.png)
PipeCDは、Control PlaneとシングルバイナリからなるPipedエージェントの2つで構成されている。

- Piped：任意のプラットフォーム（k8s、ECS、Lambda、Cloud Runなど）にデプロイできて、設定されたGitHubリポジトリを監視する。リポジトリに変更が加えられると、Control PlaneにgRPCコールを送り、デプロイを開始する。
- Control Plane：Web UIを提供していて、認証/認可、デプロイの状態や履歴などを確認できる。Control Planeは、デプロイやアプリのモデルを保存するDataStoreや、ログを保存するFileStoreなど、5つのコンポーネントで構成されている。これらのコンポーネントを活用して、デプロイの状態やPipedから送られてくるシグナルを検知する。

## 実際に触ってみる
公式のチュートリアルに沿って、PipeCDを起動してみた。

### Control Planeの起動
まずは、Control Planeを立ち上げる。
これがControll Brain。UIを提供していて、各プラットフォームに置いたPipedの現在の状態やデプロイ履歴などをみることができる。
![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/d754495e-9e0f-4a9f-90a3-d9033bf94c16/fa3c6979-05c2-425b-a1fc-cb71eb82919e/image.png)

ひとまずControl Planeを立ち上げることができた。

### Pipedの起動
次は、シングルバイナリのPipedエージェントをローカルで実行してみる。

![image.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/d754495e-9e0f-4a9f-90a3-d9033bf94c16/2a484c39-a472-47bc-917f-983e9eb8cde0/image.png)

注意：インターネット接続されていないサーバーでの検証のため、クレデンシャル情報はそのまま公開しているが、実際の環境では適切な管理が必要。

```plaintext
791a677d-ef2c-403e-bafc-5aeed2dc90e2
gq5pli28zqw4gohv38la84fnx5g0vytun3gy0u4ge8ltt0t0br
Z3E1cGxpMjh6cXc0Z29odjM4bGE4NGZueDVnMHZ5dHVuM2d5MHU0Z2U4bHR0MHQwYnI=
```

Pipedを起動しようとすると、以下のエラーが発生した。

```cpp
./piped piped --config-file=./piped.yaml --insecure
```

原因はpiped.yamlにありそう

```cpp
failed to report piped meta to control-plane, wait to the next retry    {"calls": 1}
failed to fetch from remote     {"repo-id": "tutorial-repo", "remote": "https://github.com/subaru-hello/React-Pipecd.git", "repo-cache-path": "/var/folders/5m/kds1j17j0ms1zxtpsmdrk3dm0000gn/T/gitcache2142117600/tutorial-repo", "out": "", "error": "context canceled"}
failed while running    {"error": "failed to sync events first time: failed to list events: rpc error: code = Unavailable desc = error reading from server: EOF"}
github.com/pipe-cd/pip

```

**解決策**

公式Docを見て、pipedKeyFileではなく、pipeKeyDataを指定したらpipedを起動できた(https://pipecd.dev/docs-v0.49.x/user-guide/managing-piped/configuration-reference/)

- piped.yaml

```cpp
# This is a configuration for running a Piped. See https://pipecd.dev/docs/user-guide/managing-piped/configuration-reference/ for details.
apiVersion: pipecd.dev/v1beta1
kind: Piped
spec:
  apiAddress: localhost:8080
  projectID: tutorial
  pipedID: 791a677d-ef2c-403e-bafc-5aeed2dc90e2
  # pipedKeyFile: /Users/subaru/development/parse-check/tutorial/src/install/piped/piped.yaml. // ここをコメントアウトして、
  pipedKeyData: Z3E1cGxpMjh6cXc0Z29odjM4bGE4NGZueDVnMHZ5dHVuM2d5MHU0Z2U4bHR0MHQwYnI= // こっちを設定した
  repositories:
    - repoID: first-piped
      remote: https://github.com/subaru-hello/React-Pipecd.git # [EDIT_HERE] The HTTPS URL of your repository.
      branch: main
  syncInterval: 15s
  platformProviders:
    # [EDIT_HERE] Unco
```

**起動ログ**
```cpp
successfully collected and reported metrics    {"duration": 0.122166167}
there was no config file for Event Watcher in .pipe directory   {"repo-id": "first-piped", "error": "not found"}
configuration for Event Watcher in application configuration not found  {"repo-id": "first-piped"}
found 0 candidates: 0 commit candidates and 0 out_of_sync candidates
found out 0 valid registered applications that config has been changed in repository "first-piped"
found out 0 valid unregistered applications in repository "first-piped"
```
起動後、Pipedがonlineになることが確認できた。

![](https://storage.googleapis.com/zenn-user-upload/0e0da4eac0e9-20241014.png)

## まとめ

今回、PipeCDのControl PlaneとPipedを実際に起動してみて、基本的な構成や設定方法を理解することができた。特に、Progressive Deliveryの概念や、メトリクスに基づいた自動ロールバック機能など、これまで手動で行っていた作業を自動化できる点が魅力的だと感じた。

今後は、実際にECSへのデプロイを試してみたり、他のプラットフォームでの利用も検討してみたい。

### References

https://developers.cyberagent.co.jp/blog/archives/30573/
https://dev.classmethod.jp/articles/getting-started-pipecd/
https://zenn.dev/cadp/articles/piped-on-ecs?redirected=1
https://dev.classmethod.jp/articles/terraform-deploy-pipeline-tool/
https://developers.cyberagent.co.jp/blog/archives/41612/