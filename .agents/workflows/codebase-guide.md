---
description: AI開発アシスタント向けのプロジェクト・クイックリファレンス（具体構造・主要ドキュメント・参照先）
---

# りんご薬局 シフト作成ツール Codebase Guide

このドキュメントは、AIアシスタントが本プロジェクトの **具体的なコード構造・主要ドキュメント・運用慣習** を素早く把握するためのリファレンス。
ルール・行動規範は `CLAUDE.md`（リポジトリルート）にあり、本ファイルはそれに対応する **「実装の地図」** を提供する。

> **読む順番:**
> 1. `CLAUDE.md`（自動ロード） — 行動規範・Core Instincts
> 2. `.agents/handover.md` — 現在の作業状態
> 3. **本ファイル** — プロジェクト構造・主要ファイルの所在
> 4. `.agents/workflows/<task>.md` — 着手するタスクに応じてオンデマンド

---

## 1. プロジェクト概要

**りんご薬局 シフト作成ツール** は、りんご薬局（1店舗）のスタッフ7名（自動割り当て対象）が希望休をWeb入力し、ルールベースのアルゴリズムがシフト案を自動生成するWebアプリケーション。

- **本番URL**: 未設定（GitHub Pages / Vercel を想定）
- **インフラ**: 静的HTML + Supabase（PostgreSQL）
- **技術スタック**: HTML / Vanilla CSS / Vanilla JS + Supabase JS SDK / Lucide Icons / Google Fonts（Inter / Noto Sans JP）

---

## 2. ディレクトリ構造と役割

```
りんご：シフト作成/
├── CLAUDE.md                   ← AI行動規範（自動ロード）
├── index.html                  ← 希望休収集画面（PC: ガントチャート / スマホ: カレンダー）
├── generate.html               ← シフト自動生成画面
├── admin.html                  ← 管理画面（スタッフ・月別設定）
├── login.html                  ← ログイン画面（将来用）
├── js/
│   ├── main.js                 ← 希望休収集UIロジック（~48KB）
│   ├── generate.js             ← シフト生成アルゴリズム中核（~76KB ⚠️大規模）
│   ├── admin.js                ← 管理画面ロジック（~8KB）
│   ├── supabase-config.js      ← Supabase接続設定（⚠️.gitignore対象・本番キー）
│   └── supabase-config.sample.js ← 設定サンプル（コミット用）
├── css/                        ← スタイルシート
├── docs/
│   ├── ringo-requirements.md   ← スタッフ構成・勤務条件（**正本** 7名体制）
│   ├── shift-generation-requirements.md ← ハード/ソフト制約一覧（実装状況付き）
│   └── changelog.md            ← ⚠️廃止済み → .agents/changelog.md に統合
├── sql/                        ← Supabase初期スキーマSQL（未投入）
└── .agents/                    ← AIエージェント設定（このディレクトリ）
    ├── handover.md             ← 現在の作業状態（毎セッション読む）
    ├── lessons.md              ← Critical Rules サマリ（毎セッション読む）
    ├── changelog.md            ← 作業ログ + シフト変更ログ（経緯調査時のみ）
    ├── lessons/                ← 詳細教訓カテゴリ（オンデマンド）
    ├── workflows/              ← 作業ワークフロー手順書（オンデマンド）
    └── skills/                 ← スキルセット強化（オンデマンド）
```

---

## 3. 主要ファイルの詳細

### 🔑 `js/generate.js`（～76KB — 中核ファイル）

**このファイルへの変更は慎重に。推測でコードを書かない。**

主要な関数構成：
- `generateShifts()` — エントリーポイント。30パターン試行 → 最高スコア採用
- `runAllChecks()` — 全制約チェックを実行し構造化データを返す（スコアリング・UI表示共用）
- `scoreShifts()` — `runAllChecks()` の結果から scoreDelta を合算
- `renderConditionsCheck()` — `runAllChecks()` の結果をUIに描画
- `tryAssignPharmacist()` / `tryAssignOffice()` — 薬剤師・事務の配置ロジック

⚠️ `scoreShifts()` と `renderConditionsCheck()` はかつて二重実装（~400行重複）されていた。現在は `runAllChecks()` で共通化済み。この構造を崩さないこと。

### 📋 `docs/ringo-requirements.md`（要件定義 正本）

スタッフ11名の個別条件・シフト枠・制約を定義。
アルゴリズムの変更前に必ずここを参照し、ルールの根拠を確認すること。

### 📋 `docs/shift-generation-requirements.md`（制約条件一覧）

ハード制約H1〜H8（違反不可）、ソフト制約S1〜S7（優先度順最適化）を定義。
条件チェックパネルの実装基準はここにある。

---

## 4. 外部連携と環境モード

- **Supabase**: `js/supabase-config.js` にURL・匿名キーを設定（`.gitignore`管理）
- **サンプル**: `js/supabase-config.sample.js` を参考に設定ファイルを作成
- **⚠️ 本番DBへの直接SQL操作は絶対禁止**
- ローカル検証時は Supabase の別プロジェクト（テスト環境）を使うこと

---

## 5. 開発ワークフロー

- **ローカル起動**: `npx -y http-server -p 8000 -c-1`
  - `http://localhost:8000/` — 希望休収集画面
  - `http://localhost:8000/generate.html` — シフト生成画面
  - `http://localhost:8000/admin.html` — 管理画面
- **コミット規約**: Conventional Commits（`feat:`, `fix:`, `refactor:`, `docs:` 等）
- **詳細**: `.agents/workflows/development-workflow.md` / `deploy.md`

---

## 6. スタッフ構成サマリ（アルゴリズム理解用）

| 名前 | 職種 | 区分 | 主要制約 |
|---|---|---|---|
| 鈴木 怎那 | 薬剤師 | 常勤・代表 | 他を先に配置して残りを埋める。金・日は固定休 |
| 福島 真依子 | 薬剤師 | 常勤 | 週４～５日・午前中心。連勤≤５ |
| 湯本 有美子 | 薬剤師 | 常勤 | 月８回（6〜10）。連勤≤2。平日は午後中心。１人勤務禁止 |
| 服部 孝子 | 薬剤師 | 常勤 | 週３.5日（水木金終日＋土日どちらか）。月火は固定休 |
| 野口 由美子 | 事務 | 常勤 | 週５日。日・月は固定休 |
| 小野寺 美桃子 | 事務 | 常勤 | 週５日。水・土は固定休 |
| 笠原 若菜 | 事務 | パート | 週２日（日・月のみ）。火～土は固定休 |

詳細は `docs/ringo-requirements.md` を参照。

---

## 7. 関連リンク

- 行動規範・絶対ルール → `CLAUDE.md`
- 危険領域（触ってはいけないファイル） → `CLAUDE.md` §7（Danger Zone）
- 過去の作業履歴 → `.agents/changelog.md`
- 教訓・アンチパターン → `.agents/lessons.md` + `.agents/lessons/<category>.md`
