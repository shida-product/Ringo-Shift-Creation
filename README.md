# Ringo Shift Creation — りんごちゃん薬局 シフト管理・自動生成

> 確認日: 2026-10-09／GitHub `main` のコード・仕様書との照合。実機・本番DB・外部勤怠システムへの取込試験は今回未実施。

## 概要

一般的な調剤薬局の業務運用を想定した、りんごちゃん薬局向けの希望休収集・シフト自動生成Webアプリです。スタッフがPC（ガントチャート）やスマートフォン（カレンダー）から希望休を登録し、管理者が明示的な勤務条件をもとにシフト案を生成・調整して、勤怠システム向けCSVを出力します。

- 1店舗／自動割当対象7名（薬剤師4名・事務3名）を前提とした個別実装
- ルールベース貪欲法の30パターン試行とスコアリングにより生成案を選定
- **生成AI／機械学習はシフト生成に使用していません**
- 利用者申告では毎月の業務に継続利用中
- Ogi版は医薬品の小売販売店に近い運営形態、Ringo版は一般的な調剤薬局を想定しており、業態・必要配置・勤務パターン・勤務条件が異なる独立した顧客向け実装です。汎用SaaSとして販売可能な状態を示すものではありません

## 画面と実装機能

| 画面 | 主な機能 |
| --- | --- |
| `login.html` | Supabase Authのメール・パスワードログイン |
| `index.html` / `js/main.js` | PCのガント／スマホのカレンダーによる希望入力、固定休の表示 |
| `generate.html` / `js/generate.js` | 30パターンのシフト生成、条件チェック、ガント表示、手動編集、Undo/Redo/Reset、CSV出力 |
| `admin.html` / `js/admin.js` | スタッフ一覧、有効・無効設定、カラー設定等 |

各業務画面はSupabase Authセッションを確認し、ログアウト導線を備えています。**画面上の認証チェックだけでDBへのアクセス制御が保証されるものではありません**。

### シフト生成

- 希望休、固定休、曜日別勤務パターン、スタッフごとの連勤上限・勤務日数、職種別の必要人数などを考慮
- 最初の1試行を基準生成とし、以後を変動試行として、30試行中の最高スコアを採用
- `runAllChecks()` を採点と条件チェック表示で共用
- 生成結果をSupabase DBへ保存。手動変更・Undo/Redo/Resetに対応
- 制約条件が相互に衝突する場合、**すべての勤務条件を必ず満たせると保証するものではありません**。生成後に条件チェックを確認してください
- 管理対象スタッフと勤務ルールの現行詳細は `docs/ringo-requirements.md` を参照

### マネーフォワード向けCSV

`js/generate.js` の `handleCSVExport()` で、従業員番号、姓名、日付、勤怠区分、勤務パターン等をCSVに出力します。ブラウザ側で `encoding-japanese` を使用しShift-JISへ変換します。

- CSVファイルによる受け渡し。**APIによるマネーフォワード直接同期ではありません**
- 取込先の勤務パターン名・勤怠区分名は文字単位の一致が重要（`◯` と `〇` の違いにも注意）
- 実際の取込仕様の注意は `docs/money-forward-csv-notes.md` を参照
- 外部サービスへの取込成功・本番環境での再検証は今回行っていません

## 技術構成

- HTML / Vanilla CSS / Vanilla JavaScript（ES Modules）
- Supabase JavaScript SDK / PostgreSQL
- Supabase Auth（メール・パスワード）
- Lucide Icons / Google Fonts
- 静的フロントエンド構成。本番の正確な配信先はコード・資料だけでは未確定

```text
login.html                  ログイン
index.html                  希望入力
generate.html               シフト生成・調整
admin.html                  スタッフ管理
js/main.js                  希望入力のUI・データ処理
js/generate.js              生成・チェック・CSV出力
js/admin.js                 スタッフ管理・表示色設定
js/supabase-config.js       環境別Supabase接続設定（機密値をコミットしない）
sql/                        DB定義・RLSなど
docs/ringo-requirements.md  現行要件の正本
docs/shift-generation-requirements.md  補助的な制約チェック資料（旧条件の残存に注意）
docs/money-forward-csv-notes.md        CSV取込時の注意
.agents/changelog.md        変更ログ
AGENTS.md / CLAUDE.md       開発・運用ルール
```

## 開発・保守時の注意

- ローカル検証にはテスト用のSupabase環境を使用し、本番DBやスタッフの希望情報を勝手に操作しないでください
- `sql/enable_rls.sql` は旧方式向けの**匿名アクセス全許可**設定を含みます。一方で `sql/02_enable_rls.sql` は認証ユーザーに限定する設定を記述しています。双方の存在は本番適用状態を示しません。本番RLSの現状を確認し、旧SQLを無条件に再適用しないでください
- `docs/shift-generation-requirements.md` には旧スタッフ体制の記述が残っています。条件変更時は `docs/ringo-requirements.md` と現行コード・DB設定を照合してください
- `js/admin.js` の表示色設定にはブラウザの `localStorage` を用いる部分があります。すべての管理設定がDB同期されると推測しないでください
- 実スタッフの氏名・勤務条件がコード・ドキュメントに含まれています。デモ・営業資料には架空のデータを使い、公開情報やアクセス権を見直してください
- 機能の改善や不具合修正では `AGENTS.md` と `CLAUDE.md` の安全境界を守ってください。アプリコード・勤務ロジック・本番DBの変更はこのREADME追加には含めません

## 状態・検証範囲

`.agents/handover.md` では2026-06-18時点で本番運用・保守フェーズと記録されています。また運用者から現在も毎月使用していることを確認済みです。今回のREADME作成ではコード／ドキュメントを読み取ったのみで、ローカル・実機テスト、本番RLSの検証、CSV実取込、現在のデプロイ先の検証は行っていません。
