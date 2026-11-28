# 📜 更新履歴

更新履歴はこのファイルに記録します。

## v1.0.0（2026-11-28）

### 追加

- コアロジック（`js/qr-core.js`）の単体テストを追加（生成結果のゴールデン検証を含む、22件）。
- CI に手動実行（workflow_dispatch）と単体テストのステップを追加。

### 変更

- 統一開発フローに合わせてリポジトリをゼロから再作成し、バージョンを 1.0.0 にリセット。
- ロジックを DOM 非依存のコア（`js/qr-core.js`）と DOM 配線（`app.js`）に分離（挙動・保存形式は従来どおり）。
- Service Worker のキャッシュ名を qruya-v1 にリセット（旧実装は qruya-v3）。
- Windows 版の exe は Release に添付せず、ビルドスクリプト（`windows/build.bat` / `windows/build.sh`）で生成する形に変更。
- README のテーマ説明を実装どおり（手動トグル）に是正。

### 維持

- QR 生成方式（同梱 qrcode-generator 1.4.4、型番自動選択、UTF-8 符号化）、設定項目と既定値、描画方式（クワイエットゾーン4モジュール・中央寄せ）、ダウンロードファイル名 `qruya-qr.png`、エラーメッセージ、テーマ保存キー `qruya-theme` はすべて従来どおり。
- Windows 版（.NET 8 / WinForms、QRCoder 1.6.0）も同じ仕様で再実装。
