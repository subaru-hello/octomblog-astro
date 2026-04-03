---
title: "【SQL】sakilaでSQLの練習"
description: "SQLの練習にはsakilaを使おう"
date: 2023-06-06T22:23:07+09:00
author: subaru
authorEmoji: 🐙
tags:
- SQL
categories:
- SQL
image: images/feature2/mysql.png
---

## Introduction

sakilaを活用したSQLの練習

テーブル設計も載っている。

MySQL :: Sakila Sample Database :: 5 Structure

使用していくデータをインポートしてくる。

sakila sample databaseというものを使うみたい。

URLへアクセスして、example databasesにあるsakila sample databaseをダウンロード

MySQL :: Other MySQL Documentation

ダウンロードしたSQLファイルをデータベースに入れていく

How do I import an SQL file using the command line in MySQL?

ここまでやって気づいたけど、簡単にsakilaのデータベース環境を整えられるリポジトリを発見した。

https://github.com/tadatakuho/mysql-docker

READMEにある通り、下記の3ステップで環境を整えることができる

```bash
$ git clone git@github.com:tadatakuho/mysql-docker.git

$ cd mysql-docker

$ docker-compose up -d

```

dockerを立ち上げたら、docker内のmysqlへ潜り込んでいく

```bash
root@d69b65147102:/# mysql -u root -proot

Welcome to the MySQL monitor.  Commands end with ; or \\g.
Your MySQL connection id is 10
Server version: 8.0.29 MySQL Community Server - GPL

Copyright (c) 2000, 2022, Oracle and/or its affiliates.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\\h' for help. Type '\\c' to clear the current input statement.

mysql> show databases;
+--------------------+
| Database           |
+--------------------+
| information_schema |
| mysql              |
| performance_schema |
| sakila             |
| sys                |
+--------------------+
5 rows in set (0.07 sec)

mysql> use sakila;
Reading table information for completion of table and column names
You can turn off this feature to get a quicker startup with -A

Database changed

```

usage guideへアクセスして、使い方を学んでいく。


```bash
MySQL :: Sakila Sample Database :: 6 Usage Examples

```


サンプル数が少ないので、キータの記事を参考にして、練習問題にチャレンジする。

SakilaとしたいSQLのお勉強-1 - Qiita

課題１を解いてみる

「nickさんの出演している映画」

必要なテーブルは三つ

Actor, FilmActor, Film

まずは、欲しい情報の名詞を探す。

今回は「映画」

first_nameかlast_nameがnickという名のActorを探すことになる。
先ほどActorから取得したidと一致するactor_idを持つFilmActorを探す。
そのFilmActorテーブル内にあるfilm_idを取得する。
そして、取得したFilmActorテーブル内のfilm_idと一致するidを持つFilmを取得する。

恐らく、テーブルを全て連結させてからデータを取得した方が無駄なクエリーは走らないはず。

だから、三つをくっつけてからwhereで取得する方法を探していく

三つ連結させる方法

Table1, Table2, Table3という三つのテーブルがあるとする。

それぞれをtable1を起点に、共通する部分のみの値を取得したいときは、下記の様にInner Joinを使う。

```bash
SELECT * FROM table1 
INNER JOIN table2 ON table1.id = table2.id 
INNER JOIN table3 ON table1.id = table3.id;
```


nymemo

Visual Representation of SQL Joins

クエリーに落とし込んでみる。

```bash
SELECT * FROM Film f
INNER JOIN FilmActor fa ON fa.actor_id = (SELECT id FROM Actor a where a.first_name = ‘nick’ or a.last_name = ‘nick’)
INNER JOIN f ON f.film_id = fa.id
```
楽しい