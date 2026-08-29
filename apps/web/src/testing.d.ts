// Ambient types for jest-dom's expect() matchers (toBeInTheDocument, etc.)
// used in .test.tsx files. vitest.setup.ts imports the runtime half of this
// at the repo root, outside apps/web's tsconfig scope — this file gives
// `tsc --noEmit` (run from apps/web) the matching type augmentation.
/// <reference types="@testing-library/jest-dom" />
