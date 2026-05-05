---
description: フォーム処理・API・DBアクセスのセキュリティチェックリスト（汎用版）
---

# セキュリティチェックリスト

このドキュメントは、フレームワーク非依存の **セキュリティ実装の絶対ルール** をまとめたもの。
プロジェクトの言語・フレームワークに応じて、各項目を該当する実装関数（PHP/Node.js/Python/Go等）に読み替えること。

---

## 📌 絶対ルール（最優先）

1. **すべての入力は「悪意がある」前提で扱う**: ユーザー入力（POST/GET/Cookie/Header）、外部APIレスポンス、ファイル名、URL すべて。
2. **認証 ≠ 認可**: 「ログインしているか」だけでなく「**そのリソースを触る権限があるか**」を必ず別途チェックする。
3. **エスケープは出力先のコンテキストごとに使い分ける**: HTML / 属性値 / URL / JS / SQL でそれぞれ異なるエスケープ関数を使う。
4. **GETパラメータで状態変更しない**: DB書き込み・削除等の副作用を伴う操作は POST/PUT/DELETE にする（CSRF対策・誤クリック防止）。

---

## 1. CSRF / Nonce トークン検証

ステートフル（セッションベース）なフォーム処理では、必ずCSRFトークンを発行・検証する。

### フロントエンド（フォームへの埋め込み）
```html
<input type="hidden" name="csrf_token" value="{{ csrf_token }}">
```

### バックエンド（検証）
```
受信トークン === セッショントークン でなければ 403 で拒否
```

> **WordPress の場合:** `wp_nonce_field('action_name')` でフォームに埋め込み、`wp_verify_nonce($_POST['_wpnonce'], 'action_name')` で検証。Ajax は `check_ajax_referer('action_name', 'nonce')`。
>
> **Laravel/Rails 等の場合:** フレームワークのCSRFミドルウェアを **必ず有効** にしておき、`@csrf` / `csrf_meta_tags` 等のヘルパで埋め込む。

---

## 2. 入力バリデーション・サニタイズ

| 入力タイプ | 処理方針 |
|---|---|
| プレーンテキスト | HTMLタグ除去 + 文字数制限 + 想定外文字の排除 |
| HTML 許可テキスト | 許可タグのホワイトリスト方式（DOMPurify, `wp_kses_post` 等）。**本当に HTML が必要か** を先に検討する |
| メールアドレス | 専用バリデーション関数 + DNS確認（必要なら） |
| URL | スキームを `http/https` に限定。`javascript:` `data:` を排除 |
| 整数・数値 | 型キャスト（`intval`, `parseInt` 等） + 範囲チェック |
| 配列 | 各要素に対して個別にバリデーションを適用 |
| ファイル名 | パストラバーサル防止（`../` を排除）、拡張子ホワイトリスト、MIME検証 |
| 色コード | `^#[0-9A-Fa-f]{6}$` 等の正規表現チェック |

### コード例（PHP / WordPress）
```php
$name  = sanitize_text_field( $_POST['name'] ?? '' );
$email = sanitize_email( $_POST['email'] ?? '' );
$url   = esc_url_raw( $_POST['url'] ?? '' );
$age   = absint( $_POST['age'] ?? 0 );
$tags  = array_map( 'sanitize_text_field', (array)( $_POST['tags'] ?? [] ) );
```

### コード例（Node.js / Express + zod）
```javascript
const schema = z.object({
  name:  z.string().min(1).max(100),
  email: z.string().email(),
  url:   z.string().url().refine(u => /^https?:/.test(u)),
  age:   z.number().int().min(0).max(150),
});
const data = schema.parse(req.body);
```

---

## 3. 権限・認可チェック（Authorization）

```
1. 認証チェック（ログインしているか）
2. ロール/権限チェック（操作する権限があるか）
3. 所有権チェック（自分のリソースか・他人のリソースを書き換えていないか）
```

### コード例（汎用）
```php
// 1. ログインチェック
if ( ! is_authenticated() ) {
    abort( 401, 'Unauthorized' );
}

// 2. ロール/権限チェック
if ( ! current_user_can( 'edit_posts' ) ) {
    abort( 403, 'Forbidden' );
}

// 3. 所有権チェック
if ( (int) $resource->owner_id !== current_user_id() ) {
    abort( 403, 'Forbidden' );
}
```

> ⚠️ **頻出ミス:** ログインチェックだけして所有権チェックを忘れる → 他人のリソースを ID 直打ちで書き換えられる脆弱性。**必ず3層全部** チェックする。

---

## 4. 出力エスケープ（XSS対策）

| コンテキスト | エスケープ関数（例） |
|---|---|
| HTML内テキスト | `esc_html()` (PHP) / `htmlspecialchars()` (PHP) / `{{ }}` (Vue/React の標準補間) |
| HTML属性値 | `esc_attr()` (PHP) / 同上 |
| URL（href等） | `esc_url()` (PHP) / `encodeURI()` (JS) |
| JavaScript内 | `esc_js()` (PHP) / **JSONエンコード経由が安全**（`wp_json_encode()` / `JSON.stringify()`） |
| JSON出力 | `wp_json_encode()` (PHP) / `JSON.stringify()` (JS) ※ PHP の `json_encode()` は `_` フラグなしだとXSS脆弱なので `wp_json_encode` 推奨 |

### React / Vue 等のテンプレート
- 標準補間（`{value}` / `{{ value }}`）は **自動でエスケープされる**。
- `dangerouslySetInnerHTML` / `v-html` は **絶対禁止に近い**。使う場合は DOMPurify 等で必ずサニタイズする。

---

## 5. SQLインジェクション対策

**プリペアドステートメント以外の方法で SQL を組み立てない。** 文字列結合は禁止。

### コード例

**✅ 正しい（PDO / mysqli）**
```php
$stmt = $pdo->prepare( "SELECT * FROM users WHERE id = ?" );
$stmt->execute( [ $user_id ] );
```

**✅ 正しい（WordPress）**
```php
$wpdb->prepare( "SELECT * FROM {$wpdb->users} WHERE ID = %d", $user_id );
```

**❌ 禁止（文字列結合）**
```php
$sql = "SELECT * FROM users WHERE id = " . $_GET['id']; // SQL Injection
```

### ORM 使用時
- Eloquent / Prisma / Sequelize 等の ORM はクエリビルダ経由で安全。**ただし `whereRaw()` `$queryRaw` 等のエスケープハッチで生 SQL を書く場合は手動でプレースホルダーを使う。**

---

## 6. AJAX / API エンドポイントの追加チェック

```
1. CSRF トークン検証（または認証済みクッキー + Origin ヘッダ確認）
2. レート制限（連打・スクレイピング対策）
3. レスポンスは構造化（JSON）し、エラー詳細を漏らさない
4. CORS 設定は必要最小限のオリジンのみ許可
```

### コード例（WordPress AJAX）
```php
add_action( 'wp_ajax_my_action', function() {
    check_ajax_referer( 'my_action', 'nonce' );
    if ( ! current_user_can( 'edit_posts' ) ) {
        wp_send_json_error( '権限がありません', 403 );
    }
    // 処理
    wp_send_json_success( $data );
} );
```

### REST Client 検証
- API/Ajax を実装したら、`.http` ファイル（VS Code REST Client用）に **正常系・エラー系両方** のリクエストを記述する。
- nonce 切れ・権限なし・サニタイズ漏れチェック等のエラー系を網羅する。

---

## 7. GETパラメータ処理

- `$_GET` は表示の切り替えや検索条件にのみ使用。**状態変更（DB書き込み・削除）には使わない**。
- 想定値はホワイトリスト方式で許可リストを用意し、想定外の値はデフォルトにフォールバック：

```php
$allowed_views = ['dashboard', 'bookings', 'schedule'];
$view = sanitize_text_field( $_GET['view'] ?? 'dashboard' );
if ( ! in_array( $view, $allowed_views, true ) ) {
    $view = 'dashboard';
}
```

---

## 8. ファイルアップロード

- 拡張子だけでなく **MIME タイプ・マジックバイト** で検証する（拡張子偽装対策）。
- アップロード先ディレクトリは Web 公開ディレクトリ外、または実行権限を剥奪した場所に保存する。
- 保存ファイル名はランダム化し、ユーザー入力をそのまま使わない。
- 画像は再エンコード（GD / ImageMagick）してメタデータ・埋め込みスクリプトを除去する。

---

## 9. 機密情報の取り扱い

- **絶対にコミットしない**: `.env`, `wp-config.php`, `secrets.json`, 秘密鍵, APIトークン
- `.gitignore` で除外設定 + Git Hooks（pre-commit）でリーク防止
- ログ出力時にマスキング（パスワード・カード番号・トークンを `***` に）
- エラーメッセージにスタックトレースや SQL クエリを含めない（本番環境）

---

## 10. セッション管理

- セッションIDは認証成功時に **必ず再生成**（`session_regenerate_id()` / フレームワーク同等機能）
- HTTPS 必須環境では Cookie に `Secure` `HttpOnly` `SameSite=Lax`（または `Strict`）を付与
- ログアウト時にセッションを完全に破棄

---

## 自己チェック（PR提出前）

- [ ] CSRF / Nonce 検証は **すべての** state-changing エンドポイントに入っているか
- [ ] 認証 + 認可 + 所有権の3層チェックがあるか
- [ ] 入力サニタイズが各フィールドに適用されているか
- [ ] 出力エスケープがコンテキストごとに正しいか（HTML / 属性 / URL / JS）
- [ ] SQL は全てプリペアドステートメントか
- [ ] エラーメッセージで内部情報（SQL・パス・スタック）を漏らしていないか
- [ ] `.env` / `wp-config.php` / 秘密鍵をコミットしていないか
- [ ] REST Client の `.http` で正常系・エラー系を検証したか
