---
title: "【clamAV】 S3にアップロードされるファイルへウィルススキャンをかけたい②"
date: 2023-07-03T08:01:40+09:00
authorEmoji: 🐙
tags:
- サーバーレス
- sls
- SAM
- clamscan
categories:
- サーバーレス
series:
  - S3ウイルススキャン実装
image: images/feature2/clamav.png
---

S3にアップロードされるファイルのウィルススキャンができる機能を実装中です。
https://octomblog.com/posts/virus-scan1/
の続きです。

下記ライブラリを使用して、引き続きウィルススキャン用のサーバーレス環境を作成していきましょう。
https://github.com/sutt0n/serverless-clamav-lambda-layer

### clamavコンテナの構築

https://dev.to/sutt0n/scanning-files-on-lambda-with-a-clamav-lambda-layer-475c でclamavのラムダ用レイヤーを作成していきます。

まず、IAMユーザーを作成して、~/.aws/credentialsに保存しておきましょう。

今回はdevという名前のIAMユーザーを作成しました。これでCLIからAWSのサービスへアクセスすることができます。

```jsx
[dev]
aws_access_key_id = *******************
aws_secret_access_key = **********************
```

https://www.serverless.com/framework/docs/providers/aws/guide/credentials

必要に応じて、build.shに書いてあるdockerコマンドの前にsudoを付け足します。

## clamav内のファイル

少し興味があるので、./build.shを叩いた時に走るコマンドを一つ一つ見ていきます。

### build.sh

```bash

// build.sh

#!/bin/bash

rm -rf ./layer
mkdir layer

docker build --platform=linux/x86_64 -t clamav -f Dockerfile .
docker run --name clamav clamav
docker cp clamav:/home/build/clamav_lambda_layer.zip .
docker rm clamav
mv clamav_lambda_layer.zip ./layer

pushd layer
unzip -n clamav_lambda_layer.zip
rm clamav_lambda_layer.zip
popd
```

### #!/bin/bashって何？

> **she-bang**‘(**shabang**). This derives from the concatenation of the tokens *sharp* (#) and *bang* (!)
> 

どのshellを使うのかを明示的に指定するシンボリックリンクだそう

。シェルスクリプトのようなUnix-likeなOperating Systemsでは、she-bangはコマンドとして認識されるそうです。

なので、最初に#がついていても、「これからbin/bashで実行すれば良いんだな」、とシステムが解釈する見たい。

https://medium.com/@codingmaths/bin-bash-what-exactly-is-this-95fc8db817bf

### dockerコマンド

```bash
docker build --platform=linux/x86_64 -t clamav -f Dockerfile  // 1 .
docker run --name clamav clamav // 2
docker cp clamav:/home/build/clamav_lambda_layer.zip . // 3
docker rm clamav // 4
```

1. `docker build --platform=linux/x86_64 -t clamav -f Dockerfile`
    
    Dockerイメージをビルドしています。`--platform=linux/x86_64で`イメージをLinuxのx86_64（64ビット）を指定してビルドしています。`-t clamavで`イメージの名前を`clamav`にしています。`-f Dockerfile`はビルド時にカレントディレクトリの`Dockerfile`が使っています。
    
2. `docker run --name clamav clamav`
    
    このコマンドはDockerイメージを実行して、新たなコンテナを作成します。`--name clamav`は作成されるコンテナの名前を指定します。この例ではコンテナの名前が`clamav`となります。最後の`clamav`は実行するイメージの名前を指定します。この例では名前`clamav`のイメージが実行されます。
    
3. `docker cp clamav:/home/build/clamav_lambda_layer.zip .`
    
    このコマンドはDockerコンテナからファイルやディレクトリをホストのシステムにコピーします。`clamav:/home/build/clamav_lambda_layer.zip`はコピー元を指定します。この例では`clamav`という名前のコンテナの`/home/build/clamav_lambda_layer.zip`というパスのファイルを指定しています。`.`はコピー先を指定します。この例ではカレントディレクトリにファイルがコピーされます。
    
4. `docker rm clamav`
    
    このコマンドはDockerコンテナを削除します。`clamav`は削除するコンテナの名前を指定します。この例では`clamav`という名前のコンテナが削除されます。
    

```docker
# Dockerfile

FROM amazonlinux:2

WORKDIR /home/build

RUN set -e

RUN echo "Prepping ClamAV"

RUN rm -rf bin
RUN rm -rf lib

RUN yum update -y
RUN amazon-linux-extras install epel -y
RUN yum install -y cpio yum-utils tar.x86_64 gzip zip

RUN yumdownloader -x \*i686 --archlist=x86_64 clamav
RUN rpm2cpio clamav-0*.rpm | cpio -vimd

RUN yumdownloader -x \*i686 --archlist=x86_64 clamav-lib
RUN rpm2cpio clamav-lib*.rpm | cpio -vimd

RUN yumdownloader -x \*i686 --archlist=x86_64 clamav-update
RUN rpm2cpio clamav-update*.rpm | cpio -vimd

RUN yumdownloader -x \*i686 --archlist=x86_64 json-c
RUN rpm2cpio json-c*.rpm | cpio -vimd

RUN yumdownloader -x \*i686 --archlist=x86_64 pcre2
RUN rpm2cpio pcre*.rpm | cpio -vimd

RUN yumdownloader -x \*i686 --archlist=x86_64 libtool-ltdl
RUN rpm2cpio libtool-ltdl*.rpm | cpio -vimd

RUN yumdownloader -x \*i686 --archlist=x86_64 libxml2
RUN rpm2cpio libxml2*.rpm | cpio -vimd

RUN yumdownloader -x \*i686 --archlist=x86_64 bzip2-libs
RUN rpm2cpio bzip2-libs*.rpm | cpio -vimd

RUN yumdownloader -x \*i686 --archlist=x86_64 xz-libs
RUN rpm2cpio xz-libs*.rpm | cpio -vimd

RUN yumdownloader -x \*i686 --archlist=x86_64 libprelude
RUN rpm2cpio libprelude*.rpm | cpio -vimd

RUN yumdownloader -x \*i686 --archlist=x86_64 gnutls
RUN rpm2cpio gnutls*.rpm | cpio -vimd

RUN yumdownloader -x \*i686 --archlist=x86_64 nettle
RUN rpm2cpio nettle*.rpm | cpio -vimd

RUN mkdir -p bin
RUN mkdir -p lib
RUN mkdir -p var/lib/clamav
RUN chmod -R 777 var/lib/clamav

COPY ./freshclam.conf .

RUN cp usr/bin/clamscan usr/bin/freshclam bin/.
RUN cp usr/lib64/* lib/.
RUN cp freshclam.conf bin/freshclam.conf

RUN yum install shadow-utils.x86_64 -y

RUN groupadd clamav
RUN useradd -g clamav -s /bin/false -c "Clam Antivirus" clamav
RUN useradd -g clamav -s /bin/false -c "Clam Antivirus" clamupdate

RUN mkdir -p opt/var/lib/clamav
RUN chmod -R 777 opt/var/lib/clamav

RUN LD_LIBRARY_PATH=./lib ./bin/freshclam --config-file=bin/freshclam.conf

RUN tclamav_lambda_layer.zip bin
RUN zip -r9 clamav_lambda_layer.zip lib
RUN zip -r9 clamav_lambda_layer.zip var
RUN zip -r9 clamav_lambda_layer.zip etc
```

Dockerfile内でコンテナに積んでいるパッケージ

1. `clamav`: ClamAVは、ウイルススキャナーであり、特に電子メールサーバーにおけるメールゲートウェイスキャンに使用されます。多くの形式のマルウェアに対応しており、Phishing関連の脅威、ウイルス、トロイの木馬などを検出できます。
2. `clamav-lib`: ClamAVのライブラリです。これはClamAVを使用する他のプログラムが依存するライブラリであり、ClamAVの機能を提供します。
3. `clamav-update`: ClamAVのウイルスデータベースを更新するためのパッケージです。これにより、ClamAVは最新のマルウェアに対する保護を維持できます。
4. `json-c`: JSON-Cは、JSONデータの解析と生成を可能にするCライブラリです。
5. `pcre2`: PCRE（Perl Compatible Regular Expressions）は、Perlの正規表現と互換性のある正規表現ライブラリです。PCRE2はその後続版で、より多くの機能と改善されたパフォーマンスを提供します。
6. `libtool-ltdl`: libtool-ltdlは、プログラムがプラグインをロードするために使用するライブラリで、動的ロードの抽象化を提供します。
7. `libxml2`: libxml2は、XMLとHTMLドキュメントを解析、変換、保存するためのライブラリです。
8. `bzip2-libs`: bzip2-libsは、bzip2圧縮アルゴリズムを使用するための共有ライブラリです。
9. `xz-libs`: xz-libsは、LZMA圧縮アルゴリズムを使用するための共有ライブラリです。
10. `libprelude`: libpreludeは、プレリュードIDS（侵入検知システム）によって使用されるフレームワークで、複数のIDS製品が結果を一元的に収集、共有、相関することを可能にします。
11. `gnutls`: GnuTLSは、SSL, TLS, DTLSプロトコルを実装するためのセキュア通信ライブラリです。
12. `nettle`: Nettleは、低レベルの暗号ライブラリで、ハッシュ関数、暗号、公開鍵暗号、その他の暗号操作を提供します。

また、`yum-utils`、`cpio`、`tar.x86_64`、`

gzip`、`zip`、`shadow-utils.x86_64`といったパッケージもインストールされています。これらは、パッケージ管理、ファイルの圧縮・解凍、ユーザーとグループの管理など、一般的なシステム管理作業を支援するツールを提供します。

なお、このDockerfileでは、各パッケージがインストールされるのではなく、`yumdownloader`コマンドでダウンロードされ、その後`rpm2cpio`と`cpio`コマンドで解凍されています。これは、パッケージの中にある特定のファイルだけを抽出し、それを新しいDockerイメージの中に含めるためのものです。

最終的に、これらのファイルは`clamav_lambda_layer.zip`という名前のzipファイルにパッケージ化されます。これは、AWS Lambdaで使用するためのレイヤとして使用される可能性があります。レイヤは、Lambda関数のデプロイメントパッケージからライブラリや他の依存関係を分離するための分散パッケージです。

### zip -r9 hoge.zip dir/

- **`r`** : これは "recursive" の略で、指定したディレクトリとそのすべてのサブディレクトリとファイルを圧縮する。
- **`9`** : これは圧縮レベルを指定している。0から9までの値を指定できる。9は最高の圧縮レベルを意味していて、出力されるzipファイルのサイズを最小限にするために、最も高度な圧縮アルゴリズムを使用しているということになる。

たとえば、`zip -r9 clamav_lambda_layer.zip lib` というコマンドは、`lib` ディレクトリとその中のすべてのサブディレクトリとファイルを、最高レベルで圧縮した `clamav_lambda_layer.zip` という名前のzipファイルを作成する。

```jsx
$ cd serverless-clamav-lambda-layer/
(.venv) SubarunoMacBook-puro-3:serverless-clamav-lambda-layer subaru$ ls
Dockerfile         README.md          freshclam.conf     handler.test.js    package.json
LICENSE            build.sh*          handler.js         package-lock.json  serverless.yml
(.venv) SubarunoMacBook-puro-3:serverless-clamav-lambda-layer subaru$ .venv
-bash: .venv: command not found
(.venv) SubarunoMacBook-puro-3:serverless-clamav-lambda-layer subaru$ npm install
⸨###############⠂⠂⠂⸩ ⠇ reify:buffer-alloc: http fetch GET 200 https://registry.npmjs.org/buffer-a

$ bash ./build.sh
[+] Building 7.0s (5/57)                                                                                                                                                             
 => [internal] load build definition from Dockerfile                                                                                                                            0.2s
 => => transferring dockerfile: 2.16kB                                                                                                                                          0.1s
 => [internal] load .dockerignore                                                                                                                                               0.1s
 => => transferring context: 2B                                                                                                                                                 0.0s
 => [internal] load metadata for docker.io/library/amazonlinux:2                                                                                                                6.3s
 => [auth] library/amazonlinux:pull token for registry-1.docker.io
```

 実行後のディレクトリ

```docker
$ ls -a
./                 .git/              .npmcheckrc        LICENSE            build.sh*          handler.js         layer/             package-lock.json  serverless.yml
../                .gitignore         Dockerfile         README.md          freshclam.conf     handler.test.js    node_modules/      package.json
(.venv) SubarunoMacBook-puro-3:serverless-clamav-lambda-layer subaru$ ls layer/
bin/ etc/ lib/ var/
```

slsを実行するためのパッケージがないので、グローバルインストールしておきます。

```docker
$ npm install -g serverless
```

s3バケットは全世界で一意な名前にしないといけないので、初期値だとエラーが発生します。

```jsx
Deploying clambda-av to stage dev (ap-northeast-1)

✖ Stack clambda-av-dev failed to deploy (108s)
Environment: darwin, node 16.13.0, framework 3.25.0 (local), plugin 6.2.2, SDK 4.3.2
Credentials: Local, "dev" profile
Docs:        docs.serverless.com
Support:     forum.serverless.com
Bugs:        github.com/serverless/serverless/issues

Error:
CREATE_FAILED: S3BucketClambdaavfiles (AWS::S3::Bucket)
clambda-av-files already exists

View the full error: https://ap-northeast-1.console.aws.amazon.com/cloudformation/home?region=ap-northeast-1#/stack/detail?stackId=arn%3Aaws%3Acloudformation%3Aap-northeast-1%3A061293269148%3Astack%2Fclambda-av-dev%2Fe373dfa0-17b7-11ee-b2bc-063a6e7d620f
```

作成に成功した場合

```jsx
$ sls deploy  --aws-profile dev

Deploying clambda-av to stage dev (ap-northeast-1)

✔ Service deployed to stack clambda-av-dev (105s)

functions:
  virusScan: clambda-av-dev-virusScan (218 kB)
layers:
  clamav: arn:aws:lambda:ap-northeast-1:061293269148:layer:clamav:2

2 deprecations found: run 'serverless doctor' for more details

Need a faster logging experience than CloudWatch? Try our Dev Mode in Console: run "serverless dev"
```

### 実際にS3にファイルを保存してみる

作成されたS3を見てみましょう。
![](https://storage.googleapis.com/zenn-user-upload/e19ca7a9685a-20230703.png)

```
$ aws s3 cp ./virus.txt s3://clambda-av-files-test1
$ aws s3api get-object-tagging --bucket clambda-av-files-test1  --key virus.txt
```

### 紐づいているlambda
デプロイされたlambdaを見てみます。

![](https://storage.googleapis.com/zenn-user-upload/9a899b54f58d-20230703.png)

S3のcreateObjectイベントが発火すると動くlambdaが出来上がっていますね。

### cloudwatch logs

S3にファイルを入れた後のログを見てみます

![](https://storage.googleapis.com/zenn-user-upload/7dbea92ea691-20230703.png)

`/opt/var/lib/clamav`なんてディレクトリはないよというエラーが出ています。

![](https://storage.googleapis.com/zenn-user-upload/1a83ef76ea2f-20230703.png)

handler.jsのvirusScan関数の中にある、下記記述でエラーが発生しています。

```jsx
     const scanStatus = execSync(
        `clamscan --database=/opt/var/lib/clamav /tmp/${record.s3.object.key}`
      );
```

### execSync

node:child_processモジュールの中にある一つのメソッドです。

https://nodejs.org/api/child_process.html#child-process

下記のように呼び出して、Linuxコマンドをjsファイル内で使用できます。

### LinuxとUnix

Unixという使い勝手のいいパッケージが昔はあったが、使いづらくね？というイメージを持ったフィンランドの大学生が開発したのがLinuxだそうです。

現在、Unixを使用するのはお金がかかるが、Linuxは無料ですね。MacOSモLinuxを採用しています。コマンドで打っているlsとかpwdとかの、あれです。

https://eng-entrance.com/unix_linux

関数ないで、コマンドを実行できる関数だそうです。同じような関数は他にもあります。

### clamscanコンテナの中身を確認

そこで、さっきdocker buildで作成したclamavのコンテナの中身を見てみます。

clamavのコンテナを使って自作コンテナを作った場合のディレクトリ校正

```jsx
$ docker run --name clamav -it clamav /bin/bash
bash-4.2# ls
bin					      clamav_lambda_layer.zip		    lib						  opt
bzip2-libs-1.0.6-13.amzn2.0.3.x86_64.rpm      etc				    libprelude-5.2.0-2.el7.x86_64.rpm		  pcre2-10.23-11.amzn2.0.1.x86_64.rpm
clamav-0.103.8-1.amzn2.0.2.x86_64.rpm	      freshclam.conf			    libtool-ltdl-2.4.2-22.2.amzn2.0.2.x86_64.rpm  usr
clamav-lib-0.103.8-1.amzn2.0.2.x86_64.rpm     gnutls-3.3.29-9.amzn2.0.1.x86_64.rpm  libxml2-2.9.1-6.amzn2.5.8.x86_64.rpm	  var
clamav-update-0.103.8-1.amzn2.0.2.x86_64.rpm  json-c-0.11-4.amzn2.0.4.x86_64.rpm    nettle-2.7.1-9.amzn2.x86_64.rpm		  xz-libs-5.2.2-1.amzn2.0.3.x86_64.rpmv

```

なんだ、存在してるっぽいな、、

```jsx
bash-4.2# cd opt/var/lib/clamav/
bytecode.cvd   daily.cvd      freshclam.dat  main.cvd       
bash-4.2# cd opt/var/lib/clamav/
bytecode.cvd   daily.cvd      freshclam.dat  main.cvd       
bash-4.2# cd opt/var/lib/clamav/
bash-4.2# pwd
/home/build/opt/var/lib/clamav
```

cvd拡張子ってなんなんだろう

### .cvd .dat

.cvdは、Bitdefender antivirus and Internet security softwareが使っている、ウィルスの定義が書かれたファイルを保存するための拡張ファイルだそう。

https://fileinfo.com/extension/cvd

.datは、バイナリーtextファイルと他のプログラムが書かれた拡張ファイルだそう。

[https://www.indeed.com/career-advice/career-development/dat-file#:~:text=What is a DAT file,often automatically create these files](https://www.indeed.com/career-advice/career-development/dat-file#:~:text=What%20is%20a%20DAT%20file,often%20automatically%20create%20these%20files).

## ローカル環境

### clamavを実行してみる

eicarが提供するウィルスに感染したファイルをclamscanに渡してみます。すると、サポートされていないdatabase ファイルだというエラーが出ます。

```jsx
$  curl https://secure.eicar.org/eicar.com.txt | clamscan -
LibClamAV Error: cli_loaddbdir: No supported database files found in /usr/local/var/lib/clamav
ERROR: Can't open file or directory

----------- SCAN SUMMARY -----------
Known viruses: 0
Engine version: 1.1.0
Scanned directories: 0
Scanned files: 0
Infected files: 0
Data scanned: 0.00 MB
Data read: 0.00 MB (ratio 0.00:1)
Time: 0.025 sec (0 m 0 s)
Start Date: 2023:07:02 10:39:11
End Date:   2023:07:02 10:39:11
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100    68  100    68    0     0     40      0  0:00:01  0:00:01 --:--:--    40
curl: (23) Failed writing body
```

どうやらfreshclamコマンドを実行して、clamavが読み込むdatabaseを更新する必要があるようです。

https://wiki.archlinux.org/title/ClamAV#Installation

ただ、freshclam.confを適したディレクトリに移動させないと`freshclam` コマンドは実行できないようです。

### freshclam.conf.sampleを探せ

freshclam.confを適切なディレクトリに置かないと、freshclamを実行したときに「ファイルが存在しません」というエラーが出てしまう。

```jsx
$ freshclam
ERROR: Can't open/parse the config file /usr/local/etc/clamav/freshclam.conf
```

`freshclam.conf.sample`は、clamscanパッケージをhomebrewを使ってインストールした時に、一緒にダウンロードされています。

私の場合、`/usr/local/etc/clamav/` に合ったので、下記コマンドで適切なかしょに移動させます。

```jsx
$ cp /usr/local/etc/clamav/freshclam.conf.sample /usr/local/etc/clamav/freshclam.conf
```

さらに、freshclam.conf内の記述を修正します。vimでfreshclam.confを開いて、Exampleという部分をコメントアウトしましょう。

これを、

```jsx
# Comment or remove the line below.
Example
```

こう

```jsx
# Comment or remove the line below.
#Example
```

https://www.eukhost.com/forums/forum/technical-support/tutorials-how-tos/15706-clamd-update-error-please-edit-the-example-config-file

### freshclamを再度実行

```jsx

SubarunoMacBook-puro-3:/ subaru$ freshclam
ClamAV update process started at Sun Jul  2 10:42:21 2023
daily database available for download (remote version: 26956)
ERROR: NULL X509 store
Time:   33.1s, ETA:    0.0s [========================>]   58.73MiB/58.73MiB
WARNING:  ******* RESULT 200, SIZE: 61579733 ******* 
Testing database: '/usr/local/var/lib/clamav/tmp.a5ad13a6dd/clamav-2d384fd99ebd7b280d6d77311b426b7a.tmp-daily.cvd' ...
Database test passed.
daily.cvd updated (version: 26956, sigs: 2038014, f-level: 90, builder: raynman)
main database available for download (remote version: 62)
ERROR: NULL X509 store
Time:  1m 06s, ETA:    0.0s [========================>]  162.58MiB/162.58MiB
WARNING:  ******* RESULT 200, SIZE: 170479789 ******* 
Testing database: '/usr/local/var/lib/clamav/tmp.a5ad13a6dd/clamav-96a1ce8ec33e6a66420cf68eb0b3a638.tmp-main.cvd' ...
Database test passed.
main.cvd updated (version: 62, sigs: 6647427, f-level: 90, builder: sigmgr)
bytecode database available for download (remote version: 334)
ERROR: NULL X509 store
Time:    0.2s, ETA:    0.0s [========================>]  285.12KiB/285.12KiB
WARNING:  ******* RESULT 200, SIZE: 291965 ******* 
Testing database: '/usr/local/var/lib/clamav/tmp.a5ad13a6dd/clamav-02300344bb5af1363a6247c0ba226a2d.tmp-bytecode.cvd' ...
Database test passed.
bytecode.cvd updated (version: 334, sigs: 91, f-level: 90, builder: anvilleg)
```

### clamscanを再度実行

curlでeicarのウィルススキャンを取得し、clamscanに渡してみます。

ちゃんとInfected filesが1と表示されました。

```jsx
$ curl https://secure.eicar.org/eicar.com.txt | clamscan -
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100    68  100    68    0     0     77      0 --:--:-- --:--:-- --:--:--    77Loading:     1s, ETA:  15s [=>                       ]  540.00K/8.69M sigs       
Loading:    21s, ETA:   0s [========================>]    8.67M/8.67M sigs    
Compiling:   5s, ETA:   0s [========================>]       41/41 tasks 

stdin: Win.Test.EICAR_HDB-1 FOUND

----------- SCAN SUMMARY -----------
Known viruses: 8669911
Engine version: 1.1.0
Scanned directories: 0
Scanned files: 1
Infected files: 1
Data scanned: 0.00 MB
Data read: 0.00 MB (ratio 0.00:1)
Time: 27.327 sec (0 m 27 s)
Start Date: 2023:07:02 10:50:05
End Date:   2023:07:02 10:50:33
```

ちなみに、感染していないファイルを渡すと下記のような結果になります。

```jsx
$ clamscan 節電電球のアイコン素材.png
Loading:    19s, ETA:   0s [========================>]    8.67M/8.67M sigs       
Compiling:   4s, ETA:   0s [========================>]       41/41 tasks 

/Users/subaru/Downloads/節電電球のアイコン素材.png: OK

----------- SCAN SUMMARY -----------
Known viruses: 8669911
Engine version: 1.1.0
Scanned directories: 0
Scanned files: 1
Infected files: 0
Data scanned: 0.01 MB
Data read: 0.01 MB (ratio 1.00:1)
Time: 25.055 sec (0 m 25 s)
Start Date: 2023:07:02 11:07:33
End Date:   2023:07:02 11:07:58
```

## コンテナ環境

### ローカルでやったことをコンテナ環境でできるようにする

ローカル環境では、下記の手順を踏んでclamscanでinfected fileをfileを検知することができました。

1. clamscanパッケージをインストール
2. freshman.confを移動
    1. /usr/local/etc/clamav/freshclam.conf.sampleを/usr/local/etc/clamav/freshclam.confにコピー
    2. Exampleをコメントアウト
3. freshclamコマンドを実行

この手順をコンテナ環境でも実行できればいいということがわかりました。

そこで、コンテナ環境では現状どの手順まで進んでいるのかをおさらいします。

そのために、Dockerfileとコンテナの中身をみます。

### clamav-docker

dockerコンテナ内でclamavを実行できるようにするための設定が書いてあります。

コンテナに入って直接clamavをインストールしちゃう作成んでいきます。

yum install -y clamavを実行します。

実行後、./bin/freshclamを実行してdatabaseを更新します。

clamscanが使えるようになったか、下記コマンドを実行しておきましょう。

使えるようになったので、コンテナ内で、必要なディレクトリをzipファイルにしちゃいます。

```jsx
bash-4.2# zip -r9 layer_final.zip bin
  adding: bin/ (stored 0%)
  adding: bin/freshclam.conf (deflated 21%)
  adding: bin/clamscan (deflated 68%)
  adding: bin/freshclam (deflated 56%)
bash-4.2# zip -r9 layer_final.zip var
  adding: var/ (stored 0%)
  adding: var/spool/ (stored 0%)
  adding: var/spool/quarantine/ (stored 0%)
  adding: var/lib/ (stored 0%)
  adding: var/lib/clamav/ (stored 0%)
bash-4.2# zip -r9 layer_final.zip etc
  adding: etc/ (stored 0%)
  adding: etc/cron.d/ (stored 0%)
  adding: etc/cron.d/clamav-update (deflated 25%)
  adding: etc/logrotate.d/ (stored 0%)
  adding: etc/logrotate.d/clamav-update (deflated 41%)
  adding: etc/sysconfig/ (stored 0%)
  adding: etc/sysconfig/freshclam (deflated 49%)
  adding: etc/freshclam.conf (deflated 60%)
bash-4.2# zip -r9 layer_final.zip lib
  adding: lib/ (stored 0%)
  adding: lib/libpreludecpp.so.12 (deflated 67%)
  adding: lib/libpcre2-posix.so.1 (deflated 64%)
  adding: lib/libhogweed.so.2 (deflated 36%)
  adding: lib/libprelude.so.28.1.0 (deflated 84%)
  adding: lib/libnettle.so.4.7 (deflated 46%)
  adding: lib/libfreshclam.so.2 (deflated 65%)
  adding: lib/liblzma.so.5 (deflated 46%)
  adding: lib/libclamav.so.9.0.5 (deflated 59%)
  adding: lib/libfreshclam.so.2.0.1 (deflated 65%)
  adding: lib/libtasn1.so.6.5.3 (deflated 51%)
  adding: lib/libbz2.so.1 (deflated 54%)
  adding: lib/libtasn1.so.6 (deflated 51%)
  adding: lib/libpcre2-8.so.0 (deflated 61%)
  adding: lib/libclammspack.so.0.1.0 (deflated 45%)
  adding: lib/libltdl.so.7.3.0 (deflated 54%)
  adding: lib/libclammspack.so.0 (deflated 45%)
  adding: lib/libnettle.so.4 (deflated 46%)
  adding: lib/liblzma.so.5.2.2 (deflated 46%)
  adding: lib/libprelude.so.28 (deflated 84%)
  adding: lib/libbz2.so.1.0.6 (deflated 54%)
  adding: lib/libpcre2-posix.so.1.0.1 (deflated 64%)
  adding: lib/libjson-c.so.2 (deflated 56%)
  adding: lib/libpreludecpp.so.12.0.1 (deflated 67%)
  adding: lib/libpcre2-8.so.0.5.0 (deflated 61%)
  adding: lib/libxml2.so.2 (deflated 54%)
  adding: lib/libjson.so.0 (deflated 70%)
  adding: lib/libgnutls.so.28.43.3 (deflated 55%)
  adding: lib/libclamav.so.9 (deflated 59%)
  adding: lib/libltdl.so.7 (deflated 54%)
  adding: lib/libhogweed.so.2.5 (deflated 36%)
  adding: lib/libjson.so.0.1.0 (deflated 70%)
  adding: lib/libxml2.so.2.9.1 (deflated 54%)
  adding: lib/libjson-c.so.2.0.1 (deflated 56%)
  adding: lib/libgnutls.so.28 (deflated 55%)
```

そして、作成したzipファイルをローカル環境から取得します。

まずは、docker psを使ってコンテナの名前を確認します。clamav_new2という名前になってますね。

```jsx
$ docker ps
CONTAINER ID   IMAGE     COMMAND       CREATED       STATUS       PORTS     NAMES
7faeafc8af1a   clamav    "/bin/bash"   2 hours ago   Up 2 hours             clamav_new2
```

docker cpを使ってコンテナ内で作成したzipファイルを手元にコピーします。

```jsx
$ docker cp clamav_new2:/home/build/layer_final.zip .
```

そして、build.shの中身も下記のように変更します。

/layerへlayer_final.zipをunzipするだけです。

```jsx
$ cat build.sh 
#!/bin/bash

rm -rf ./layer
mkdir layer

mv layer_final.zip ./layer

pushd layer
unzip -n layer_final.zip
rm layer_final.zip
popd
```

./buildを実行後、デプロイしてみましょう

CLIで確認してみましょう。成功していたら、タグがついているはずです。

適当なtxtファイルを用意しておきます。今回はvirus.txtを作成しました。

```jsx
$ aws s3 cp ./virus.txt s3://clambda-av-files-test1
$ aws s3api get-object-tagging --bucket clambda-av-files-test1  --key virus.txt
{
    "TagSet": []
}
```

タグがついていません。

cloud watch logsを見ると、また下記のようなエラーが出ていました。

```jsx
LibClamAV Error: cl_load(): No such file or directory: /var/lib/clamav
```

handler.jsを下記のように変更して、`sls deploy —aws-profile dev`を実行しましょう。

```jsx
// databaseを指定している部分を削除
execSync(`clamscan /tmp/${record.s3.object.key}`)
```

deployが完了したら、CLIから適当なファイルをアップロードしてみましょう。

ただ、何度もuploadコマンドを実行するのも面倒なので、shell scriptを作ります。

### test.sh

echoを使ってtest.shに書き込んでいきます。

#で始まる文言を渡したい場合、シングルクォーテーションで囲むようにしてください。

そうしないと、Bash シェルが **`!`** をヒストリー置換の開始と誤解してしまい、うまく値を渡すことができません。

```jsx
echo '#!/bin/bash' > test.sh
echo "aws s3 cp ./virus.txt s3://clambda-av-files-test1" >> test.sh
echo "aws s3api get-object-tagging --bucket clambda-av-files-test1  --key virus.txt" >> test.sh
```

上のコマンドで使ったように、echoの書き方には二通りあります。

`>` : 既存のファイルを上書き

`>>` : 既存の内容の後ろに新たな内容を追加

必要に応じて、test.shへのパーミッションを変更しておきます。

```jsx
chmod +x test.sh
```

### chmodのパーミッションとは

chmodは、ファイルへの実行権限を管理するコマンドです。

パーミッションの制御は下記3つに分けられます。

- 4:読み取り（read）→ r
- 2:書き込み（write）→ w
- 1:実行（execute）→x

この、権限名の前についている4や2といった数字は、実行の許可を表す3ビットの数字です。

下記のようなコマンドを見たことがある方も多いと思います。

これは、4 + 2 + 1、つまりtest.shに対して全ての権限を全員に渡しているということになります。

```jsx
chmod 777 test.sh
```

ここで、全員という言葉を使用したので補足しておきます。

パーミッションは下記3つのカテゴリに分けられています。:

- ユーザー（owner）
- グループ
- その他（other）

今回の`chmod +x test.sh` は、ユーザーに対してtest.shへの実行権限を渡すコマンドということになります。

### 2つのパーミッション設定方法

パーミッションの設定にはシンボリックモードと数値モードの2つの方法があります。

たとえば、**`test.sh`** というファイルに対して、所有グループにだけ全てのパーミッション（読み取り、書き込み、実行）を設定するには、次のようにします：

### シンボリックモードで設定する場合：

```bash
chmod g+rwx test.sh
```

このコマンドは、**`g`**（group）に対して **`r`**（read）、**`w`**（write）、**`x`**（execute）のパーミッションを追加（**`+`**）します。

### 数値モードで設定する場合：

```bash
chmod 070 test.sh
```

このコマンドは、所有者（owner）にはパーミッションを付与せず（**`0`**）、所有グループ（group）には全てのパーミッションを付与（**`7`** = **`4`** + **`2`** + **`1`**）、その他のユーザー（other）にはパーミッションを付与せず（**`0`**）に設定します。

ただし、すでに設定されている他のパーミッションを変更せずにグループだけのパーミッションを変更する場合、シンボリックモードの方が直感的で便利な場合が多いです。

### test.shを実行

脱線しましたが、test.shを実行して、タグがついているか確認してみます。

```jsx
$ ./test.sh 
upload: ./virus.txt to s3://clambda-av-files-test1/virus.txt      
{
    "TagSet": []
}
```

ついていないですね、、

ローカルの/var/lib/clamavを見てみると、下記のようになっていますが、

```jsx
$ ls /var/lib/clamav/
clamd.conf             clamd.conf.sample      freshclam.conf         freshclam.conf.sample
```

コンテナ内の/var/lib/clamavをみると下記のようになっています。

```jsx
bash-4.2# ls /var/lib/clamav/
bytecode.cvd  daily.cvd  freshclam.dat	main.cvd
bash-4.2# ls var/lib/clamav/

```

もう、コピーしちゃいます。

```jsx
bash-4.2# cp /var/lib/clamav/* var/lib/clamav/
```

そして、layer_final.zipを作成して、ローカルに落とし込んだ後、sls deployします。

```jsx
$ docker cp clamav_new2:/home/build/layer_final.zip .
$ ./build.sh 
~/dev_2023/serverless-clamav-lambda-layer/layer ~/dev_2023/serverless-clamav-lambda-layer
Archive:  layer_final.zip
   creating: bin/
  inflating: bin/freshclam.conf      
  inflating: bin/clamscan            
  inflating: bin/freshclam           
   creating: var/
   creating: var/spool/
   creating: var/spool/quarantine/
   creating: var/lib/
   creating: var/lib/clamav/
  inflating: var/lib/clamav/daily.cvd  
  inflating: var/lib/clamav/bytecode.cvd  
  inflating: var/lib/clamav/freshclam.dat  
  inflating: var/lib/clamav/main.cvd  
   creating: etc/
   creating: etc/cron.d/
  inflating: etc/cron.d/clamav-update  
   creating: etc/logrotate.d/
  inflating: etc/logrotate.d/clamav-update  
   creating: etc/sysconfig/
  inflating: etc/sysconfig/freshclam  
  inflating: etc/freshclam.conf      
   creating: lib/
  inflating: lib/libpreludecpp.so.12  
  inflating: lib/libpcre2-posix.so.1  
  inflating: lib/libhogweed.so.2     
  inflating: lib/libprelude.so.28.1.0  
  inflating: lib/libnettle.so.4.7    
  inflating: lib/libfreshclam.so.2   
  inflating: lib/liblzma.so.5        
  inflating: lib/libclamav.so.9.0.5  
  inflating: lib/libfreshclam.so.2.0.1  
  inflating: lib/libtasn1.so.6.5.3   
  inflating: lib/libbz2.so.1         
  inflating: lib/libtasn1.so.6       
  inflating: lib/libpcre2-8.so.0     
  inflating: lib/libclammspack.so.0.1.0  
  inflating: lib/libltdl.so.7.3.0    
  inflating: lib/libclammspack.so.0  
  inflating: lib/libnettle.so.4      
  inflating: lib/liblzma.so.5.2.2    
  inflating: lib/libprelude.so.28    
  inflating: lib/libbz2.so.1.0.6     
  inflating: lib/libpcre2-posix.so.1.0.1  
  inflating: lib/libjson-c.so.2      
  inflating: lib/libpreludecpp.so.12.0.1  
  inflating: lib/libpcre2-8.so.0.5.0  
  inflating: lib/libxml2.so.2        
  inflating: lib/libjson.so.0        
  inflating: lib/libgnutls.so.28.43.3  
  inflating: lib/libclamav.so.9      
  inflating: lib/libltdl.so.7        
  inflating: lib/libhogweed.so.2.5   
  inflating: lib/libjson.so.0.1.0    
  inflating: lib/libxml2.so.2.9.1    
  inflating: lib/libjson-c.so.2.0.1  
  inflating: lib/libgnutls.so.28     
~/dev_2023/serverless-clamav-lambda-layer

$ sls deploy --aws-profile dev
```