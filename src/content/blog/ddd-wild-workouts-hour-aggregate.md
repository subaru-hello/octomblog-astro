---
title: "Go OSSコードから読み解くDDD：Hour集約とValue Objectの境界"
description: "Wild Workouts（ThreeDotsLabs）のGoコードを読んでDDDを学ぶ。Hour Entity・Availability Value Object・Repositoryインターフェースの設計を分析。"
date: 2026-04-06T00:00:00+09:00
author: subaru
authorEmoji: 🐙
tags:
- DDD
- Go
- アーキテクチャ
categories:
- engineering
---

隣のおばちゃんがカレーをくれた。「なんでも相談して、私悪い人じゃないから」「米美味しいのよ」「孫、ひ孫が８人いるの」と矢継ぎ早に話しかけてくれる。まだ悪い人じゃなさそうだ。最後に「ガスコンロはあるかしら？」と聞かれた。あるに決まってんだろ〜と心の中で笑いながら、ご近所付き合いって悪くないなと思った一日。

---

今回は[ThreeDotsLabs/wild-workouts-go-ddd-example](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example)のGoコードを読んで、DDDの概念を具体的に確認した。フィットネス予約システムというシンプルなドメインだが、実装が丁寧でDDDの教科書として読みやすい。

## 対象コード：`internal/trainer/domain/hour/`

トレーナーの時間スロット管理を担うパッケージ。`Hour`（時間枠）という概念を中心に設計されている。

---

## Hour は Entity、Availability は Value Object

```go
type Hour struct {
    hour         time.Time
    availability Availability
}

type Availability struct {
    a string
}

var (
    Available         = Availability{"available"}
    NotAvailable      = Availability{"not_available"}
    TrainingScheduled = Availability{"training_scheduled"}
)
```

`Hour` は「時刻」という識別子を持ち、状態（availability）が変化する。これが **Entity**。

`Availability` は「状態の値」を表現するだけで、識別子を持たない。どの `Available` も意味が同じ。これが **Value Object**。

### Availability を string ではなく struct にする理由

```go
// 悪い例
type Availability string
const Available Availability = "available"

// このコードの実装
type Availability struct{ a string }
var Available = Availability{"available"}
```

`string` にすると `Availability("invalid")` という無効な値が作れてしまう。`struct` にすることで、パッケージ外からは `NewAvailabilityFromString()` 経由でしか生成できなくなる。**無効な状態を型レベルで排除**している。

---

## 業務ルールはドメインオブジェクトのメソッドに書く

```go
func (h *Hour) ScheduleTraining() error {
    if !h.IsAvailable() {
        return ErrHourNotAvailable
    }
    h.availability = TrainingScheduled
    return nil
}

func (h *Hour) CancelTraining() error {
    if !h.HasTrainingScheduled() {
        return ErrNoTrainingScheduled
    }
    h.availability = Available
    return nil
}

func (h *Hour) MakeNotAvailable() error {
    if h.HasTrainingScheduled() {
        return ErrTrainingScheduled
    }
    h.availability = NotAvailable
    return nil
}
```

「利用可能な時間帯のみトレーニング予約できる」「予約済みのトレーニングしかキャンセルできない」という業務ルールが、`Hour` のメソッドに直接書かれている。

サービス層に `if hour.Availability == "available"` と書くのではなく、`hour.ScheduleTraining()` を呼ぶだけでルールが保証される。これが「業務ロジックをドメインオブジェクトに集約する」の意味。

---

## Factory が生成時の検証ロジックをカプセル化する

```go
func (f Factory) validateTime(hour time.Time) error {
    if !hour.Round(time.Hour).Equal(hour) {
        return ErrNotFullHour          // フルアワーのみ有効
    }
    if hour.Before(time.Now().Truncate(time.Hour)) {
        return ErrPastHour             // 過去の時間は不可
    }
    if hour.After(time.Now().AddDate(0, 0, f.fc.MaxWeeksInTheFutureToSet*7)) {
        return TooDistantDateError{...} // 最大N週間先まで
    }
    if hour.UTC().Hour() > f.fc.MaxUtcHour {
        return TooLateHourError{...}   // 営業時間外
    }
    return nil
}
```

「過去の時間帯は作れない」「最大7週間先まで」「UTC営業時間内のみ」という制約が Factory に集まっている。

DBからの復元時は時間の範囲チェックをスキップする別のメソッド（`UnmarshalHourFromDatabase`）を使う。生成の文脈によってルールが変わる場合に Factory パターンが有効になる。

---

## Repository は interface で定義する

```go
type Repository interface {
    GetHour(ctx context.Context, hourTime time.Time) (*Hour, error)
    UpdateHour(
        ctx context.Context,
        hourTime time.Time,
        updateFn func(h *Hour) (*Hour, error),
    ) error
}
```

`UpdateHour` が `updateFn` という関数を受け取る設計が面白い。「どのデータストアに保存するか」はRepositoryの実装に任せ、「何を変更するか」はドメイン側に委譲する。

```go
// 呼び出し側
r.UpdateHour(ctx, hourTime, func(h *Hour) (*Hour, error) {
    if err := h.ScheduleTraining(); err != nil {
        return nil, err
    }
    return h, nil
})
```

ドメインロジック（`ScheduleTraining`）とインフラ（DB更新）が綺麗に分離されている。

---

## このコードのユビキタス言語

| 用語 | 意味 |
|------|------|
| Hour | トレーナーの1時間単位の時間スロット |
| Available | 予約受け付け可能な状態 |
| NotAvailable | 予約不可の状態 |
| TrainingScheduled | トレーニング予約済みの状態 |
| ScheduleTraining | 時間帯にトレーニングを予約する操作 |
| CancelTraining | 予約済みトレーニングをキャンセルする操作 |

コード上の名前がそのまま業務の言葉になっている。「予約する」を `book()` や `reserve()` ではなく `ScheduleTraining()` と書くことで、フィットネス業界の言葉でコードが読める。

---

## まとめ：このコードで確認できたDDDの原則

1. **Entity vs Value Object**：識別子を持つか否かで分ける。Availability のように「状態」は Value Object にする
2. **業務ロジックはドメインオブジェクトのメソッドへ**：サービス層は「誰を呼ぶか」だけ決める
3. **Factory で生成時の不変条件を守る**：生成文脈によってルールが変わる場合に使う
4. **Repository は interface**：ドメイン層からインフラへの依存を逆転させる

次回は `internal/users/` か、Bounded Context 間の通信（コンテキストマップ）を見ていく。
