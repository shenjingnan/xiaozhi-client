/// <reference types="vitest" />

import { vi as vitestVi } from 'vitest';

declare global {
  const vi: typeof vitestVi;
}

export {};