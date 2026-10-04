/**
 * اختبارات قصّ الفراغ الشفاف حول الشعار (الدالة النقية alphaBounds، بلا Canvas).
 */
import assert from "node:assert/strict";
import { alphaBounds } from "./logo-image";

/** صورة RGBA بعرض وارتفاع معطيين، شفافة إلا البكسلات المذكورة بشفافيتها. */
function rgba(width: number, height: number, opaque: Array<[x: number, y: number, alpha: number]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y, alpha] of opaque) data[(y * width + x) * 4 + 3] = alpha;
  return data;
}

const cases: Array<[string, () => void]> = [
  ["finds the visible box inside a transparent margin", () => {
    assert.deepEqual(alphaBounds(rgba(10, 8, [[3, 2, 255], [6, 5, 255], [4, 4, 120]]), 10, 8), { x: 3, y: 2, width: 4, height: 4 });
  }],
  ["ignores nearly transparent pixels (soft halo, noise)", () => {
    assert.deepEqual(alphaBounds(rgba(10, 10, [[0, 0, 5], [9, 9, 8], [5, 5, 255]]), 10, 10), { x: 5, y: 5, width: 1, height: 1 });
  }],
  ["keeps a fully opaque image whole", () => {
    const data = new Uint8ClampedArray(4 * 3 * 4).fill(255);
    assert.deepEqual(alphaBounds(data, 4, 3), { x: 0, y: 0, width: 4, height: 3 });
  }],
  ["returns null for a fully transparent image", () => {
    assert.equal(alphaBounds(rgba(5, 5, []), 5, 5), null);
  }],
];

let failed = 0;
for (const [name, test] of cases) {
  try {
    test();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}\n${error instanceof Error ? error.message : String(error)}`);
  }
}
if (failed) {
  console.error(`${failed} of ${cases.length} logo image cases failed.`);
  process.exit(1);
}
console.log(`Passed ${cases.length} logo image cases.`);
