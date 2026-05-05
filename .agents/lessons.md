# りんごちゃん薬局 シフト作成ツール AI Lessons - 必読サマリ

このファイルは **AI が毎セッション開始時に必ずロード** する **必読の Critical Rules** だけを集約した最短サマリ。
詳細ログ・全教訓は `.agents/lessons/<category>.md` にカテゴリ別で保管。深掘りが必要なときだけ該当カテゴリをロードすること。

---

## 🔴 Critical Rules（必読）

過去の本番事故・繰り返し検出された再発パターンから昇格させた、**例外なく守るべき** ルール。

| # | ルール | 違反兆候の例 | 詳細 |
|---|---|---|---|
| 1 | **Windows で PowerShell を使ってファイル置換しない** | `Get-Content` / `Set-Content` / `>` リダイレクトでの日本語ファイル書き換え | [encoding.md](lessons/encoding.md) |
| 2 | **インラインスタイル `style="..."` は装飾目的では禁止** — ユーティリティクラスかコンポーネントクラスで解決 | HTML/JS に `style="margin-bottom:24px"` 等の装飾系インライン | [general.md](lessons/general.md) |
| 3 | **「動かない」報告には推測で答えず、まずログ・該当ファイル・実行コマンドを確認** | エラーメッセージを読まずに「たぶん〇〇では」と返す | [general.md](lessons/general.md) |

> プロジェクトの成熟に応じて Critical Rules を増やしていくこと。

---

## 📚 カテゴリ別アーカイブ（オンデマンド）

CLAUDE.md の Workflow Routing 表に従って、着手前に該当カテゴリを **必要なときだけ** ロードする。

| カテゴリ | 着手前に読むタイミング |
|---|---|
| [lessons/encoding.md](lessons/encoding.md) | ターミナルで日本語ファイル操作・PowerShell 経由のコマンド実行 |
| [lessons/general.md](lessons/general.md) | 汎用的な実装ミス・手戻りパターンの参照 |

> プロジェクトの成熟に応じて `lessons/shift-algorithm.md`（シフト生成ロジック固有の教訓）等を追加すること。
> カテゴリ追加・運用ルールの詳細は [lessons/README.md](lessons/README.md) 参照。

---

## 🧠 積み上げ学習プロトコル

新しい教訓を発見したら、以下のフローで記録する。詳細は [lessons/README.md](lessons/README.md) を参照。

1. **追記（Capture）**: 該当する1カテゴリにだけ追記（重複本文は禁止、横断はリンクで表現）
2. **タグ付け（Indexing）**: タイトル先頭に `[Tag1][Tag2]` を必須化
3. **統合（Master Rule 化）**: 同一カテゴリで類似教訓 3 件以上 → ファイル冒頭の Master Rules に集約昇格
4. **サマリ昇格（Critical 化）**: 本番事故直結 / 3 回以上の再発 → 本ファイルの Critical Rules 表に格上げ
5. **退役（Archive）**: 永久に当てはまらなくなった場合のみ末尾に `🗄️ Archived` 注記。**削除はしない**

---

## 📝 追記フォーマット

```markdown
### YYYY-MM-DD [Tag1][Tag2] 教訓のタイトル
- **❌ Anti-pattern (どんなミスをしたか):**
- **✅ Solution / Rule (どうすれば防げるか):**
```

---

> 必読 Critical Rules: 3 件 / カテゴリ数: 2 / 最終棚卸し: 2026-05-05
