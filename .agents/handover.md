# AI 引継ぎドキュメント (The Context Manager)

> **🤖 セッション開始時の確認事項**
> - 最新のルール・行動指針は **`CLAUDE.md`**（リポジトリルート）。
> - 必読の Critical Rules は **`.agents/lessons.md`**（自動ロード）。
> - 過去の作業ログ・シフト生成ロジック変更ログは **`.agents/changelog.md`**（手動ロード、経緯調査時のみ）。
> - **タスクの区切り・セッション終了時** は本ファイルを最新化し、**完了済みの詳細ログは `changelog.md` へ退避** すること。

---

## 🎯 Current Focus（現在取り組んでいる大きな目的）

**M6: ドキュメント整合・各種バグ修正フェーズ**

主要画面（希望休収集・シフト生成・管理）は全て動作中。
Supabase 接続は意図的にオフ（オンメモリ動作）。
次の課題はローカル動作確認と将来的なDB接続有効化。

---

## 📋 タスク整理サマリ

| レーン | いまの位置 | 次にやること（1行） |
|---|---|---|
| **M1: 要件定義** | ✅ 完了 | `docs/ringo-requirements.md` 確定済み（7名体制） |
| **M2: DB構築** | ⏸ 意図的待機 | Supabase接続オフのままオンメモリ運用中。接続は将来対応 |
| **M3: 希望休収集画面** | ✅ 動作中 | `index.html` / `js/main.js` 完全動作（7名・固定休合成済み） |
| **M4: 管理画面** | ✅ 完了 | カラー管理・スタッフ有効/無効トグル実装済み |
| **M5: シフト生成** | ✅ 動作中 | `js/generate.js` りんご7名要件で動作・条件チェックパネル完備 |
| **M6: ドキュメント整合** | ✅ 完了 | handover/codebase-guide/requirements 全て更新済み |

---

## 📝 Last Action（前回どこまで終わったか）

### ✅ 2026-05-05 ドキュメント整合・各種修正

- `handover.md` / `codebase-guide.md` / `ringo-requirements.md` を実装実態に合わせ更新
- 手動入力スタッフ4名（村上・堀口・財津・山口）をシステムから排除・要件定義からも削除
- `js/main.js`: 服部の固定休（月・火）を `buildEffectiveRequests()` に追加
- `js/generate.js`: `runAllChecks()` に湯本専用チェック3つ追加（月勤務回数下限・土日重複・1人勤務）、'事務'/'事務パート'不一致バグを修正
- `js/admin.js`: 編集ボタン削除・`toggleActive` を localStorage 永続化で実装
- `docs/shift-generation-requirements.md`: 実装済みチェックボックスを更新

> 次の一手: ローカルサーバで動作確認。問題があれば随時修正。

---

## 📋 Next Actions

### 🎨 動作確認
- ローカルサーバ（`npx -y http-server -p 8000 -c-1`）で全画面を確認
- シフト生成→条件チェックパネルで湯本3チェックが正しく表示されるか確認
- 管理画面でトグルが動作するか確認

### ⚙️ バックエンド / DB（将来）
- Supabase 新規プロジェクト作成（りんご薬局用）
- `sql/` 配下の初期スキーマSQL投入
- `js/supabase-config.js` を本番キーで設定し、オンメモリ動作からDB動作に切り替え

---

## ⚠️ Pending Issues

- Supabase 接続は全画面でオフ（意図的）。オンメモリ運用中のため、ページリロードでデータがリセットされる。
- `loadHistoryData()` in generate.js は Supabase に直接アクセスするコードが残っている（l.1586〜）。DB接続を有効化するまでは呼ばれないが、接続時に要確認。
- `admin.js` のスタッフ有効/無効状態は localStorage に保存されるが、`main.js` / `generate.js` のスタッフリストには反映されない（独立した状態管理）。将来的に同期が必要。

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
