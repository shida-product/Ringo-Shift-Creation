---
description: 本番デプロイ手順（GitHub Pages / Vercel 経由）
---

# デプロイ手順

本プロジェクトは **GitHub Pages または Vercel** へのデプロイを想定している（未設定）。
静的HTMLのため、CI/CDパイプラインの設定は比較的シンプル。

---

## 📌 絶対ルール

1. **`main` への直接 push を避ける**: 機能ブランチで作成 → 動作確認 → merge の流れを基本とする
2. **大規模変更前にバックアップブランチ**: DB変更・アルゴリズム大改修の前に `backup/<date>` ブランチを作成
3. **ロールバック計画**: 致命的バグ混入時は速やかに `git revert` で直前コミットを取り消し、再 push でロールバック
4. **`js/supabase-config.js` は絶対にコミットしない**: `.gitignore` で除外済みであることを毎回確認

---

## 基本フロー（ローカル → GitHub → 本番）

### 1. 変更確認とローカル検証

```bash
git status
git diff --stat
```

ローカルで以下を確認：
- 主要画面が動作するか（手動確認）
- `js/supabase-config.js` がコミット対象に含まれていないか

### 2. コミット

```bash
git add <変更ファイル>
git commit -m "feat(generate): りんごちゃん薬局スタッフ定義を更新"
```

### 3. デプロイ

```bash
git push origin main
```

**GitHub Pages の場合**: Settings → Pages → ソースを `main` ブランチに設定
**Vercel の場合**: GitHub リポジトリ連携後、`main` push で自動デプロイ

---

## デプロイ後の確認

1. **ヘルスチェック**: 本番URL に直接アクセスし、3画面（希望休収集・シフト生成・管理）が動作するか
2. **Supabase接続確認**: ブラウザのコンソールでエラーが出ていないか

---

## トラブルシューティング

### デプロイが反映されない
1. GitHub リポジトリの **[Actions]** タブ（または Vercel ダッシュボード）でビルドログを確認
2. `supabase-config.js` が missing でエラーになっていないか確認（静的サイトでは実行時エラー）

### 致命的バグが本番に混入した

```bash
# 直前のコミットを打ち消すコミットを作成
git revert HEAD
git push origin main
```

---

## 緊急時の手動確認

- `.gitignore` に `js/supabase-config.js` が含まれているか確認：
  ```bash
  git check-ignore -v js/supabase-config.js
  ```

> ⚠️ `git push --force` 等の破壊的操作は、**実行前に必ずユーザーへバックアップブランチ作成を提案し、合意を得てから** 実行する。
