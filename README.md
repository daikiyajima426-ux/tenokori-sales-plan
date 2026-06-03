# 手残り販売計画 v0.2.0

農産物の収穫量を現場単位で入力し、kg換算、販売規格への組み直し、商品化済み量、未商品化量、手残りを確認するPWAです。

> 入力は現場単位。単位間は自由に換算。販売時は規格品へ組み直す。判断は手残り。

## 起動

```bash
npm install
npm run dev
```

ビルド確認:

```bash
npm run lint
npm run build
```

スマホ確認用にLANへ出す場合:

```bash
npm run build
npm run start -- -H 0.0.0.0 -p 3103
```

## 実装範囲

- 基本: 作物名、品種名、必要現金、メモ
- 単位: kg、箱、房、ケースなどの1単位あたり重量
- 収穫: 現場単位での収穫入力とkg換算
- 規格品: 重量指定または単位指定の販売規格
- 配分: 作る数入力、使用量kg入力、作れる数、実使用kg、余りkg
- 結果: 収穫合計kg、商品化済みkg、未商品化kg、総売上、総手残り、必要現金との差分
- localStorage自動保存
- JSONエクスポート・インポート
- テキスト出力、印刷用コピー、印刷
- ぶどう想定のサンプルデータ投入
- PWA manifest と Service Worker

## 保存仕様

保存場所はブラウザのlocalStorageです。外部送信、クラウド同期、複数ユーザー管理はありません。

保存キー:

- `tenokori-sales-plan:v0.2:plan`
- `tenokori-sales-plan:v0.2:units`
- `tenokori-sales-plan:v0.2:harvests`
- `tenokori-sales-plan:v0.2:specs`
- `tenokori-sales-plan:v0.2:allocations`
- `tenokori-sales-plan:v0.2:settings`

schemaVersion は `2` です。

## JSONバックアップ

「出力」タブからJSONをエクスポートできます。復元する場合は「JSONインポート」を使います。インポート時は既存データを上書きする確認を挟みます。

v0.1.1 JSONを読み込んだ場合は「このデータは旧形式です」と表示し、自動変換は行いません。

## v0.2.0で実装しないこと

EC販売、顧客管理、請求書、厳密な在庫管理、会計ソフト連携、税務処理、AI提案、クラウド同期、複数ユーザー管理、年度比較、販売実績分析、栽培管理、農薬管理、出荷ラベル作成、配送管理、PDF出力、CSV出力、Googleスプレッドシート連携は実装していません。

## 既知の制約

- 保存は単一ブラウザ内のlocalStorageのみです。
- v0.1.1データの自動変換はありません。
- PWAのオフライン利用は、初回表示後にService Workerが取得した範囲に限られます。
