"use strict";

// ==========================================
// 🧪 きゅるや コアロジックのテスト
// 定数・入力検証・レイアウト計算と、同梱ライブラリを使った実際の生成結果
// （モジュール数・暗モジュール数・ファインダパターン等）を固定する。
// 生成の期待値は旧実装の同梱ライブラリ出力から採取したゴールデン値。
// ==========================================

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Core = require("../js/qr-core.js");

// 📚 同梱ライブラリ（qrcode-generator 1.4.4）を Node 上で読み込む
function loadLib() {
  const src = fs.readFileSync(path.join(__dirname, "..", "lib", "qrcode.js"), "utf8");
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.qrcode;
}
const qrcodeLib = loadLib();
Core.useUtf8(qrcodeLib);

function darkCount(matrix) {
  let n = 0;
  for (const row of matrix.modules) for (const cell of row) if (cell) n++;
  return n;
}

// ==========================================
// 📏 定数
// ==========================================
test("constants match the production spec", () => {
  assert.equal(Core.URL_SAMPLE, "https://example.com/");
  assert.equal(Core.MABUSABA_INVITE, "https://discord.gg/GKkW4wCAVp");
  assert.equal(Core.QUIET_ZONE, 4);
  assert.deepEqual(Core.SIZES, [256, 512, 1024, 2048]);
  assert.equal(Core.DEFAULT_SIZE, 512);
  assert.deepEqual(Core.ECL_LEVELS, ["L", "M", "Q", "H"]);
  assert.equal(Core.DEFAULT_ECL, "M");
  assert.equal(Core.DEFAULT_FG, "#000000");
  assert.equal(Core.DEFAULT_BG, "#ffffff");
  assert.equal(Core.DOWNLOAD_FILENAME, "qruya-qr.png");
  assert.equal(Core.THEME_KEY, "qruya-theme");
  assert.equal(Core.EMPTY_ERROR, "テキストを入力してください。");
  assert.equal(
    Core.TOO_LONG_ERROR,
    "入力が長すぎてQRコードに収まりません。文字を減らすか、誤り訂正レベルを下げてください。"
  );
});

// ==========================================
// 🔍 入力の分類
// ==========================================
test("classifyText distinguishes empty, blank and ok", () => {
  assert.equal(Core.classifyText(""), "empty");
  assert.equal(Core.classifyText("   "), "blank");
  assert.equal(Core.classifyText("　"), "blank"); // 全角スペースも trim される
  assert.equal(Core.classifyText(" \n\t "), "blank");
  assert.equal(Core.classifyText("a"), "ok");
  assert.equal(Core.classifyText(" a "), "ok");
  assert.equal(Core.classifyText("https://example.com/"), "ok");
});

// ==========================================
// 🎛️ サイズのパース
// ==========================================
test("parseSize parses select values and falls back to 512", () => {
  assert.equal(Core.parseSize("256"), 256);
  assert.equal(Core.parseSize("512"), 512);
  assert.equal(Core.parseSize("1024"), 1024);
  assert.equal(Core.parseSize("2048"), 2048);
  assert.equal(Core.parseSize(""), 512);
  assert.equal(Core.parseSize("abc"), 512);
  assert.equal(Core.parseSize(undefined), 512);
});

// ==========================================
// 📐 レイアウト計算
// ==========================================
test("computeLayout floors the cell size and centers the drawing", () => {
  // 512px / 21モジュール（+余白8 = 29）→ cell 17, drawn 493, offset 9
  assert.deepEqual(Core.computeLayout(512, 21), { total: 29, cell: 17, drawn: 493, offset: 9 });
  // 256px / 25モジュール（+8 = 33）→ cell 7, drawn 231, offset 12
  assert.deepEqual(Core.computeLayout(256, 25), { total: 33, cell: 7, drawn: 231, offset: 12 });
  // 1024px / 29モジュール（+8 = 37）→ cell 27, drawn 999, offset 12
  assert.deepEqual(Core.computeLayout(1024, 29), { total: 37, cell: 27, drawn: 999, offset: 12 });
  // 2048px / 177モジュール（最大型番40, +8 = 185）→ cell 11, drawn 2035, offset 6
  assert.deepEqual(Core.computeLayout(2048, 177), { total: 185, cell: 11, drawn: 2035, offset: 6 });
  // 割り切れるケースではオフセット 0
  assert.deepEqual(Core.computeLayout(290, 21), { total: 29, cell: 10, drawn: 290, offset: 0 });
});

test("statusText formats the completion message", () => {
  assert.equal(
    Core.statusText(512, 25, "M"),
    "生成しました（512 × 512 px、モジュール数 25、誤り訂正レベル M）。"
  );
  assert.equal(
    Core.statusText(2048, 29, "H"),
    "生成しました（2048 × 2048 px、モジュール数 29、誤り訂正レベル H）。"
  );
});

// ==========================================
// 🔳 実際の QR 生成（ゴールデン値）
// ==========================================
const GOLDEN = [
  // [text, ecl, moduleCount, darkCount]
  ["https://example.com/", "L", 25, 334],
  ["https://example.com/", "M", 25, 340],
  ["https://example.com/", "Q", 25, 336],
  ["https://example.com/", "H", 29, 415],
  ["https://discord.gg/GKkW4wCAVp", "M", 29, 422],
  ["きゅるや", "M", 21, 232],
  ["HELLO WORLD", "Q", 21, 214],
  ["12345", "L", 21, 232],
];

for (const [text, ecl, moduleCount, dark] of GOLDEN) {
  test(`generateMatrix golden: ${JSON.stringify(text)} @ ${ecl}`, () => {
    const matrix = Core.generateMatrix(text, ecl, qrcodeLib);
    assert.equal(matrix.moduleCount, moduleCount);
    assert.equal(matrix.modules.length, moduleCount);
    assert.ok(matrix.modules.every((row) => row.length === moduleCount));
    assert.equal(darkCount(matrix), dark);
  });
}

test("finder patterns and timing patterns are placed correctly", () => {
  const { modules } = Core.generateMatrix("https://example.com/", "M", qrcodeLib);
  // 左上ファインダ: 外周は暗、1マス内側は明、中心 3x3 は暗
  assert.equal(modules[0][0], true);
  assert.equal(modules[0][6], true);
  assert.equal(modules[6][0], true);
  assert.equal(modules[1][1], false);
  assert.equal(modules[2][2], true);
  assert.equal(modules[3][3], true);
  // セパレータ（ファインダ周囲の余白）は明
  assert.equal(modules[7][0], false);
  assert.equal(modules[0][7], false);
  // 右上・左下の角も暗（ファインダの外周）
  const mc = modules.length;
  assert.equal(modules[0][mc - 1], true);
  assert.equal(modules[mc - 1][0], true);
  // タイミングパターン（6行目・6列目）は交互
  assert.equal(modules[6][8], true);
  assert.equal(modules[6][9], false);
  assert.equal(modules[6][10], true);
  assert.equal(modules[8][6], true);
  assert.equal(modules[9][6], false);
});

test("generation is deterministic", () => {
  const a = Core.generateMatrix("https://example.com/", "M", qrcodeLib);
  const b = Core.generateMatrix("https://example.com/", "M", qrcodeLib);
  assert.deepEqual(a, b);
});

test("different error correction levels give different patterns", () => {
  const l = Core.generateMatrix("https://example.com/", "L", qrcodeLib);
  const m = Core.generateMatrix("https://example.com/", "M", qrcodeLib);
  assert.notDeepEqual(l.modules, m.modules);
});

test("japanese text is encoded as UTF-8 and fits in version 1 at M", () => {
  const matrix = Core.generateMatrix("きゅるや", "M", qrcodeLib);
  assert.equal(matrix.moduleCount, 21);
});

test("overlong input throws (the app shows the too-long error)", () => {
  assert.throws(() => Core.generateMatrix("a".repeat(3000), "H", qrcodeLib));
  assert.throws(() => Core.generateMatrix("あ".repeat(2000), "H", qrcodeLib));
});

test("useUtf8 reports whether the UTF-8 byte function was available", () => {
  const lib2 = loadLib();
  assert.equal(Core.useUtf8(lib2), true);
  assert.equal(Core.useUtf8(null), false);
  assert.equal(Core.useUtf8({}), false);
});

// ==========================================
// 📦 配信ファイルの整合性
// ==========================================
test("service worker precaches the shell including the core module and the QR library", () => {
  const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  for (const asset of [
    "./index.html",
    "./style.css",
    "./app.js",
    "./js/qr-core.js",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./lib/qrcode.js",
  ]) {
    assert.ok(sw.includes(`"${asset}"`), `sw.js must precache ${asset}`);
  }
  assert.ok(sw.includes('CACHE_NAME = "qruya-v1"'));
});

test("index.html loads the library, the core module and the app in order", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const libIdx = html.indexOf("lib/qrcode.js");
  const coreIdx = html.indexOf("js/qr-core.js");
  const appIdx = html.indexOf("app.js");
  assert.ok(libIdx !== -1 && coreIdx !== -1 && appIdx !== -1);
  assert.ok(libIdx < coreIdx && coreIdx < appIdx);
  // テーマの保存キーは従来どおり
  assert.ok(html.includes('localStorage.getItem("qruya-theme")'));
});

test("manifest keeps the production values", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "manifest.webmanifest"), "utf8")
  );
  assert.equal(manifest.name, "きゅるや｜QRコードメーカー");
  assert.equal(manifest.short_name, "きゅるや");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./index.html");
  assert.deepEqual(
    manifest.icons.map((i) => i.src),
    ["icons/icon-192.png", "icons/icon-512.png"]
  );
});
