---
title: "Er Mermaid"
date: 2023-06-19T08:21:35+09:00
draft: true
---
お酒の強さ診断アプリをNext.jsで作り直しています。
なんとなくテーブル設計が完成したので、mermaidを使ってER図を作ってみました。
ただ、自分で書くことが面倒だったので、ChatGPTに作ってもらいました。

### 今回のmermaid
```
erDiagram

User ||--o{ Post : "Has"
User ||--o{ Account : "Has"
User ||--o{ Session : "Has"
User ||--|| Profile : "Has"
User ||--o{ Diagnosis : "Has"

Post ||--|| User : "AuthoredBy"

FavoriteAlcohol ||--|| Profile : "Has"
FavoriteAlcohol ||--|| Alcohol : "FavoriteOf"

Alcohol ||--o{ FavoriteAlcohol : "FavoritedBy"
Alcohol ||--o{ AlcoholGlass : "Has"
Alcohol ||--o{ CategoriesOnAlcohol : "In"

Category ||--o{ CategoriesOnAlcohol : "Has"

CategoriesOnAlcohol ||--|| Alcohol : "Has"
CategoriesOnAlcohol ||--|| Category : "Of"

AlcoholGlass ||--|| Alcohol : "Has"
AlcoholGlass ||--|| Glass : "Fits"

Glass ||--o{ AlcoholGlass : "FitsIn"

Diagnosis ||--|| User : "BelongsTo"
Diagnosis ||--|| TastAnswer : "Has"

TastAnswer ||--|| Diagnosis : "Of"

Account ||--|| User : "BelongsTo"

Session ||--|| User : "BelongsTo"

Profile ||--o{ FavoriteAlcohol : "Favorites"
Profile ||--|| User : "BelongsTo"

VerificationToken ||--|| User : "BelongsTo"

```

- 見た目

