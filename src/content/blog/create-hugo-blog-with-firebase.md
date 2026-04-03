---
title: "[Hugo with Firebase] HugoとFirebaseでブログ構築"
description: "自分のブログを持とう。HugoをFirebaseにデプロイする"
date: 2023-06-06T22:40:49+09:00
author: subaru
authorEmoji: 🐙
tags:
- blog作成
- hugo
categories:
- hugo
image: images/feature2/hugo.png
---

## Hugoで作ったblogをFirebaseにデプロイする
完成したサイトはこちら

(https://octomblog.com/)

### hugoをインストール
> Hugo is a fast and modern static site generator written in Go, and designed to make website creation fun again.

Goで書かれた高速でモダンなSSGであるHugoをインストールします。
[このサイト](https://gohugo.io/installation/)へvisitしてご使用されているOSにあった方法でインストールしてください。
私はmac OSなので、homebrewを使ってインストールしました。

```bash
brew install hugo
```


### Projectを作成
[公式ページ](https://gohugo.io/getting-started/quick-start/)を参考にして作成していきます。

すでにgithubにprojectを作成済みであることを前提に進めていきます。
```bash
$ hugo new site quickstart
$ cd quickstart
$ git init
$ git submodule add https://github.com/theNewDynamic/gohugo-theme-ananke themes/ananke
$ echo "theme = 'ananke'" >> hugo.toml
$ hugo server
```
すると、下記のような画面が立ち上がります。良いですね、ブログっぽいです。
新しいブログを書いてみましょう。

```bash
$ hugo new blog/first-post.md
```
中身を見ると、こんな感じの記述が書いてあります。

```bash
---
title: "First Post"
date: 2023-06-15T08:04:53+09:00
draft: true
---
```

良いですね。次はFirebaseにデプロイしていきます。
### Firebaseにデプロイ

事前準備が必要です。
1. firebaseにProjectの作成
2. firebase cliのダウンロード

基本的に[公式サイトのデプロイ方法](https://gohugo.io/hosting-and-deployment/hosting-on-firebase/)を踏襲していきます。
```bash
$ firebase init

     ######## #### ########  ######## ########     ###     ######  ########
     ##        ##  ##     ## ##       ##     ##  ##   ##  ##       ##
     ######    ##  ########  ######   ########  #########  ######  ######
     ##        ##  ##    ##  ##       ##     ## ##     ##       ## ##
     ##       #### ##     ## ######## ########  ##     ##  ######  ########

You're about to initialize a Firebase project in this directory:

  /Users/subaru/dev_2023/quickstart

Before we get started, keep in mind:

  * You are initializing within an existing Firebase project directory

? Which Firebase features do you want to set up for this directory? Press Space to select features, then Enter to confirm your choices. Hosting: Configure files for Firebase Hosting
 and (optionally) set up GitHub Action deploys

=== Project Setup

First, let's associate this project directory with a Firebase project.
You can create multiple project aliases by running firebase use --add, 
but for now we'll just set up a default project.

i  Using project hugo-8520c (hugo)

=== Hosting Setup

Your public directory is the folder (relative to your project directory) that
will contain Hosting assets to be uploaded with firebase deploy. If you
have a build process for your assets, use your build's output directory.

? What do you want to use as your public directory? public
? Configure as a single-page app (rewrite all urls to /index.html)? No
? Set up automatic builds and deploys with GitHub? Yes
? File public/404.html already exists. Overwrite? Yes
✔  Wrote public/404.html
? File public/index.html already exists. Overwrite? Yes
✔  Wrote public/index.html

i  Detected a .git folder at /Users/subaru/dev_2023/quickstart
i  Authorizing with GitHub to upload your service account to a GitHub repository's secrets store.

Visit this URL on this device to log in:
https://github.com/login/oauth/authorize?client_id=89cf50f02ac6aaed3484&state=1069960515&redirect_uri=http%3A%2F%2Flocalhost%3A9005&scope=read%3Auser%20repo%20public_repo

Waiting for authentication...

✔  Success! Logged into GitHub as subaru-hello

? For which GitHub repository would you like to set up a GitHub workflow? (format: user/repository) subaru-hello/hugo-blog

✔  Created service account github-action-649310046 with Firebase Hosting admin permissions.
✔  Uploaded service account JSON to GitHub as secret FIREBASE_SERVICE_ACCOUNT_HUGO_8520C.
i  You can manage your secrets at https://github.com/subaru-hello/hugo-blog/settings/secrets.

? Set up the workflow to run a build script before every deploy? Yes
? What script should be run before every deploy? hugo && firebase deploy

✔  Created workflow file /Users/subaru/dev_2023/quickstart/.github/workflows/firebase-hosting-pull-request.yml
? Set up automatic deployment to your site's live channel when a PR is merged? Yes
? What is the name of the GitHub branch associated with your site's live channel? main

✔  Created workflow file /Users/subaru/dev_2023/quickstart/.github/workflows/firebase-hosting-merge.yml

i  Action required: Visit this URL to revoke authorization for the Firebase CLI GitHub OAuth App:
https://github.com/settings/connections/applications/89cf50f02ac6aaed3484
i  Action required: Push any new workflow file(s) to your repo

i  Writing configuration info to firebase.json...
i  Writing project information to .firebaserc...

✔  Firebase initialization complete!
SubarunoMacBook-puro-3:quickstart subaru$ hugo && firebase deploy
Start building sites … 
hugo v0.112.7+extended darwin/amd64 BuildDate=unknown

                   | EN  
-------------------+-----
  Pages            |  7  
  Paginator pages  |  0  
  Non-page files   |  0  
  Static files     |  1  
  Processed images |  0  
  Aliases          |  0  
  Sitemaps         |  1  
  Cleaned          |  0  

Total in 223 ms

=== Deploying to 'hugo-8520c'...

i  deploying hosting
i  hosting[hugo-8520c]: beginning deploy...
i  hosting[hugo-8520c]: found 11 files in public
✔  hosting[hugo-8520c]: file upload complete
i  hosting[hugo-8520c]: finalizing version...
✔  hosting[hugo-8520c]: version finalized
i  hosting[hugo-8520c]: releasing new version...
✔  hosting[hugo-8520c]: release complete

✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/hugo-8520c/overview
Hosting URL: https://octomblog.com

```
### まとめ
hugoはgoで作られただけあって、ビルドが早いですね。今後も使用していきたいです。
