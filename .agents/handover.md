# AI 引継ぎドキュメント (The Context Manager)

> **🤖 セッション開始時の確認事項**
> - 最新のルール・行動指針は **`CLAUDE.md`**（リポジトリルート）。
> - 必読の Critical Rules は **`.agents/lessons.md`**（自動ロード）。
> - 過去の作業ログ・シフト生成ロジック変更ログは **`.agents/changelog.md`**（手動ロード、経緯調査時のみ）。
> - **タスクの区切り・セッション終了時** は本ファイルを最新化し、**完了済みの詳細ログは `changelog.md` へ退避** すること。

---

## 🎯 Current Focus（現在取り組んでいる大きな目的）

**M6: ドキュメント整合・各種バグ修正フェーズ（完了） → M7: 本番運用移行フェーズへ**

主要画面（希望休収集・シフト生成・管理）は全てSupabaseの実DB（`ringo_`系テーブル）と完全連動し、正常に動作しています。
モック処理・オンメモリ運用はすべて解除されました。
今後は実運用に向けた細かなバグフィックスとデータ検証が中心となります。

---

## 📋 タスク整理サマリ

| レーン | いまの位置 | 次にやること（1行） |
|---|---|---|
| **M1: 要件定義** | ✅ 完了 | `docs/ringo-requirements.md` 確定済み（7名体制） |
| **M2: DB構築** | ✅ 完了 | Supabase連携有効化済み（`ringo_staff`, `ringo_shift_requests`, `ringo_shift_assignments`） |
| **M3: 希望休収集画面** | ✅ 完了 | `index.html` / `js/main.js` DB連動済み・固定休合成対応 |
| **M4: 管理画面** | ✅ 完了 | カラー管理・スタッフ有効/無効のDBトグル実装済み |
| **M5: シフト生成** | ✅ 完了 | `generate.js` DB連動・固定休合成・オオギ式アイコン表示に対応 |
| **M6: ドキュメント整合** | ✅ 完了 | handover/codebase-guide/requirements 全て更新済み |

---

## 📝 Last Action（前回どこまで終わったか）

### ✅ 2026-05-06 Supabase実DB連携の完全有効化とUI改善

- **DB連携の解除（モック廃止）**:
  - `admin.js`, `main.js`, `generate.js` の全機能（CRUD）をSupabaseの `ringo_` テーブルへ接続。
  - 管理画面のスタッフ無効化設定を `localStorage` からDBの `is_active` カラム更新へ移行（端末間同期化）。
- **固定休の動的生成（ベストプラクティス対応）**:
  - `generate.js` の `loadRequests` 時に `main.js` と同等の仮想的な固定休合成（`is_virtual: true`）を追加。
  - シフト生成ページのガントチャートに固定休のストライプ表示を実装。
- **ガントチャートUIの刷新**:
  - オオギプロジェクトのスタイルを踏襲し、勤務パターンのアイコンを「丸ポッチ＋テキスト」から「角丸正方形（`.pattern-marker`）」に変更。

> 次の一手: 実際のスタッフが使用できる状態になっているため、テスト運用を開始し、不具合や運用ルールの漏れがないか確認する。

---

## 📋 Next Actions

### 🧪 テスト運用・本番移行
- ローカルサーバ（`npx -y http-server -p 8000 -c-1`）またはデプロイ環境で実際のユーザー操作をテスト。
- シフト生成結果（Excel/CSV出力やPDF要件）の最終確認。
- DBの初期データ（`ringo_staff`等）が正しくSupabaseに投入されているかの整合性チェック。

---

## ⚠️ Pending Issues

- 特になし（Supabase接続のオンメモリ運用問題・localStorage同期問題はすべて解消済み）。

---

## 🛡️ 複数PC作業時のGitルール（必読）

```bash
git fetch origin
git status
```

| 表示 | 対応 |
|---|---|
| `Your branch is up to date` | そのまま作業開始してOK |
| `Your branch is behind` | `git pull` で取り込んでから作業 |
| `Your branch has diverged` | バックアップブランチ作成後に `git reset --hard origin/<branch>` |

---

**※ 次のセッション開始プロンプト例：**

`「.agents/handover.md を読んで、次のタスクから着手して」`
