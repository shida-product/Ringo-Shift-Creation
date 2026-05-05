---
description: CSS / スタイリングの記述ルール・命名規則・デザインシステム参照ルール
---

# スタイリング / CSS コーディング規約

このドキュメントは、CSS・デザイン実装における **絶対ルール** をまとめたもの。
プロジェクト固有の変数名・クラス名は `[prefix]` 等のプレースホルダーで示している。実プロジェクトでは具体名に置き換えること。

---

## 📌 絶対ルール（最優先）

1. **ハードコード禁止**: 色（HEX）・余白（px）・フォントサイズの直書きは禁止。必ずデザインシステムの CSS変数（`var(--xxx)`）かユーティリティクラスを経由する。
2. **インラインスタイル禁止（装飾目的）**: `style="margin:..."` 等の装飾系インラインは絶対書かない。動的値・JS制御による値のみ許容。
3. **デザインドキュメント参照必須**: CSS の設計・実装・修正を行う前に、必ずデザインドキュメント（`docs/design/DESIGN.md` 等）を読み込んでブランドカラー・フォント・シャドウルールを把握する。
4. **モック・スタイルガイドが Source of Truth**: 既存の CSS クラス名・コンポーネント構造は **1文字も改変しない**。推測で HTML 構造を書かない。

---

## ファイル構成（例）

| ファイル | 用途 |
|---|---|
| `[design-system].css` | 共通変数・コンポーネント・ユーティリティ |
| `[component-name].css` | コンポーネント・機能単位の専用スタイル |
| `style.css` / `main.css` | エントリーポイント（全 CSS のインポートをここに集約） |

> **新規 CSS ファイルを作成したら真っ先にエントリーポイントへの import を追加すること。** Vite / webpack 等のバンドル環境では、import されないファイルはビルドに含まれず、開発中は反映されているように見えても本番で消える。

---

## 命名規則

### プレフィックス
- ユーティリティ・コンポーネント: `[prefix]-` （例: `app-`, `ui-`, `[project-name]-`）
- ボタン: `btn-` プレフィックス（例: `.btn-primary`, `.btn-outline`）
- 状態クラス: `.is-active`, `.is-selected`, `.is-disabled`

### BEM / コンポーネント命名（採用する場合）
- Block: `.card`
- Element: `.card__header` / `.card__body`
- Modifier: `.card--featured` / `.card--small`

> プロジェクト方針として「BEM 採用 / 独自プレフィックス採用 / Tailwind 等のユーティリティファースト」のいずれかを **明記** し、混在させない。

---

## ユーティリティクラス例（実プロジェクトで定義する）

### 余白スケール
```css
.[prefix]-mt-sm { margin-top: 8px; }
.[prefix]-mt-md { margin-top: 16px; }
.[prefix]-mt-lg { margin-top: 24px; }
.[prefix]-mt-xl { margin-top: 32px; }
```

### Flex / Grid
- `.[prefix]-flex-center` — `display:flex; align-items:center; justify-content:center;`
- `.[prefix]-flex-between` — `display:flex; align-items:center; justify-content:space-between;`
- `.[prefix]-flex-1` — `flex: 1 1 0;`

### テキスト
- `.[prefix]-text-xs/sm/base/lg/xl` — フォントサイズスケール
- `.[prefix]-text-bold` — 太字
- `.[prefix]-text-muted` / `.[prefix]-text-danger` — 状態別カラー

### アイコンサイズ
- `.[prefix]-icon-xs` (12px) 〜 `.[prefix]-icon-2xl` (24px)

> **新しいユーティリティが必要になったら、ハードコードする前に `[design-system].css` に追加して使う。**

---

## ブレークポイント

| ブレークポイント | 用途 |
|---|---|
| `768px` | タブレット以下（メインのモバイルブレイクポイント） |
| `480px` | スマートフォン向け微調整 |

**`767px` などの「1px ずれ」は使用禁止。プロジェクトで決めた値（例: `768px`）に統一する。**

> タブレット以上を 992px / 1024px のどちらにするかも、プロジェクト全体で統一すること。混在させない。

---

## ボタンクラス体系（推奨）

**統一されたボタン体系を1セットだけ定義し、レガシー体系（独自プレフィックス等）は早期に廃止する。**

| クラス | 用途 |
|---|---|
| `.btn` | 基本スタイル（必須） |
| `.btn-primary` | プライマリ（ブランドカラー） |
| `.btn-outline` | 枠線のみ |
| `.btn-danger` | 赤枠線 |
| `.btn-danger-solid` | 赤ベタ |
| `.btn-sm` / `.btn-lg` | サイズ |
| `.btn-block` | 全幅 |
| `.btn-group` | ボタン群ラッパー |

---

## アイコン体系

**アイコンライブラリは1つに絞る。** 例: Lucide / Heroicons / FontAwesome のいずれか。
複数体系の混在（dashicons + 絵文字 + Lucide）は禁止。

サイズ指定は CSS 変数 / ユーティリティクラス（`.[prefix]-icon-md` 等）で行い、`width="N"` `height="N"` の直書きは避ける。

---

## レスポンシブ・表示制御ユーティリティ

| クラス | 動作 |
|---|---|
| `.d-none` | 非表示 |
| `.d-lg-none` | PC（992px〜）で非表示 |
| `.d-lg-block` | PC で block 表示 |
| `.d-lg-grid` | PC で grid 表示 |
| `.mobile-only` | PC で非表示 |

> **重要:** `display: flex/grid/block` を class に直書きする場合、必ず `[hidden] { display: none; }` をセットで定義する。Bootstrap 等の `.d-flex` を使う場合は `[hidden]` 互換が壊れるため要注意。

---

## デザインシステム参照ルール

### 必須参照ドキュメント
- **デザイン定義**: `docs/design/DESIGN.md`（ブランドカラー、タイポグラフィ、シャドウルール）
- **コンポーネント Source of Truth**: スタイルガイド HTML（例: `docs/design/style-guide.html`）

### CSS 変数の命名例
```css
:root {
  --primary-green: #76AA81;
  --primary-green-light: #A8C9B0;
  --primary-green-pale: #E8F2EB;
  --bg-white: #FFFFFF;
  --bg-light: #F8F9FA;
  --border-light: #E5E7EB;
  --text-base: #1F2937;
  --text-muted: #6B7280;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
}
```

> 上記は例。実プロジェクトでは `docs/design/DESIGN.md` で定義された変数のみ使用し、HEX値・独自ピクセル値の発明は厳禁。

---

## UIの美学（やってはいけないこと）

- **モザイク UI 禁止**: 全てを「影付きカード」で囲む構成。セクション・カラム・Divider で整理する。
- **アクセントカラーは1〜2系統に絞る**: 同一画面に3色以上のアクセントカラー（赤・青・緑・紫…）を混在させない。
- **`margin/padding` のハードコード禁止**: 必ずユーティリティクラスかコンポーネントクラスを使う。

---

## デザインルール（推奨パターン）

### ホバーエフェクト
- **`opacity: 0.8` のみのホバーは原則禁止**（フォーム要素・カード・インタラクティブUI）
- フォーム要素のホバー → `border-color` を `var(--primary-light)` に変更 + 背景を淡くする
- カードのホバー → 多層シャドウ + `transform: translateY(-1px);`
- ボタン系のみ `opacity` 変化を許容（推奨は `translateY` + シャドウ強化）

### シャドウ
- カード通常: `box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);`
- カードホバー: `box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06);`
- 汎用変数 `var(--shadow-sm)` / `var(--shadow-md)` も用意して使い分ける

### 入力フィールド
- ボーダー: `1.5px solid var(--border-light)`、角丸: `10px`
- 非フォーカス時の背景: `var(--bg-light)` → フォーカスで `var(--bg-white)` に切替
- フォーカスリング: `box-shadow: 0 0 0 3px rgba(<brand-color-rgb>, 0.15);`
- アクセシビリティ上 `outline: none` のみは禁止。代替のフォーカス可視化を必ず提供する。

### フォームヒント
- info青のような汎用ブルーは避け、ブランドカラー系で統一する：
  - `background: var(--primary-pale); border-left: 3px solid var(--primary-light);`

### ファイルアップロード
- 通常: `background: linear-gradient(135deg, var(--bg-light) 0%, var(--bg-white) 100%);`
- ホバー: `border-color: var(--primary-light); background: var(--primary-pale);`

---

## アクセシビリティ（WCAG 2.2 必須）

- タップ／クリック要素は **最低 24×24 CSSピクセル**。主要アクションは **44px 以上推奨**。
- 近接する要素間に十分な `gap` / `margin` を確保し、モバイルでの誤タップ（Fat-finger problem）を防止。
- フォーカス可視化（`:focus-visible`）を必ず提供し、`outline: none` 単独は禁止。
- カラーコントラスト比は最低 4.5:1（小さなテキスト）/ 3:1（大きなテキスト・UIコンポーネント）を確保する。
