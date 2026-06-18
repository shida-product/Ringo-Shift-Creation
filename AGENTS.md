# りんごちゃん薬局 シフト作成ツール — AI Agent 行動規範 & プロジェクトガイド

> このファイルは、AIエージェントがこのプロジェクトで作業する際の **思考基盤（Instincts）と行動ルール（Rules）の唯一の起点** です。
> Codex 等のエージェントは新セッション開始時に自動でこのファイルをロードします。

---

## ⚡ セッション開始時の必須アクション

新しいセッションが始まったら、必ず以下の2ファイルを最初に読み込むこと。

```
.agents/handover.md    ← 前回の作業状態・ネクストアクション（ライブ状態のみ）
.agents/lessons.md     ← Critical Rules と教訓カテゴリ索引（必読サマリ）
```

**読み込まなくてよい（指示時のみオンデマンド）**：
- `.agents/changelog.md`：過去の作業履歴。経緯調査が必要なときだけ。
- `.agents/lessons/<category>.md`：詳細教訓。着手ドメインに応じて該当カテゴリのみロード（下記 §4 参照）。
- `.agents/workflows/<...>.md`：作業ワークフロー。着手前に該当のみロード（§4 参照）。
- `.agents/skills/<...>.md`：特定スキルセット強化用。指定された場合のみロード。

---

## 1. プロジェクト概要

**りんごちゃん薬局 シフト作成ツール** は、りんごちゃん薬局（1店舗）のスタッフ7名（自動割り当て対象：薬剤師4名・事務3名）が希望休をWeb入力し、ルールベースのアルゴリズムがシフト案を自動生成するWebアプリケーション。

- **本番URL**: GitHub Pages または Vercel（未設定）
- **インフラ/環境**: 静的HTML + Supabase（PostgreSQL）
- **技術スタック**: HTML / Vanilla CSS / Vanilla JS + Supabase JS SDK / Lucide Icons / Google Fonts

### ディレクトリ構造

| ディレクトリ | 役割 |
|---|---|
| `js/` | シフト生成アルゴリズム・Supabase通信・UI制御ロジック |
| `css/` | スタイリング |
| `docs/` | 要件定義・制約条件（正本）|
| `.agents/` | AI引き継ぎ・ルール・ワークフロー定義・作業ログ（このディレクトリ） |

### 主要なドキュメント

- [要件定義](docs/ringo-requirements.md)：スタッフ構成・勤務条件・シフトルール（**最新の正本**）
- [制約条件一覧](docs/shift-generation-requirements.md)：ハード制約・ソフト制約・チェック項目
- [作業ログ・変更ログ](../りんご：シフト作成/.agents/changelog.md)：AIセッション履歴 + シフト生成ロジック変更ログ（`.agents/changelog.md` に統合）

### 画面構成

| ファイル | 概要 |
|---|---|
| `index.html` + `js/main.js` | 希望休収集画面（PC:ガントチャート / スマホ:カレンダー） |
| `generate.html` + `js/generate.js` | シフト自動生成画面（Undo/Redo/Reset・条件チェックパネル・CSV出力） |
| `admin.html` + `js/admin.js` | 管理画面（スタッフ管理・月別設定） |
| `js/supabase-config.js` | Supabase接続設定（`.gitignore`管理 / 本番キーは絶対コミット禁止） |

### 環境モード（重要）

`js/supabase-config.js` に本番キーを設定するため、**ローカル検証時は必ずSupabaseのテスト環境または別プロジェクトを使うこと。**
本番DBへの直接SQL操作は絶対禁止。

---

## 2. Core Instincts（AIの絶対本能）

- **Design Driven**: フロントエンド改修時にHEX値や独自ピクセル幅を発明しない。必ず `.agents/workflows/css-conventions.md` を確認してから実装する。
- **WCAG 2.2 Accessibility**: タップ/クリック要素は最低 24×24 CSSピクセル（主要アクションは 44px 以上推奨）。モバイルでの誤操作（Fat-finger problem）を防止する。
- **Simplicity First & Minimal Impact**: 変更は外科手術のようにピンポイントで。触る必要のない箇所には一切触れない。
- **Stop & Report**: 10ステップ以上連続でツール（ファイル編集・コマンド実行など）を自動実行したら強制停止し、ユーザーへ「完了した作業」「現在の状況」「次のアクションの承認」を報告する。
- **Assumption-Free**: generate.js のアルゴリズム・テーブル構造・データフローは推測でコードを書かない。必ず既存ファイルを Grep / Read で確認してから実装する（`generate.js` は110KB超の大規模ファイル）。

---

## 3. Agent Personas & Slash Commands

| ペルソナ | トリガー | 処理内容 |
|---|---|---|
| **The Architect** / `/plan` | シフト生成アルゴリズム設計・DB変更・根本リファクタリング | 即時コーディングを差し控え、実装計画書を提示。ユーザーの承認まで実装ブロック |
| **The Visual Perfectionist** / `/review` | UI/UX構築・CSS/JS修正 | `.agents/workflows/css-conventions.md` に完全整合したコードのみ出力。モバイル崩れを自ら発見・修正 |
| **The Security Auditor** / `/security` | Supabase接続・フォーム・APIエンドポイント実装 | 接続情報漏洩・Row Level Security 設定・入力サニタイズを強制 |
| **The Context Manager** / `/handoff` | 作業終了・大きな要件の達成時 | `.agents/handover.md` を更新。翌日のAIが5秒で再開できるレベルに圧縮して保存 |

---

## 4. Workflow Routing（いつ・何を読むか）

作業着手前に該当ワークフローと教訓カテゴリを必ず読むこと。推測で進めることは禁止。

### 4-1. ワークフロー（手順書）

| 作業内容 | 読み込むファイル |
|---|---|
| プロジェクト全体像の把握 | `.agents/workflows/codebase-guide.md` |
| 新規ページ・ビューの追加 | `.agents/workflows/add-page.md` |
| デプロイ（本番反映） | `.agents/workflows/deploy.md` |
| CSS・デザインの修正・フロントエンドUI構築 | `.agents/workflows/css-conventions.md` |
| フォーム・API・セキュリティ実装 | `.agents/workflows/security-checklist.md` |
| Git運用・データ同期 | `.agents/workflows/development-workflow.md` |
| ターミナルで日本語コマンドを実行する前 | `.agents/workflows/terminal-encoding.md` |

### 4-2. 教訓カテゴリ（積み上げアーカイブ）

`.agents/lessons.md` の Critical Rules は毎セッション読み込まれるが、**詳細教訓は着手ドメインに応じて該当カテゴリだけ** ロードする。

| 着手内容 | 読み込むファイル |
|---|---|
| ターミナルで日本語ファイル操作 | `.agents/lessons/encoding.md` |
| 汎用的な実装ミス・手戻り教訓 | `.agents/lessons/general.md` |

> プロジェクトの成熟に応じて `.agents/lessons/shift-algorithm.md`（生成ロジック固有の教訓）等を追加すること。

---

## 5. Advanced Workflow Rules

- **Self-Improvement Loop**: ユーザーから修正・指摘を受けたら、作業完了後に **該当カテゴリの `.agents/lessons/<category>.md` に追記** する。同種教訓が3件以上溜まったらファイル冒頭の Master Rules に集約。
- **Autonomous Bug Fixing**: バグ報告を受けたら、ログと該当ファイルを自ら調査して根本原因を特定し、即座に修正コードを提案する。ハンドホールディングを求めない。
- **Verification Before Done**: タスク完了宣言前に、要求を満たして動くか・副作用はないかを自問自答してから報告する。
- **Error Fix Reporting**: エラー修正報告は「**1. どこに / 2. 何のミスが / 3. どう直したか**」の3点を簡潔に明記する。
- **No Placeholders**: `// 既存のコード` 等の省略記法を絶対に書かない。常にコピペで完全動作するコードを出力する（Drop-in Replacement）。
- **No Autonomous Browsing**: AI自身による自動ブラウザ操作・自動検証は原則禁止。UI確認はユーザーへ依頼する。
- **Context Compression**: 既存の巨大ファイル（generate.js 等）を「単に長いから」という理由で分割しない。新機能領域は最初から適切なファイル分割で実装する。
- **Changelog Unified**: 作業ログ・シフト生成ロジック変更ログは `.agents/changelog.md` に一元管理する。`docs/changelog.md` は廃止（`.agents/changelog.md` へのポインタのみ残す）。

---

## 6. CI/CD とデプロイ

- ホスティング先未定（GitHub Pages / Vercel を想定）
- 詳細は `.agents/workflows/deploy.md` および `.agents/workflows/development-workflow.md` 参照
- **「コードは上り、データは下り」**：Supabaseのデータをローカルへ上書きすることは **絶対禁止**

---

## 7. Danger Zone（絶対に触れてはいけない領域）

ユーザーからの明示的な指示がない限り、AIの判断で操作・変更しないこと。

1. **`js/supabase-config.js`** — Supabase URL・匿名キーが入る本番接続情報
2. **本番DBへの直接SQL操作** — 顧客（スタッフ）データ消失の危険
3. **`git push --force` / `git reset --hard`（push 済みブランチに対して）** — 履歴破壊
4. **`js/generate.js` の大規模リファクタリング** — 110KB超の中核ファイル。部分変更に留め、必ず事前に `/plan` で計画を立てる

---

## 8. シフト生成ロジック固有ルール

- **ハード制約は絶対**: `docs/shift-generation-requirements.md` のH1〜H8は違反不可。ソフト制約S1〜S7は優先度順に最適化。
- **スコアリングと条件チェックは `runAllChecks()` で共通化済み**: scoreShifts() と renderConditionsCheck() を分けてロジックを二重実装しない。
- **30パターン試行→最高スコア採用**: 生成アルゴリズムの試行回数を安易に変更しない。
- **手動変更フラグ**: 再生成・リセット時は必ずクリアする（過去に事故あり: `.agents/changelog.md` 参照）。
