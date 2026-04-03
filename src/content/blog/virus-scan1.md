---
title: "【clamAV】 S3にアップロードされるファイルへウィルススキャンをかけたい①"
date: 2023-07-03T07:35:32+09:00
authorEmoji: 🐙
tags:
- サーバーレス
- sls
- SAM
- clamscan
categories:
- サーバーレス
image: images/feature2/clamav.png
---

S3にアップロードされるファイルのウィルススキャンができる機能を実装中です。

clamavというライブラリを見つけました。clamavをAWSのlambdaで実行する時に、色々環境を構築していたのですが、サーバーレスに対する理解が深まったので、ログとして残しておくための記事になります。



## **サーバーレスとは**

サーバーレスとは、従来のサーバー管理の手間を省き、開発者がアプリケーションのコードに集中できるようにするコンピューティングのパラダイムです。開発者は、サーバーのプロビジョニング、スケーリング、メンテナンスを気にすることなく、アプリケーションのビジネスロジックに専念できます。サーバーレスアーキテクチャは、AWS Lambdaのようなイベント駆動のコンピューティングサービスを利用することで、リソースの使用量に基づく料金設定を可能にします。これにより、アプリケーションが非アクティブな場合でもサーバーを稼働させておくためのコストが発生しなくなります。

Ruby on Railsのようなサーバーサイド言語を使用する場合、AWSでアプリケーションを実行するためには、通常、EC2やECS Fargateといったサーバーを立てて実行環境を構築する必要があります。しかし、サーバーレスのアーキテクチャでは、これらのプロセスが抽象化され、開発者はコードの実行に集中できます。

## **AWSにおけるサーバーレス**

AWSでは、サーバーレスアーキテクチャの構築とデプロイを容易にするためのいくつかのツールを提供しています。その中でも代表的なのが、SAM（Serverless Application Model）とSLS（Serverless Framework）です。

### **SAM**

SAMは、サーバーレスアプリケーションの構築を支援するオープンソースのフレームワークです。関数、API、データベース、イベントソースマッピングなどを表現するための省略構文を提供し、リソースごとに数行でアプリケーシションを定義し、モデル化することができます【66†source】。

### **SLS**

Serverless Framework（SLS）は、AWS Lambda関数とそれらが必要とするAWSインフラストラクチャリソースの開発とデプロイを支援するCLIツールです。このフレームワークは、構造、自動化、ベストプラクティスを提供し、開発者が複雑なイベント駆動のサーバーレスアーキテクチャの構築に集中できるようにします【70†source】。

サーバーレス環境で動くlambda functionのデプロイを手軽にするためのサービスです。

serverless.yamlに数行記述して、sls deployするだけでcloudformationが動いて、lambda functionとlambdaの実行に必要な環境がセットアップされます。スッゲェですね。

https://www.serverless.com/framework/docs/providers/aws/guide/deploying

サーバーレスアーキテクチャの採用により、開発者はアプリケーションのビジネスロジックに集中し、インフラストラクチャの管理から解放されます。これは、開発者の生産性を向上させ、アプリケーションのスケーリングとメンテナンスを自動化し、コストを効率化するのに役立ちます。

今回作成しようとしているclamda-layer内のserverless.yml は下記のように定義されています。

```docker
$ cat serverless.yml 
service: clambda-av

provider:
  name: aws
  region: ap-northeast-1
  runtime: nodejs14.x
  iamRoleStatements:
    - Effect: Allow
      Action:
        - s3:GetObject
        - s3:PutObjectTagging
      Resource: "arn:aws:s3:::clambda-av-files/*"

functions:
  virusScan:
    handler: handler.virusScan
    memorySize: 2048
    events:
      - s3: 
          bucket: clambda-av-files
          event: s3:ObjectCreated:*
    layers:
      - {Ref: ClamavLambdaLayer}
    timeout: 120

package:
  exclude:
    - node_modules/**
    - coverage/**

layers:
  clamav:
    path: layer
```

sls deployを実行すると、—aws-profileの引数に指定したIAMユーザーでcloudformationが動かされます。

ここでは、S3への実行ロールやlambda functionが作成されています。

lambda functionは、同一ディレクトリにあるhandler.js内の、virusScanというhandlerが指定されています。

ちなみに、中身はこうなっています。処理は追って説明します。

```jsx
$ cat handler.js
const { execSync } = require("child_process");
const { writeFileSync, unlinkSync } = require("fs");
const AWS = require("aws-sdk");

const s3 = new AWS.S3();

module.exports.virusScan = async (event, context) => {
  if (!event.Records) {
    console.log("Not an S3 event invocation!");
    return;
  }

  for (const record of event.Records) {
    if (!record.s3) {
      console.log("Not an S3 Record!");
      continue;
    }

    // get the file
    const s3Object = await s3
      .getObject({
        Bucket: record.s3.bucket.name,
        Key: record.s3.object.key,
      })
      .promise();

    // write file to disk
    writeFileSync(`/tmp/${record.s3.object.key}`, s3Object.Body);

    try {
      // scan it
      const scanStatus = execSync(
        `clamscan --database=/opt/var/lib/clamav /tmp/${record.s3.object.key}`
      );

      await s3
        .putObjectTagging({
          Bucket: record.s3.bucket.name,
          Key: record.s3.object.key,
          Tagging: {
            TagSet: [
              {
                Key: "av-status",
                Value: "clean",
              },
            ],
          },
        })
        .promise();
    } catch (err) {
      if (err.status === 1) {
        // tag as dirty, OR you can delete it
        await s3
          .putObjectTagging({
            Bucket: record.s3.bucket.name,
            Key: record.s3.object.key,
            Tagging: {
              TagSet: [
                {
                  Key: "av-status",
                  Value: "dirty",
                },
              ],
            },
          })
          .promise();
      }
    }

    // delete the temp file
    unlinkSync(`/tmp/${record.s3.object.key}`);
  }
};
```

### Serverless Framework（SLS）によるLambda Functionの簡単デプロイ

Serverless Framework（SLS）を使うと、簡単な**`serverless.yaml`**の記述と**`sls deploy`**の実行だけで、AWS CloudFormationが動き、Lambda functionとLambdaの実行に必要な環境がセットアップされます。これは非常に便利な機能です。

例えば、下記のように**`serverless.yml`**を定義します。

```jsx
$ cat serverless.yml 
service: clambda-av

provider:
  name: aws
  region: ap-northeast-1
  runtime: nodejs14.x
  iamRoleStatements:
    - Effect: Allow
      Action:
        - s3:GetObject
        - s3:PutObjectTagging
      Resource: "arn:aws:s3:::clambda-av-files/*"

functions:
  virusScan:
    handler: handler.virusScan
    memorySize: 2048
    events:
      - s3: 
          bucket: clambda-av-files
          event: s3:ObjectCreated:*
    layers:
      - {Ref: ClamavLambdaLayer}
    timeout: 120

package:
  exclude:
    - node_modules/**
    - coverage/**

layers:
  clamav:
    path: layer
```

この**`sls deploy`**コマンドを実行すると、**`—aws-profile`**の引数に指定したIAMユーザーでAWS CloudFormationが動きます。このプロセスにより、S3への実行ロールやLambda functionが作成されます。

Lambda functionでは、同一ディレクトリにある**`handler.js`**内の、**`virusScan`**というhandlerが指定されています。

```jsx
$ cat handler.js
const { execSync } = require("child_process");
const { writeFileSync, unlinkSync } = require("fs");
const AWS = require("aws-sdk");

const s3 = new AWS.S3();

module.exports.virusScan = async (event, context) => {
  //...
};
```

CLIから実行するにはIAMが必要なので、下記のインストラクションで作成しておくと良いかもですね。

https://www.serverless.com/framework/docs/providers/aws/guide/credentials

https://octomblog.com/posts/virus-scan2/ に続く...