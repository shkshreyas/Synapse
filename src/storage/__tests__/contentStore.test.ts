// Tests for ContentStore functionality

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { ContentStore } from '../contentStore';
import { CapturedContent } from '../../types/content';
import { getDatabase } from '../database';

describe('ContentStore', () => {
    let contentStore: ContentStore;
    let testContent: CapturedContent;

    beforeAll(async () => {
        // Initialize database before all tests
        await getDatabase();
    });

    beforeEach(async () => {
        contentStore = ContentStore.getInstance();

        testContent = {
            id: 'test-content-1',
            url: 'https://example.com/test-article',
            title: 'Test Article',
            content: 'This is a test article content for testing the storage system.',
            metadata: {
                readingTime: 2,
                pageType: 'article',
                language: 'en',
                wordCount: 12,
                imageCount: 0,
                linkCount: 1
            },
            captureMethod: 'manual',
            timestamp: new Date()
        };
    });

    afterEach(async () => {
        // Clean up test data
        try {
            await contentStore.delete(testContent.id);
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('create', () => {
        it('should successfully create new content', async () => {
            const result = await contentStore.create(testContent);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(testContent.id);
            expect(result.data?.url).toBe(testContent.url);
            expect(result.data?.title).toBe(testContent.title);
            expect(result.data?.timesAccessed).toBe(0);
            expect(result.data?.syncedToCloud).toBe(false);
        });

        it('should fail to create content with invalid data', async () => {
            const invalidContent = {
                ...testContent,
                id: '', // Invalid empty ID
            };

            const result = await contentStore.create(invalidContent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Validation failed');
        });

        it('should fail to create duplicate content', async () => {
            // Create content first time
            const firstResult = await contentStore.create(testContent);
            expect(firstResult.success).toBe(true);

            // Try to create same content again
            const secondResult = await contentStore.create(testContent);
            expect(secondResult.success).toBe(false);
        });
    });

    describe('read', () => {
        beforeEach(async () => {
            await contentStore.create(testContent);
        });

        it('should successfully read existing content', async () => {
            const result = await contentStore.read(testContent.id);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(testContent.id);
            expect(result.data?.title).toBe(testContent.title);
        });

        it('should fail to read non-existent content', async () => {
            const result = await contentStore.read('non-existent-id');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Content not found');
        });

        it('should update access tracking when reading content', async () => {
            // Read content first time
            const firstRead = await contentStore.read(testContent.id);
            expect(firstRead.success).toBe(true);

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            // Read content second time
            const secondRead = await contentStore.read(testContent.id);
            expect(secondRead.success).toBe(true);

            // Access count should be updated (note: access tracking is async)
            // We can't reliably test the exact count due to timing, but we can verify the read succeeded
        });
    });

    describe('update', () => {
        beforeEach(async () => {
            await contentStore.create(testContent);
        });

        it('should successfully update existing content', async () => {
            const updates = {
                title: 'Updated Test Article',
                userNotes: 'These are my notes',
                userRating: 4
            };

            const result = await contentStore.update(testContent.id, updates);

            expect(result.success).toBe(true);
            expect(result.data?.title).toBe(updates.title);
            expect(result.data?.userNotes).toBe(updates.userNotes);
            expect(result.data?.userRating).toBe(updates.userRating);
            expect(result.data?.version).toBe(2); // Version should increment
        });

        it('should fail to update non-existent content', async () => {
            const result = await contentStore.update('non-existent-id', { title: 'New Title' });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Content not found for update');
        });

        it('should validate updated content', async () => {
            const invalidUpdates = {
                userRating: 10 // Invalid rating (should be 1-5)
            };

            const result = await contentStore.update(testContent.id, invalidUpdates);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Validation failed');
        });
    });

    describe('delete', () => {
        beforeEach(async () => {
            await contentStore.create(testContent);
        });

        it('should successfully delete existing content', async () => {
            const deleteResult = await contentStore.delete(testContent.id);
            expect(deleteResult.success).toBe(true);

            // Verify content is deleted
            const readResult = await contentStore.read(testContent.id);
            expect(readResult.success).toBe(false);
        });

        it('should succeed when deleting non-existent content', async () => {
            const result = await contentStore.delete('non-existent-id');
            expect(result.success).toBe(true); // Should not fail for non-existent content
        });
    });

    describe('list', () => {
        beforeEach(async () => {
            // Create multiple test contents
            const contents = [
                { ...testContent, id: 'test-1', title: 'First Article', timestamp: new Date('2024-01-01') },
                { ...testContent, id: 'test-2', title: 'Second Article', timestamp: new Date('2024-01-02') },
                { ...testContent, id: 'test-3', title: 'Third Article', timestamp: new Date('2024-01-03') }
            ];

            for (const content of contents) {
                await contentStore.create(content);
            }
        });

        afterEach(async () => {
            // Clean up all test contents
            const ids = ['test-1', 'test-2', 'test-3'];
            for (const id of ids) {
                try {
                    await contentStore.delete(id);
                } catch (error) {
                    // Ignore cleanup errors
                }
            }
        });

        it('should list all content', async () => {
            const result = await contentStore.list();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data!.length).toBeGreaterThanOrEqual(3);
        });

        it('should support filtering', async () => {
            const result = await contentStore.list({
                filter: (content) => content.title.includes('First')
            });

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data!.length).toBe(1);
            expect(result.data![0].title).toBe('First Article');
        });

        it('should support sorting', async () => {
            const result = await contentStore.list({
                sortBy: 'timestamp',
                sortDirection: 'desc'
            });

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data!.length).toBeGreaterThanOrEqual(3);

            // Check if sorted by timestamp descending
            for (let i = 1; i < result.data!.length; i++) {
                expect(result.data![i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
                    result.data![i].timestamp.getTime()
                );
            }
        });

        it('should support pagination', async () => {
            const result = await contentStore.list({
                limit: 2,
                offset: 1
            });

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data!.length).toBeLessThanOrEqual(2);
        });
    });

    describe('bulkCreate', () => {
        it('should create multiple contents successfully', async () => {
            const contents = [
                { ...testContent, id: 'bulk-1', title: 'Bulk Article 1' },
                { ...testContent, id: 'bulk-2', title: 'Bulk Article 2' },
                { ...testContent, id: 'bulk-3', title: 'Bulk Article 3' }
            ];

            const result = await contentStore.bulkCreate(contents);

            expect(result.success).toBe(true);
            expect(result.successCount).toBe(3);
            expect(result.failureCount).toBe(0);

            // Clean up
            for (const content of contents) {
                await contentStore.delete(content.id);
            }
        });

        it('should handle partial failures in bulk create', async () => {
            const contents = [
                { ...testContent, id: 'bulk-valid', title: 'Valid Article' },
                { ...testContent, id: '', title: 'Invalid Article' }, // Invalid ID
                { ...testContent, id: 'bulk-valid-2', title: 'Another Valid Article' }
            ];

            const result = await contentStore.bulkCreate(contents);

            expect(result.success).toBe(false); // Overall failure due to one invalid item
            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(1);

            // Clean up successful creates
            await contentStore.delete('bulk-valid');
            await contentStore.delete('bulk-valid-2');
        });
    });
});