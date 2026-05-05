---
description: ターミナル実行時のエンコーディングルール（Windows環境での日本語文字化け防止）
---

# ターミナル エンコーディングルール

Windows PowerShell 環境で日本語出力が文字化け（mojibake）するのを防ぐため、および日本語を含むファイル操作で破壊的事故を起こさないためのルール。

## 🔴 絶対 NG（最優先ルール）

**Windows + PowerShell でのファイル部分置換に `Get-Content` / `Set-Content` / `>` リダイレクトを使わない。**

これらはエンコーディング指定が不十分だと UTF-8 の日本語を文字化け（BOM混入・UTF-16LE化等）させ、ソースコードを破壊する。代わりに：

- AI 専用の編集ツール（`Edit` / `Write` 等）を使う
- どうしてもスクリプトが必要なら Node.js (`fs.readFileSync(path, 'utf8')`) を使う

詳細・事故事例は `.agents/lessons/encoding.md` 参照。

---

## 必須: 日本語出力コマンド実行時の前処理

日本語を含む出力が想定されるコマンド（`git log`, `git diff`, `git show`, `git branch` など）を実行する際は、以下のいずれかの方法で UTF-8 出力を保証すること。

### 方法1: ファイル経由で読み取る（推奨）

PowerShell の `>` リダイレクトは UTF-16LE で出力されるため、後続のツールで読めなくなる。`[System.IO.File]::WriteAllText()` を使って明示的に UTF-8 で書き出してから読む。

```powershell
# UTF-8でファイルに書き出してから Read で読む
[System.IO.File]::WriteAllText("C:\path\to\output.txt", (git log -5 --format="%h %s" | Out-String), [System.Text.Encoding]::UTF8)
```

### 方法2: OutputEncoding を事前設定

```powershell
# セッション冒頭で一度だけ実行
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
```

セッション中に永続的に効くが、設定し忘れると個別コマンドで方法1に戻る必要がある。

---

## 適用対象のコマンド例

- `git log` / `git show` / `git diff` （コミットメッセージに日本語を含む）
- `git branch` （ブランチ名に日本語を含む可能性）
- `Get-Content` で日本語ファイルを読む場合
- 日本語を含むファイル名の `ls` / `Get-ChildItem`
- その他、日本語出力を伴う全コマンド

## 注意事項

- PowerShell のリダイレクト（`>`）は UTF-16LE で出力されるため、後続ツールで読めない場合がある。`[System.IO.File]::WriteAllText()` を使うこと。
- 一時ファイルは `/tmp/` または作業ディレクトリ直下に作成し、使用後は必ず削除する。
- CSS/JS の **末尾に日本語コメント** を追記する場合、1バイトの不正混入で以降のルールが全滅するリスクがある。重要度の低いコメントは ASCII にするか、安全確認後の二段階コミットで添えること（事故事例: `.agents/lessons/encoding.md`）。
