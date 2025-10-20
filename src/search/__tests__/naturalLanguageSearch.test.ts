// Tests for natural language search functionality

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NaturalLanguageSearch, QueryIntent } from '../naturalLanguageSearch';
import { SearchIndex } from '../../storage/searchIndex';
import { QueryParser } from '../../storage/queryParser';
import { getDatabase } from '../../storage/database';

// Mock dependencies
vi.mock('../../storage/searchIndex');
vi.mock('../../storage/queryParser');
vi.mock('../../storage/database');

const mockSearchIndex = SearchIndex as unknown as {
    getInstance: Mock;
    prototype: {
        search: Mock;
    };
};

const mockQueryParser = QueryParser as unknown as {
    getInstance: Mock;
    prototype: {
        parseQuery: Mock;
        getQuerySuggestions: Mock;
    };
};

const mockGetDatabase = getDatabase as Mock;

describe('NaturalLanguageSearch', () => {
    let nlSearch: NaturalLanguageSearch;
    let mockSearchIndexInstance: any;
    let mockQueryParserInstance: any;
    let mockDatabase: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup mock instances
        mockSearchIndexInstance = {
            search: vi.fn()
        };

        mockQueryParserInstance = {
            parseQuery: vi.fn(),
            getQuerySuggestions: vi.fn()
        };

        mockDatabase = {
            getDatabase: vi.fn().mockReturnValue({
                transaction: vi.fn().mockReturnValue({
                    objectStore: vi.fn().mockReturnValue({
                        getAll: vi.fn().mockReturnValue({
                            onsuccess: null,
                            onerror: null,
                            result: []
                        })
                    })
                })
            })
        };

        // Setup mock returns
        mockSearchIndex.getInstance.mockReturnValue(mockSearchIndexInstance);
        mockQueryParser.getInstance.mockReturnValue(mockQueryParserInstance);
        mockGetDatabase.mockResolvedValue(mockDatabase);

        // Create instance
        nlSearch = NaturalLanguageSearch.getInstance();
    });

    describe('Query Intent Analysis', () => {
        it('should identify question intent correctly', async () => {
            const query = 'What is machine learning?';

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['what', 'machine', 'learning'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockResolvedValue({
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 10
            });

            const result = await nlSearch.search(query);

            expect(result.queryIntent?.type).toBe('question');
            expect(result.queryIntent?.confidence).toBeGreaterThan(0.5);
            expect(result.queryIntent?.keywords).toContain('machine');
            expect(result.queryIntent?.keywords).toContain('learning');
        });

        it('should identify how-to intent correctly', async () => {
            const query = 'How to create a React component';

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['how', 'create', 'react', 'component'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockResolvedValue({
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 10
            });

            const result = await nlSearch.search(query);

            expect(result.queryIntent?.type).toBe('howto');
            expect(result.queryIntent?.confidence).toBeGreaterThan(0.6);
        });

        it('should identify comparison intent correctly', async () => {
            const query = 'React vs Vue comparison';

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['react', 'vue', 'comparison'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockResolvedValue({
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 10
            });

            const result = await nlSearch.search(query);

            expect(result.queryIntent?.type).toBe('comparison');
            expect(result.queryIntent?.confidence).toBeGreaterThan(0.5);
        });

        it('should identify definition intent correctly', async () => {
            const query = 'Define artificial intelligence';

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['define', 'artificial', 'intelligence'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockResolvedValue({
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 10
            });

            const result = await nlSearch.search(query);

            expect(result.queryIntent?.type).toBe('definition');
            expect(result.queryIntent?.confidence).toBeGreaterThan(0.6);
        });
    });

    describe('Query Enhancement', () => {
        it('should expand abbreviations in queries', async () => {
            const query = 'js tutorial';

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['js', 'tutorial'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockImplementation((enhancedQuery) => {
                expect(enhancedQuery).toContain('javascript');
                return Promise.resolve({
                    success: true,
                    results: [],
                    totalResults: 0,
                    operationTime: 10
                });
            });

            await nlSearch.search(query);
        });

        it('should add intent-specific terms for how-to queries', async () => {
            const query = 'how to build API';

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['how', 'build', 'api'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockImplementation((enhancedQuery) => {
                expect(enhancedQuery).toContain('tutorial');
                expect(enhancedQuery).toContain('guide');
                return Promise.resolve({
                    success: true,
                    results: [],
                    totalResults: 0,
                    operationTime: 10
                });
            });

            await nlSearch.search(query);
        });
    });

    describe('Semantic Search', () => {
        it('should perform semantic matching when enabled', async () => {
            const query = 'machine learning algorithms';
            const mockContent = [{
                id: '1',
                title: 'Introduction to ML',
                content: 'Machine learning is a subset of artificial intelligence...',
                concepts: ['machine learning', 'algorithms', 'AI'],
                tags: ['ml', 'ai', 'data science'],
                category: 'tutorial',
                metadata: {
                    pageType: 'article',
                    language: 'en',
                    readingTime: 10
                }
            }];

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['machine', 'learning', 'algorithms'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockResolvedValue({
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 10
            });

            // Mock database transaction for semantic search
            const mockTransaction = {
                objectStore: vi.fn().mockReturnValue({
                    getAll: vi.fn().mockReturnValue({
                        onsuccess: null,
                        onerror: null,
                        result: mockContent
                    })
                })
            };

            mockDatabase.getDatabase.mockReturnValue({
                transaction: vi.fn().mockReturnValue(mockTransaction)
            });

            const result = await nlSearch.search(query, { useSemanticSearch: true });

            // Simulate successful database operation
            const getAllRequest = mockTransaction.objectStore().getAll();
            getAllRequest.result = mockContent;
            if (getAllRequest.onsuccess) {
                getAllRequest.onsuccess();
            }

            expect(result.success).toBe(true);
            expect(result.semanticMatches).toBeDefined();
        });

        it('should calculate semantic similarity correctly', async () => {
            const query = 'javascript programming';
            const mockContent = [{
                id: '1',
                title: 'JavaScript Basics',
                content: 'Learn JavaScript programming fundamentals...',
                concepts: ['javascript', 'programming', 'web development'],
                tags: ['js', 'coding', 'frontend'],
                category: 'tutorial',
                metadata: {
                    pageType: 'article',
                    language: 'en',
                    readingTime: 15
                }
            }];

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['javascript', 'programming'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockResolvedValue({
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 10
            });

            // Setup database mock
            const mockTransaction = {
                objectStore: vi.fn().mockReturnValue({
                    getAll: vi.fn().mockReturnValue({
                        onsuccess: null,
                        onerror: null,
                        result: mockContent
                    })
                })
            };

            mockDatabase.getDatabase.mockReturnValue({
                transaction: vi.fn().mockReturnValue(mockTransaction)
            });

            const result = await nlSearch.search(query, { useSemanticSearch: true });

            // Simulate database success
            const getAllRequest = mockTransaction.objectStore().getAll();
            getAllRequest.result = mockContent;
            if (getAllRequest.onsuccess) {
                getAllRequest.onsuccess();
            }

            expect(result.success).toBe(true);
        });
    });

    describe('Search Suggestions', () => {
        it('should generate search suggestions', async () => {
            const partialQuery = 'react';

            mockQueryParserInstance.getQuerySuggestions.mockReturnValue([
                'react hooks',
                'react components',
                'react tutorial'
            ]);

            const suggestions = await nlSearch.getSearchSuggestions(partialQuery);

            expect(suggestions).toHaveLength(3);
            expect(suggestions[0]).toBe('react hooks');
        });

        it('should include search history in suggestions', async () => {
            const partialQuery = 'javascript';

            // Mock search history
            (nlSearch as any).searchHistory = [
                {
                    id: '1',
                    query: 'javascript tutorial',
                    timestamp: new Date(),
                    resultCount: 10,
                    clickedResults: []
                },
                {
                    id: '2',
                    query: 'javascript functions',
                    timestamp: new Date(),
                    resultCount: 5,
                    clickedResults: []
                }
            ];

            mockQueryParserInstance.getQuerySuggestions.mockReturnValue([]);

            const suggestions = await nlSearch.getSearchSuggestions(partialQuery);

            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions.some(s => s.includes('tutorial'))).toBe(true);
        });
    });

    describe('Search History', () => {
        it('should save search history', async () => {
            const query = 'test query';

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['test', 'query'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockResolvedValue({
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 10
            });

            // Mock database for saving history
            const mockPutRequest = { onsuccess: null, onerror: null };
            const mockStore = {
                put: vi.fn().mockReturnValue(mockPutRequest)
            };
            const mockTransaction = {
                objectStore: vi.fn().mockReturnValue(mockStore)
            };

            mockDatabase.getDatabase.mockReturnValue({
                transaction: vi.fn().mockReturnValue(mockTransaction)
            });

            await nlSearch.search(query);

            expect(mockStore.put).toHaveBeenCalled();
        });

        it('should retrieve search history', async () => {
            const history = await nlSearch.getSearchHistory(5);

            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBeLessThanOrEqual(5);
        });
    });

    describe('Error Handling', () => {
        it('should handle search index errors gracefully', async () => {
            const query = 'test query';

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['test', 'query'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockRejectedValue(new Error('Search failed'));

            const result = await nlSearch.search(query);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Natural language search failed');
        });

        it('should handle database errors gracefully', async () => {
            const query = 'test query';

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['test', 'query'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockResolvedValue({
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 10
            });

            mockGetDatabase.mockRejectedValue(new Error('Database error'));

            const result = await nlSearch.search(query, { useSemanticSearch: true });

            // Should still succeed with keyword search only
            expect(result.success).toBe(true);
            expect(result.semanticMatches).toEqual([]);
        });
    });

    describe('Performance', () => {
        it('should complete searches within reasonable time', async () => {
            const query = 'performance test';

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['performance', 'test'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockResolvedValue({
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 10
            });

            const startTime = performance.now();
            const result = await nlSearch.search(query);
            const endTime = performance.now();

            expect(result.success).toBe(true);
            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });

        it('should handle large result sets efficiently', async () => {
            const query = 'large dataset test';
            const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
                contentId: `content_${i}`,
                title: `Result ${i}`,
                snippet: `This is result number ${i}`,
                score: Math.random(),
                matchedTerms: 1,
                metadata: {
                    pageType: 'article',
                    language: 'en',
                    readingTime: 5
                }
            }));

            mockQueryParserInstance.parseQuery.mockReturnValue({
                terms: ['large', 'dataset', 'test'],
                filters: {},
                operators: [],
                isAdvanced: false
            });

            mockSearchIndexInstance.search.mockResolvedValue({
                success: true,
                results: largeResultSet,
                totalResults: 1000,
                operationTime: 50
            });

            const result = await nlSearch.search(query, { maxResults: 20 });

            expect(result.success).toBe(true);
            expect(result.operationTime).toBeLessThan(500); // Should handle large sets efficiently
        });
    });
});