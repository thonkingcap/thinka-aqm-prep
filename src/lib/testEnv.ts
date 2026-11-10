// Shared settings for the tests that round-trip workbooks through openpyxl (standing in for Excel).
// THINKA_PYTHON: a Python with openpyxl installed (default: python3). THINKA_TMP: where test files go.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SCRATCH = process.env.THINKA_TMP ?? join(tmpdir(), "thinka-tests");
export const OUT = join(SCRATCH, "xlsx-check");
mkdirSync(OUT, { recursive: true });
export const PY = process.env.THINKA_PYTHON ?? "python3";

export const HAS_OPENPYXL = (() => {
  try { execFileSync(PY, ["-I", "-c", "import openpyxl"], { stdio: "ignore" }); return true; } catch { return false; }
})();
