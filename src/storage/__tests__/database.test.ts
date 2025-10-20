// Basic database tests

import { describe, it, expect, beforeAll } from 'vitest';
import { getDatabase, MindScribeDatabase } from '../database';

describe('Database', () => {
    let db: MindScribeDatabase;

    beforeAll(async () => {
        db = await getDatabase();
    });

    it('should initialize database successfully', async () => {
        expect(db).toBeDefined();
        expect(db.getDatabase()).toBeDefined();
    });

    it('should get storage usage', async () => {
        const usage = await db.getStorageUsage();
        expect(usage).toBeDefined();
        expect(typeof usage.used).toBe('number');
        expect(typeof usage.available).toBe('number');
        expect(typeof usage.percentage).toBe('number');
    });
});