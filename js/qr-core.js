"use strict";

// ==========================================
// 🧩 きゅるや コアロジック（DOM 非依存）
// QR コード生成まわりの定数・検証・レイアウト計算・生成をまとめたモジュール。
// ブラウザではグローバル `QruyaCore`、Node では module.exports として使う。
// ==========================================

const QruyaCore = (() => {
  // ==========================================
  // 📏 定数
  // ==========================================
  const URL_SAMPLE = "https://example.com/";
  const MABUSABA_INVITE = "https://discord.gg/GKkW4wCAVp";
  const QUIET_ZONE = 4; // QRコード周囲の余白（モジュール数）

  const SIZES = [256, 512, 1024, 2048];
  const DEFAULT_SIZE = 512;
  const ECL_LEVELS = ["L", "M", "Q", "H"];
  const DEFAULT_ECL = "M";
  const DEFAULT_FG = "#000000";
  const DEFAULT_BG = "#ffffff";

  const DOWNLOAD_FILENAME = "qruya-qr.png";
  const THEME_KEY = "qruya-theme";

  const EMPTY_ERROR = "テキストを入力してください。";
  const TOO_LONG_ERROR =
    "入力が長すぎてQRコードに収まりません。文字を減らすか、誤り訂正レベルを下げてください。";

  // ==========================================
  // 🔍 入力の分類
  // ==========================================
  // "empty" = 完全に空（案内だけ表示し、エラーは出さない）
  // "blank" = 空白のみ（エラー表示の対象）
  // "ok"    = 生成できる
  function classifyText(text) {
    if (text === "") return "empty";
    if (text.trim() === "") return "blank";
    return "ok";
  }

  // ==========================================
  // 🎛️ 設定値のパース
  // ==========================================
  // セレクトの値を整数化する。読めなければ既定サイズに倒す（従来仕様）。
  function parseSize(value) {
    return Number.parseInt(value, 10) || DEFAULT_SIZE;
  }

  // ==========================================
  // 📐 描画レイアウト
  // ==========================================
  // クワイエットゾーン込みの総モジュール数・セルサイズ・描画幅・
  // 中央寄せオフセットを求める。セルサイズは整数へ切り捨てる。
  function computeLayout(size, moduleCount) {
    const total = moduleCount + QUIET_ZONE * 2;
    const cell = Math.floor(size / total);
    const drawn = cell * total;
    const offset = Math.floor((size - drawn) / 2);
    return { total, cell, drawn, offset };
  }

  // 💬 生成完了メッセージ（従来の文言どおり）
  function statusText(size, moduleCount, ecl) {
    return (
      "生成しました（" + size + " × " + size + " px、モジュール数 " + moduleCount +
      "、誤り訂正レベル " + ecl + "）。"
    );
  }

  // ==========================================
  // 🔳 QR コード生成（同梱ライブラリのラッパー）
  // ==========================================
  // 🔤 日本語などを正しく符号化するため、ライブラリの UTF-8 変換へ切り替える。
  function useUtf8(qrcodeLib) {
    if (
      qrcodeLib &&
      qrcodeLib.stringToBytesFuncs &&
      qrcodeLib.stringToBytesFuncs["UTF-8"]
    ) {
      qrcodeLib.stringToBytes = qrcodeLib.stringToBytesFuncs["UTF-8"];
      return true;
    }
    return false;
  }

  // 🔳 typeNumber 0 は自動選択（ライブラリが収まる最小の型番を探す）。
  // 収まらない場合はライブラリが例外を投げるので、呼び出し側で捕捉する。
  // 戻り値は { moduleCount, modules }（modules は boolean の二次元配列）。
  function generateMatrix(text, ecl, qrcodeLib) {
    const qr = qrcodeLib(0, ecl);
    qr.addData(text);
    qr.make();
    const moduleCount = qr.getModuleCount();
    const modules = [];
    for (let row = 0; row < moduleCount; row++) {
      const line = [];
      for (let col = 0; col < moduleCount; col++) {
        line.push(qr.isDark(row, col));
      }
      modules.push(line);
    }
    return { moduleCount, modules };
  }

  return {
    URL_SAMPLE,
    MABUSABA_INVITE,
    QUIET_ZONE,
    SIZES,
    DEFAULT_SIZE,
    ECL_LEVELS,
    DEFAULT_ECL,
    DEFAULT_FG,
    DEFAULT_BG,
    DOWNLOAD_FILENAME,
    THEME_KEY,
    EMPTY_ERROR,
    TOO_LONG_ERROR,
    classifyText,
    parseSize,
    computeLayout,
    statusText,
    useUtf8,
    generateMatrix,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = QruyaCore;
}
if (typeof globalThis !== "undefined") {
  globalThis.QruyaCore = QruyaCore;
}
