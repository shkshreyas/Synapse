// Tests for SearchIndex functionality

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { SearchIndex } from '../searchIndex';
import { ContentStore } from '../contentStore';
import { StoredContent } from '../../types/storage';
import { getDatabase } from '../database';

describe('SearchIndex', () => {
    let searchIndex: SearchIndex;
    let contentStore: ContentStore;
    let testContents: StoredContent[];

    beforeAll(async () => {
        // Initialize database before all tests
        await getDatabase();
    });

    beforeEach(async () => {
        searchIndex = SearchIndex.getInstance();
        contentStore = ContentStore.getInstance();

        // Create test content
        testContents = [
            {
                id: 'search-test-1',
                url: 'https://example.com/javascript-tutorial',
                title: 'JavaScript Tutorial for Beginners',
                content: 'Learn JavaScript programming language from scratch. This comprehensive guide covers variables, functions, objects, and more.',
                metadata: {
                    readingTime: 10,
                    pageType: 'article',
                    language: 'en',
                    author: 'John Doe',
                    wordCount: 150,
                    imageCount: 2,
                    linkCount: 5
                },
                captureMethod: 'manual',
                timestamp: new Date('2024-01-15'),
                timesAccessed: 5,
                lastAccessed: new Date(),
                syncedToCloud: false,
                cloudAnalysisComplete: false,
                lastModified: new Date(),
                storageSize: 1000,
                version: 1,
                tags: ['javascript', 'programming', 'tutorial'],
                concepts: ['variables', 'functions', 'objects'],
                category: 'education',
                importance: 8
            },
            {
                id: 'search-test-2',
                url: 'https://example.com/react-components',
                title: 'Building React Components',
                content: 'React components are the building blocks of React applications. Learn how to create functional and class components.',
                metadata: {
                    readingTime: 8,
                    pageType: 'article',
                    language: 'en',
                    author: 'Jane Smith',
                    wordCount: 120,
                    imageCount: 1,
                    linkCount: 3
                },
                captureMethod: 'auto',
                timestamp: new Date('2024-01-20'),
                timesAccessed: 3,
                lastAccessed: new Date(),
                syncedToCloud: false,
                cloudAnalysisComplete: false,
                lastModified: new Date(),
                storageSize: 800,
                version: 1,
                tags: ['react', 'components', 'javascript'],
                concepts: ['components', 'jsx', 'props'],
                category: 'development',
                importance: 7
            },
            {
                id: 'search-test-3',
                url: 'https://example.com/python-basics',
                title: 'Python Programming Basics',
                content: 'Python is a versatile programming language. This article covers basic syntax, data types, and control structures.',
                metadata: {
                    readingTime: 12,
                    pageType: 'documentation',
                    language: 'en',
                    author: 'Bob Johnson',
                    wordCount: 180,
                    imageCount: 0,
                    linkCount: 8
                },
                captureMethod: 'highlight',
                timestamp: new Date('2024-01-10'),
                timesAccessed: 8,
                lastAccessed: new Date(),
                syncedToCloud: false,
                cloudAnalysisComplete: false,
                lastModified: new Date(),
                storageSize: 1200,
                version: 1,
                tags: ['python', 'programming', 'basics'],
                concepts: ['syntax', 'data types', 'control structures'],
                category: 'education',
                importance: 9
            }
        ];

        // Create and index test content
        for (const content of testContents) {
            await contentStore.create(content);
            await searchIndex.indexContent(content);
        }
    });

    afterEach(async () => {
        // Clean up test data
        for (const content of testContents) {
            try {
                await contentStore.delete(content.id);
                await searchIndex.removeFromIndex(content.id);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });

    describe('indexContent', () => {
        it('should successfully index content', async () => {
            const newContent: StoredContent = {
                ...testContents[0],
                id: 'index-test',
                title: 'Test Indexing',
                content: 'This is test content for indexing'
            };

            const result = await searchIndex.indexContent(newContent);

            expect(result.success).toBe(true);
            expect(result.contentId).toBe(newContent.id);
            expect(result.termsIndexed).toBeGreaterThan(0);

            // Clean up
            await searchIndex.removeFromIndex(newContent.id);
        });
    });

    describe('search', () => {
        it('should find content by title match', async () => {
            const result = await searchIndex.search('JavaScript Tutorial');

            expect(result.success).toBe(true);
            expect(result.results.length).toBeGreaterThan(0);
            expect(result.results[0].contentId).toBe('search-test-1');
            expect(result.results[0].title).toContain('JavaScript Tutorial');
        });

        it('should find content by content match', async () => {
            const result = await searchIndex.search('programming language');

            expect(result.success).toBe(true);
            expect(result.results.length).toBeGreaterThan(0);

            // Should find both JavaScript and Python content
            const contentIds = result.results.map(r => r.contentId);
            expect(contentIds).toContain('search-test-1');
            expect(contentIds).toContain('search-test-3');
        });

        it('should find content by tag match', async () => {
            const result = await searchIndex.search('react');

            expect(result.success).toBe(true);
            expect(result.results.length).toBeGreaterThan(0);
            expect(result.results[0].contentId).toBe('search-test-2');
        });

        it('should find content by concept match', async () => {
            const result = await searchIndex.search('functions');

            expect(result.success).toBe(true);
            expect(result.results.length).toBeGreaterThan(0);
            expect(result.results[0].contentId).toBe('search-test-1');
        });

        it('should rank results by relevance', async () => {
            const result = await searchIndex.search('programming');

            expect(result.success).toBe(true);
            expect(result.results.length).toBeGreaterThan(1);

            // Results should be sorted by score (descending)
            for (let i = 1; i < result.results.length; i++) {
                expect(result.results[i - 1].score).toBeGreaterThanOrEqual(result.results[i].score);
            }
        });

        it('should support filtering by category', async () => {
            const result = await searchIndex.search('programming', {
                filters: { category: 'education' }
            });

            expect(result.success).toBe(true);
            expect(result.results.length).toBeGreaterThan(0);

            // All results should be from education category
            result.results.forEach(r => {
                expect(r.metadata.category).toBe('education');
            });
        });

        it('should support filtering by page type', async () => {
            const result = await searchIndex.search('programming', {
                filters: { pageType: 'documentation' }
            });

            expect(result.success).toBe(true);
            expect(result.results.length).toBeGreaterThan(0);

            // All results should be documentation
            result.results.forEach(r => {
                expect(r.metadata.pageType).toBe('documentation');
            });
        });

        it('should support pagination', async () => {
            const result = await searchIndex.search('programming', {
                page: 0,
                pageSize: 1
            });

            expect(result.success).toBe(true);
            expect(result.results.length).toBe(1);
            expect(result.totalResults).toBeGreaterThan(1);
        });

        it('should handle empty search query', async () => {
            const result = await searchIndex.search('');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid query');
        });

        it('should handle search with no results', async () => {
            const result = await searchIndex.search('nonexistentterm12345');

            expect(result.success).toBe(true);
            expect(result.results.length).toBe(0);
            expect(result.totalResults).toBe(0);
        });

        it('should generate relevant snippets', async () => {
            const result = await searchIndex.search('JavaScript programming');

            expect(result.success).toBe(true);
            expect(result.results.length).toBeGreaterThan(0);

            const firstResult = result.results[0];
            expect(firstResult.snippet).toBeDefined();
            expect(firstResult.snippet.length).toBeGreaterThan(0);
            expect(firstResult.snippet).toContain('<mark>'); // Should highlight search terms
        });
    });

    describe('removeFromIndex', () => {
        it('should successfully remove content from index', async () => {
            const contentId = 'search-test-1';

            // Verify content is searchable before removal
            const beforeResult = await searchIndex.search('JavaScript Tutorial');
            expect(beforeResult.results.some(r => r.contentId === contentId)).toBe(true);

            // Remove from index
            const removeResult = await searchIndex.removeFromIndex(contentId);
            expect(removeResult.success).toBe(true);

            // Verify content is no longer searchable
            const afterResult = await searchIndex.search('JavaScript Tutorial');
            expect(afterResult.results.some(r => r.contentId === contentId)).toBe(false);

            // Re-index for cleanup
            await searchIndex.indexContent(testContents[0]);
        });

        it('should handle removing non-existent content', async () => {
            const result = await searchIndex.removeFromIndex('non-existent-id');
            expect(result.success).toBe(true); // Should not fail
        });
    });

    describe('rebuildIndex', () => {
        it('should successfully rebuild the entire index', async () => {
            const result = await searchIndex.rebuildIndex();

            expect(result.success).toBe(true);
            expect(result.totalItems).toBeGreaterThanOrEqual(testContents.length);
            expect(result.successCount).toBeGreaterThan(0);
            expect(result.failureCount).toBe(0);
        });
    });
});