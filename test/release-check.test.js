import test from "node:test"
import assert from "node:assert/strict"
import { validateRelease } from "../scripts/release-check.mjs"

const changelog = "# Changelog\n\n## [0.2.0] - 2026-09-20\n\n### Added\n\n- Visual settings.\n"

test("release check accepts a matching dated SemVer release", () => {
  assert.deepEqual(validateRelease("v0.2.0", "0.2.0", changelog), { tag: "v0.2.0", version: "0.2.0", date: "2026-09-20" })
})

test("release check rejects a tag that does not match package version", () => {
  assert.throws(() => validateRelease("v0.3.0", "0.2.0", changelog), /does not match/iu)
})

test("release check rejects an unreleased changelog entry", () => {
  assert.throws(() => validateRelease("v0.2.0", "0.2.0", changelog.replace("2026-09-20", "Unreleased")), /dated entry/iu)
})
