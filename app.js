"use strict";

// ==========================================
// 🎨 きゅるや Web アプリ（DOM 配線）
// 純粋なロジックは js/qr-core.js（QruyaCore）に分離し、ここは画面との接続だけを行う。
// ==========================================

const Core = window.QruyaCore;

// 🔤 日本語などを正しく符号化するため、UTF-8変換を使う
// （qrcode-generator 同梱ライブラリの機能）
if (typeof qrcode !== "undefined") {
  Core.useUtf8(qrcode);
}

// ==========================================
// 🧩 DOM
// ==========================================
const $ = (id) => document.getElementById(id);
const inputText = $("inputText");
const sizeSelect = $("sizeSelect");
const eclSelect = $("eclSelect");
const fgColor = $("fgColor");
const bgColor = $("bgColor");
const qrCanvas = $("qrCanvas");
const emptyMsg = $("emptyMsg");
const statusMsg = $("statusMsg");
const errorMsg = $("errorMsg");
const downloadBtn = $("downloadBtn");

let hasQr = false;

// ==========================================
// 🔳 QRコード描画
// ==========================================
// 🔳 生成済みマトリクスを Canvas に描く
function drawQr(matrix, size, fg, bg) {
  const { moduleCount, modules } = matrix;
  const layout = Core.computeLayout(size, moduleCount);

  qrCanvas.width = size;
  qrCanvas.height = size;
  const ctx = qrCanvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fg;
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules[row][col]) {
        ctx.fillRect(
          layout.offset + (col + Core.QUIET_ZONE) * layout.cell,
          layout.offset + (row + Core.QUIET_ZONE) * layout.cell,
          layout.cell,
          layout.cell
        );
      }
    }
  }
  return moduleCount;
}

// 🔳 プレビューを隠して空表示に戻す
function showEmpty() {
  hasQr = false;
  downloadBtn.disabled = true;
  qrCanvas.style.display = "none";
  emptyMsg.style.display = "";
}

// 🔳 入力から QRコードを生成・表示する
function generate() {
  const text = inputText.value;
  errorMsg.textContent = "";
  statusMsg.textContent = "";

  const kind = Core.classifyText(text);
  if (kind !== "ok") {
    showEmpty();
    // 💬 入力途中（完全に空）のときはエラーではなく案内だけにする
    if (kind === "blank") {
      errorMsg.textContent = Core.EMPTY_ERROR;
    }
    return;
  }

  let matrix;
  try {
    matrix = Core.generateMatrix(text, eclSelect.value, qrcode);
  } catch (e) {
    showEmpty();
    errorMsg.textContent = Core.TOO_LONG_ERROR;
    return;
  }

  const size = Core.parseSize(sizeSelect.value);
  const moduleCount = drawQr(matrix, size, fgColor.value, bgColor.value);
  hasQr = true;
  downloadBtn.disabled = false;
  qrCanvas.style.display = "inline-block";
  emptyMsg.style.display = "none";
  statusMsg.textContent = Core.statusText(size, moduleCount, eclSelect.value);
}

// 🔄 入力・設定変更でその場でプレビューを更新する
[inputText, sizeSelect, eclSelect, fgColor, bgColor].forEach((el) => {
  el.addEventListener("input", generate);
  el.addEventListener("change", generate);
});

$("generateBtn").addEventListener("click", () => {
  if (inputText.value.trim() === "") {
    errorMsg.textContent = Core.EMPTY_ERROR;
    inputText.focus();
    return;
  }
  generate();
});

// ==========================================
// 🎛️ プリセット
// ==========================================
$("urlPresetBtn").addEventListener("click", () => {
  inputText.value = Core.URL_SAMPLE;
  generate();
  inputText.focus();
});

$("mabusabaPresetBtn").addEventListener("click", () => {
  inputText.value = Core.MABUSABA_INVITE;
  generate();
});

$("clearBtn").addEventListener("click", () => {
  inputText.value = "";
  generate();
  inputText.focus();
});

// ==========================================
// 💾 PNGダウンロード
// ==========================================
downloadBtn.addEventListener("click", () => {
  if (!hasQr) return;
  qrCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = Core.DOWNLOAD_FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
});

// ==========================================
// 🌙 テーマ切り替え
// ==========================================
(function initTheme() {
  var root = document.documentElement;
  if (!root || !root.getAttribute || !root.setAttribute) return;
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
  }
  var current = root.getAttribute("data-theme");
  if (current !== "light" && current !== "dark") {
    try { current = localStorage.getItem(Core.THEME_KEY); } catch (e) { current = null; }
  }
  apply(current === "light" ? "light" : "dark");
  var btn = document.getElementById("themeToggle");
  if (btn && btn.addEventListener) {
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      try { localStorage.setItem(Core.THEME_KEY, next); } catch (e) { /* 保存できなくても切り替え自体は有効 */ }
    });
  }
})();

// ==========================================
// 🚀 初期化
// ==========================================
generate();
