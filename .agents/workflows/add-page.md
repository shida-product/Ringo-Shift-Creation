---
description: 新規ページ・ビュー追加の汎用手順（フレームワーク非依存）
---

# 新規ページ・ビュー追加手順

このドキュメントは **フレームワーク非依存** の汎用手順。実プロジェクトの構成（Next.js / Laravel / WordPress 等）に応じて、各ステップの「どのファイルを触るか」を読み替えること。

---

## 1. テンプレート・コンポーネント作成

`[views_dir]/` または該当のコンポーネントディレクトリに新規ファイルを作成する。

### 雛形（フレームワーク別）

**Next.js (App Router):**
```tsx
// app/[route]/page.tsx
export default function NewPage() {
  return (
    <div className="page-content">
      <header className="page-header">
        <h1>ページタイトル</h1>
      </header>
      {/* コンテンツ */}
    </div>
  );
}
```

**Laravel Blade:**
```php
{{-- resources/views/[name].blade.php --}}
@extends('layouts.app')
@section('content')
<div class="page-content">
  <h1>ページタイトル</h1>
  {{-- コンテンツ --}}
</div>
@endsection
```

**WordPress テンプレート:**
```php
<?php
if ( ! defined('ABSPATH') ) exit;
get_header(); ?>
<div class="page-content">
  <h1><?php echo esc_html( get_the_title() ); ?></h1>
  <?php // コンテンツ ?>
</div>
<?php get_footer();
```

**素のHTML（SSG / 静的サイト等）:**
```html
<div class="[prefix]-page-content">
  <header class="[prefix]-section-header">
    <h2>ページタイトル</h2>
    <a href="/" class="btn btn-outline btn-sm">← 戻る</a>
  </header>
  <!-- コンテンツ -->
</div>
```

---

## 2. ルーティング登録

| フレームワーク | 登録方法 |
|---|---|
| Next.js (App Router) | `app/[route]/page.tsx` ファイル配置でファイルベースルーティング |
| Next.js (Pages Router) | `pages/[route].tsx` ファイル配置 |
| Laravel | `routes/web.php` に `Route::get()` 追加 |
| Express | `app.get('/path', handler)` 登録 |
| WordPress | `page-{slug}.php` テンプレート / `add_rewrite_rule()` |

---

## 3. ナビゲーション・サイドバーへのリンク追加

全体のナビゲーション（ヘッダー・サイドバー・フッター）を担当する共通コンポーネント／テンプレートに、新規ページへのリンクを追加する。

```html
<!-- 例: 共通サイドバー -->
<nav class="sidebar">
  <a href="/dashboard" class="sidebar-link">ダッシュボード</a>
  <a href="/new-page" class="sidebar-link">新規ページ</a>
</nav>
```

> **注意**: アクティブ状態の表示（`.is-active` 等）も同時に実装する。

---

## 4. CSS の追加

- ユーティリティクラスは共通の `[design-system].css` を使用
- ページ固有のスタイルが必要な場合は専用ファイル（`[page-name].css`）を作成し、エントリーポイント（`main.css` 等）から **必ず import** する
- **インラインスタイル禁止**（動的値・JS制御を除く）

> 詳細は `.agents/workflows/css-conventions.md`。

---

## 5. API通信・バックエンド処理の実装

- フロント側: 非同期リクエスト（fetch / axios / Server Action 等）を新規実装
- バックエンド側: `[controllers_dir]/` または該当のハンドラに **エンドポイント** を登録
- ビジネスロジックは **必ず Service / Use Case / Repository を経由**。直接 DB アクセスをコントローラに書かない（責務分離）

```typescript
// 例: Next.js Server Action
'use server';
export async function createItem(data: ItemInput) {
  const validated = itemSchema.parse(data);    // 1. バリデーション
  await requireAuth();                          // 2. 認証
  await assertOwnership(validated.parentId);    // 3. 認可
  return itemService.create(validated);         // 4. ビジネスロジックは Service 層
}
```

---

## 6. セキュリティ実装

新規ページが認証必須・フォーム送信を伴う場合、`.agents/workflows/security-checklist.md` を **必ず** 参照すること。

主要チェック項目：
- ログインチェック（未認証時のリダイレクト）
- CSRF / Nonce トークン検証（POST/PUT/DELETE）
- 入力サニタイズ・バリデーション
- 出力エスケープ（XSS対策）
- 認可（所有権チェック含む）

---

## 7. テスト

- **API/Ajax を実装した場合**: `.http` ファイル（VS Code REST Client用）に正常系・エラー系両方のリクエストを記述
- **画面の挙動**: ローカルで動作確認。AI 自身による自動ブラウザ操作は禁止、ユーザーへ確認依頼

---

## 8. チェックリスト（PR提出前）

- [ ] アクセス権限・ログインチェックは適切に入っているか
- [ ] Service/Repository を経由した疎結合な実装になっているか
- [ ] CSRF / Nonce 検証あり（POST/PUT/DELETE）
- [ ] サニタイズ・バリデーションあり（コントローラ／API ハンドラ層）
- [ ] エスケープ出力あり（XSS対策）
- [ ] CSS は既存ユーティリティ／共通クラスを優先しているか（インラインスタイル禁止）
- [ ] 共通コンポーネント（ヘッダー・フッター・ボタン）を再利用しているか
- [ ] 新規 CSS ファイルがエントリーポイントから import されているか
- [ ] レスポンシブ対応（モバイル ≤ 768px）が崩れていないか
- [ ] アクセシビリティ: タップ要素 24×24px以上、フォーカス可視化あり
