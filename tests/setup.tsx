import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

// jsdom implements neither of these, and the message list depends on both.
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}

class IntersectionObserverStub {
	root = null;
	rootMargin = '';
	thresholds = [];
	observe() {}
	unobserve() {}
	disconnect() {}
	takeRecords() {
		return [];
	}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);

Element.prototype.scrollIntoView = vi.fn();
