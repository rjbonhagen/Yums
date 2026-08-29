import "@testing-library/jest-dom/vitest"
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

// @testing-library/react's auto-cleanup only registers itself when it
// detects global test hooks (vitest's `globals: true`, which this repo
// doesn't enable) — without this, each test's render() output stays in
// the document, so later tests in the same file see duplicate elements
// from earlier tests.
afterEach(() => {
  cleanup()
})
