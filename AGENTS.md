# AGENTS.md — Ringo-Shift-Creation

## 開始・再開

1. 共通原則は[Keystone CORE](https://github.com/shida-product/dev-keystone/blob/main/rules/CORE.md)を読む。`KEYSTONE_HOME/rules/CORE.md`（Windows配置例: `C:/dev/keystone/rules/CORE.md`）を解決し、配置がなければGitHub正本を読む。取得不能は報告し、必要な境界が不明な編集は止める。正本の読取とローカルhookの実動作を混同しない。
2. 固有の安全境界は[CLAUDE.md](CLAUDE.md)を確認する。 Windowsでは日本語読取前にUTF-8出力を設定し、読取もUTF-8を指定する。既読の同じ内容は再読しない。
3. `git rev-parse --show-toplevel`、`git status --short --branch`、`git worktree list`、`git diff --stat`、`git diff --cached --stat`で現物を確認する。dirty・untrackedを他者の成果として保全する。GitHubのみの場合は対象refと差分を確認し、PCのclean状態やworktreeは未確認と報告する。
4. 明示されたGoal / DoDを起点にする。汎用的な「再開」は最近のGit履歴・差分・実装／研究成果・採択済み決定から復元し、履歴だけを着手許可としない。復元できない意図・人間待ち・外部状態だけ[.agents/handover.md](.agents/handover.md)の該当箇所で補う。不明な次単位は依存編集前に確認する。
5. 作る前に`rg`等で既存の責務・呼出元・検査を探す。参照入口は[.agents/lessons.md](.agents/lessons.md)。仕様・教訓・workflowは作業に必要な箇所だけ取得し、下位ディレクトリのAGENTSと必須gateを確認する。安全条件を読取削減のために省かない。

## 検証・終了

- 既存の決定的な検査を優先し、変更の到達範囲・可逆性・損失に応じてレビューする。固有の必須gateとレビュー独立性を維持し、対象差分に対応する成功証拠だけを再利用する。不能・失敗・未実行をPASSにしない。
- fetch / CI照会は上流比較・統合・出荷・削除など実依存時に行う。単独の隔離作業でロック記録を常設しない。共有資源や同時編集がある場合は既存の調整手順に従い、経過時間だけで他者のロックを解除しない。
- 終了時は対象差分を確認し、意味が変わった判断・人間待ち・外部状態だけ既存記録へ反映する。読取のみ・変更なしの回に形式的なhandover更新やcommitを要求しない。Gitで復元できる状態の台帳や新しい管理frameworkを作らない。
- commit・push・公開・本番操作はユーザーの授権と固有のGit／デプロイ規則に従う。文書変更も自動デプロイを起こし得る。remote保存・通常branchへの適用・各端末の配置・runtime実証は分けて報告する。

## 固有の製品規則

CLAUDE.mdの製品概要・Danger Zone・作業別routingを保持する。開始・再開・終了条件はこのファイルを正本とし、固有の安全条件と実装gateは緩和しない。
