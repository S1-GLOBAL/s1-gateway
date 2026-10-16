import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals are off, so Testing Library cannot register this itself.
afterEach(() => cleanup());

// A lazily loaded page and a retried request can both take longer than the 1s default on a busy machine.
configure({ asyncUtilTimeout: 3000 });