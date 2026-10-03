/** اختبارات تنظيف إعدادات الشعار والهوية. */
import assert from "node:assert/strict";
import { DEFAULT_POSTER_SETTINGS, MAX_LOGO_LENGTH, isValidLogoDataUrl, normalizePosterSettings } from "./poster-settings";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const cases: Array<[string, () => void]> = [
  ["nothing stored gives the defaults (all three networks, 1800, no logo)", () => {
    assert.deepEqual(normalizePosterSettings(null), DEFAULT_POSTER_SETTINGS);
    assert.deepEqual(normalizePosterSettings(undefined), DEFAULT_POSTER_SETTINGS);
    assert.deepEqual(normalizePosterSettings("junk"), DEFAULT_POSTER_SETTINGS);
    assert.deepEqual(normalizePosterSettings({}), DEFAULT_POSTER_SETTINGS);
  }],
  ["a legacy branding object from the old template document is read as is", () => {
    assert.deepEqual(
      normalizePosterSettings({ logoDataUrl: PNG, handle: "  wafiyat  ", socials: ["x", "instagram"], maxHeight: 1620 }),
      { logoDataUrl: PNG, handle: "wafiyat", socials: ["instagram", "x"], maxHeight: 1620 },
    );
  }],
  ["an empty handle and no networks are respected (the user turned them off)", () => {
    const settings = normalizePosterSettings({ handle: "", socials: [] });
    assert.equal(settings.handle, "");
    assert.deepEqual(settings.socials, []);
  }],
  ["unknown networks and non-array socials are dropped or defaulted", () => {
    assert.deepEqual(normalizePosterSettings({ socials: ["tiktok", "snapchat", 5] }).socials, ["snapchat"]);
    assert.deepEqual(normalizePosterSettings({ socials: "x" }).socials, ["instagram", "snapchat", "x"]);
  }],
  ["max height is rounded and clamped to 1350..1800", () => {
    assert.equal(normalizePosterSettings({ maxHeight: 1000 }).maxHeight, 1350);
    assert.equal(normalizePosterSettings({ maxHeight: 99999 }).maxHeight, 1800);
    assert.equal(normalizePosterSettings({ maxHeight: 1500.4 }).maxHeight, 1500);
    assert.equal(normalizePosterSettings({ maxHeight: "abc" }).maxHeight, 1800);
  }],
  ["the logo must be a base64 PNG, JPEG or WebP data URL of a sane size", () => {
    assert.equal(isValidLogoDataUrl(PNG), true);
    assert.equal(isValidLogoDataUrl("data:image/jpeg;base64,/9j/4AAQ"), true);
    assert.equal(isValidLogoDataUrl("data:image/webp;base64,UklGRg=="), true);
    for (const bad of ["", "https://example.com/logo.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:text/html;base64,PGgxPg==", "data:image/png;base64,", "data:image/png;base64,abc def", "javascript:alert(1)", 5, null]) {
      assert.equal(isValidLogoDataUrl(bad), false, String(bad));
    }
    assert.equal(isValidLogoDataUrl(`data:image/png;base64,${"A".repeat(MAX_LOGO_LENGTH)}`), false, "too long");
    assert.equal(normalizePosterSettings({ logoDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }).logoDataUrl, "");
  }],
  ["the handle is capped at 60 characters", () => {
    assert.equal(normalizePosterSettings({ handle: "a".repeat(100) }).handle.length, 60);
  }],
];

let failed = 0;
for (const [name, test] of cases) {
  try { test(); console.log(`✓ ${name}`); } catch (error) { failed += 1; console.error(`✗ ${name}\n${error instanceof Error ? error.message : String(error)}`); }
}
if (failed) { console.error(`${failed} of ${cases.length} poster settings cases failed.`); process.exit(1); }
console.log(`Passed ${cases.length} poster settings cases.`);
