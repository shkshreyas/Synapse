// Test setup file for vitest
import { vi } from 'vitest';

// Mock Chrome APIs
global.chrome = {
    runtime: {
        sendMessage: vi.fn(),
        onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn()
        }
    },
    tabs: {
        query: vi.fn(),
        sendMessage: vi.fn()
    },
    storage: {
        local: {
            get: vi.fn(),
            set: vi.fn(),
            remove: vi.fn()
        }
    }
} as any;

// Mock window.location
Object.defineProperty(window, 'location', {
    value: {
        href: 'https://example.com',
        origin: 'https://example.com',
        hostname: 'example.com',
        pathname: '/'
    },
    writable: true
});

// Mock performance
Object.defineProperty(window, 'performance', {
    value: {
        now: vi.fn(() => 1000)
    },
    writable: true
});

// Mock IndexedDB
import 'fake-indexeddb/auto';

// Mock navigator.storage
Object.defineProperty(navigator, 'storage', {
    value: {
        estimate: vi.fn().mockResolvedValue({
            usage: 1024 * 1024, // 1MB
            quota: 100 * 1024 * 1024 // 100MB
        })
    },
    writable: true
});