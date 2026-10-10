# Even G2 向けアプリ（予定）

Even Hub SDK 用のパッケージは、静的 `web/` ビューワとは **別ディレクトリ** で管理する。

## 方針

- [even-g2-3d-summary.md](../../../docs/even-g2-3d-summary.md) — スマホ側描画 → 画像転送
- 共通処理は `web/shared/`（MVT・座標・標高）を import して再利用する
- 同梱データは **`web/data/`**（行政界 + ビルド済み `mvt/`）をパッケージに含める
- SDK テンプレート: [evenhub-templates](https://github.com/even-realities/evenhub-templates)

## 検証順序（要約）

1. スマホ WebView で京都周辺の地形・土地利用を静止画化
2. Even G2 へ画像送信
3. 送信性能の実測
4. GPS / 方位連動

実装は Even Hub の推奨構成が確認でき次第、このディレクトリに最小アプリを追加する。
