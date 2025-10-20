// Tests for search interface functionality

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SearchInterface, SearchSuggestion } from '../searchInterface';
import { NaturalLanguageSearch } from '../naturalLanguageSearch';
import { SearchRanking } from '../searchRanking';
import { SearchIndex } from '../../storage/searchIndex';

// Mock dependencies
vi.mock('../naturalLanguageSearch');
vi.mock('../searchRanking');
vi.mock('../../storage/searchIndex');

const mockNaturalLanguageSearch = NaturalLanguageSearch as unknown as {
    getInstance: Mock;
    prototype: {
        search: Mock;
        getSearchSuggestions: Mock;
        getSearchHistory: Mock;
        recordSearchClick: Mock;
    };
};

const mockSearchRanking = SearchRanking as unknown as {
    getInstance: Mock;
    prototype: {
        rankSearchResults: Mock;
        getAdaptiveWeights: Mock;
        updateUserPreferences: Mock;
    };
};

const mockSearchIndex = SearchIndex as unknown as {
    getInstance: Mock;
};

describe('SearchInterface', () => {
    let searchInterface: SearchInterface;
    let mockNLSearchInstance: any;
    let mockRankingInstance: any;
    let mockSearchIndexInstance: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup mock instances
        mockNLSearchInstance = {
            search: vi.fn(),
            getSearchSuggestions: vi.fn(),
            getSearchHistory: vi.fn(),
            recordSearchClick: vi.fn()
        };

        mockRankingInstance = {
            rankSearchResults: vi.fn(),
            getAdaptiveWeights: vi.fn(),
            updateUserPreferences: vi.fn()
        };

        mockSearchIndexInstance = {};

        // Setup mock returns
        mockNaturalLanguageSearch.getInstance.mockReturnValue(mockNLSearchInstance);
        mockSearchRanking.getInstance.mockReturnValue(mockRankingInstance);
        mockSearchIndex.getInstance.mockReturnValue(mockSearchIndexInstance);

        // Create instance
        searchInterface = SearchInterface.getInstance();
    });

    describe('Basic Search', () => {
        it('should perform a successful search', async () => {
            const query = 'javascript tutorial';
            const mockSearchResult = {
                success: true,
                results: [],
                totalResults: 5,
                operationTime: 50,
                query,
                searchTerms: ['javascript', 'tutorial'],
                semanticMatches: [
                    {
                        contentId: '1',
                        title: 'JavaScript Tutorial',
                        snippet: 'Learn JavaScript basics',
                        semanticScore: 0.8,
                        keywordScore: 0.7,
                        combinedScore: 0.75,
                        matchType: 'semantic',
                        matchedConcepts: ['javascript', 'tutorial']
                    }
                ],
                queryIntent: {
                    type: 'search',
                    confidence: 0.8,
                    entities: ['JavaScript'],
                    keywords: ['javascript', 'tutorial']
                },
                suggestions: ['javascript basics', 'javascript advanced']
            };

            const mockRankedResults = [mockSearchResult.semanticMatches[0]];

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);
            mockRankingInstance.getAdaptiveWeights.mockReturnValue({
                keywordRelevance: 0.3,
                semanticRelevance: 0.3,
                contentQuality: 0.2,
                userEngagement: 0.1,
                recency: 0.05,
                authority: 0.03,
                personalRelevance: 0.02
            });
            mockRankingInstance.rankSearchResults.mockReturnValue(mockRankedResults);

            const result = await searchInterface.search(query);

            expect(result.success).toBe(true);
            expect(result.semanticMatches).toEqual(mockRankedResults);
            expect(result.searchTime).toBeDefined();
            expect(result.searchTime.total).toBeGreaterThan(0);
            expect(mockNLSearchInstance.search).toHaveBeenCalledWith(query, expect.any(Object));
            expect(mockRankingInstance.rankSearchResults).toHaveBeenCalled();
        });

        it('should handle search failures gracefully', async () => {
            const query = 'test query';

            mockNLSearchInstance.search.mockRejectedValue(new Error('Search failed'));

            const result = await searchInterface.search(query);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Search interface error');
            expect(result.searchTime).toBeDefined();
        });

        it('should handle empty search results', async () => {
            const query = 'nonexistent content';
            const mockSearchResult = {
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 20,
                query,
                searchTerms: ['nonexistent', 'content'],
                semanticMatches: [],
                queryIntent: {
                    type: 'search',
                    confidence: 0.6,
                    entities: [],
                    keywords: ['nonexistent', 'content']
                },
                suggestions: []
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);
            mockRankingInstance.getAdaptiveWeights.mockReturnValue({});
            mockRankingInstance.rankSearchResults.mockReturnValue([]);

            const result = await searchInterface.search(query);

            expect(result.success).toBe(true);
            expect(result.totalResults).toBe(0);
            expect(result.semanticMatches).toEqual([]);
        });
    });

    describe('Spell Correction', () => {
        it('should correct common spelling mistakes', async () => {
            const query = 'javascirpt tutorial'; // Misspelled
            const correctedQuery = 'javascript tutorial';

            const mockSearchResult = {
                success: true,
                results: [],
                totalResults: 1,
                operationTime: 30,
                query: correctedQuery,
                searchTerms: ['javascript', 'tutorial'],
                semanticMatches: [],
                queryIntent: {
                    type: 'search',
                    confidence: 0.7,
                    entities: [],
                    keywords: ['javascript', 'tutorial']
                },
                suggestions: []
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);
            mockRankingInstance.getAdaptiveWeights.mockReturnValue({});
            mockRankingInstance.rankSearchResults.mockReturnValue([]);

            const result = await searchInterface.search(query);

            expect(result.correctedQuery).toBe(correctedQuery);
            expect(mockNLSearchInstance.search).toHaveBeenCalledWith(correctedQuery, expect.any(Object));
        });

        it('should not correct correctly spelled queries', async () => {
            const query = 'javascript tutorial';

            const mockSearchResult = {
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 20,
                query,
                searchTerms: ['javascript', 'tutorial'],
                semanticMatches: [],
                queryIntent: {
                    type: 'search',
                    confidence: 0.8,
                    entities: [],
                    keywords: ['javascript', 'tutorial']
                },
                suggestions: []
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);
            mockRankingInstance.getAdaptiveWeights.mockReturnValue({});
            mockRankingInstance.rankSearchResults.mockReturnValue([]);

            const result = await searchInterface.search(query);

            expect(result.correctedQuery).toBeUndefined();
            expect(mockNLSearchInstance.search).toHaveBeenCalledWith(query, expect.any(Object));
        });
    });

    describe('Search Suggestions', () => {
        it('should generate search suggestions', async () => {
            const partialQuery = 'react';
            const mockBasicSuggestions = ['react hooks', 'react components', 'react tutorial'];
            const mockHistory = [
                {
                    id: '1',
                    query: 'react state management',
                    timestamp: new Date(),
                    resultCount: 10,
                    clickedResults: []
                }
            ];

            mockNLSearchInstance.getSearchSuggestions.mockResolvedValue(mockBasicSuggestions);
            mockNLSearchInstance.getSearchHistory.mockResolvedValue(mockHistory);

            const suggestions = await searchInterface.getSearchSuggestions(partialQuery, {
                enableSearchHistory: true,
                maxSuggestions: 10
            });

            expect(suggestions).toHaveLength(4); // 3 basic + 1 history
            expect(suggestions[0].type).toBe('completion');
            expect(suggestions.some(s => s.type === 'history')).toBe(true);
        });

        it('should include spell correction suggestions', async () => {
            const partialQuery = 'javascirpt'; // Misspelled

            mockNLSearchInstance.getSearchSuggestions.mockResolvedValue([]);
            mockNLSearchInstance.getSearchHistory.mockResolvedValue([]);

            const suggestions = await searchInterface.getSearchSuggestions(partialQuery);

            expect(suggestions.some(s => s.type === 'correction')).toBe(true);
            expect(suggestions.find(s => s.type === 'correction')?.text).toBe('javascript');
        });

        it('should include related term suggestions', async () => {
            const partialQuery = 'javascript';

            mockNLSearchInstance.getSearchSuggestions.mockResolvedValue([]);
            mockNLSearchInstance.getSearchHistory.mockResolvedValue([]);

            const suggestions = await searchInterface.getSearchSuggestions(partialQuery);

            expect(suggestions.some(s => s.type === 'related')).toBe(true);
            expect(suggestions.some(s => s.text.includes('react') || s.text.includes('node'))).toBe(true);
        });

        it('should limit suggestions to maxSuggestions', async () => {
            const partialQuery = 'test';
            const maxSuggestions = 5;

            mockNLSearchInstance.getSearchSuggestions.mockResolvedValue([
                'test1', 'test2', 'test3', 'test4', 'test5', 'test6', 'test7'
            ]);
            mockNLSearchInstance.getSearchHistory.mockResolvedValue([]);

            const suggestions = await searchInterface.getSearchSuggestions(partialQuery, {
                maxSuggestions
            });

            expect(suggestions.length).toBeLessThanOrEqual(maxSuggestions);
        });

        it('should deduplicate suggestions', async () => {
            const partialQuery = 'react';

            mockNLSearchInstance.getSearchSuggestions.mockResolvedValue(['react hooks', 'react tutorial']);
            mockNLSearchInstance.getSearchHistory.mockResolvedValue([
                {
                    id: '1',
                    query: 'react hooks', // Duplicate
                    timestamp: new Date(),
                    resultCount: 5,
                    clickedResults: []
                }
            ]);

            const suggestions = await searchInterface.getSearchSuggestions(partialQuery, {
                enableSearchHistory: true
            });

            const texts = suggestions.map(s => s.text);
            const uniqueTexts = new Set(texts);
            expect(texts.length).toBe(uniqueTexts.size);
        });
    });

    describe('Search Interaction Recording', () => {
        it('should record search clicks', async () => {
            const query = 'javascript tutorial';
            const clickedResultId = 'content_123';
            const mockSearchResult = {
                success: true,
                results: [],
                totalResults: 1,
                operationTime: 30,
                semanticMatches: [
                    {
                        contentId: clickedResultId,
                        title: 'JavaScript Tutorial',
                        snippet: 'Learn JavaScript',
                        semanticScore: 0.8,
                        keywordScore: 0.7,
                        combinedScore: 0.75,
                        matchType: 'semantic',
                        matchedConcepts: ['javascript', 'tutorial']
                    }
                ],
                queryIntent: {
                    type: 'search',
                    confidence: 0.8,
                    entities: ['JavaScript'],
                    keywords: ['javascript', 'tutorial']
                },
                suggestions: [],
                searchTime: {
                    parsing: 5,
                    searching: 20,
                    ranking: 5,
                    total: 30
                }
            };

            await searchInterface.recordSearchInteraction(query, clickedResultId, mockSearchResult);

            expect(mockRankingInstance.updateUserPreferences).toHaveBeenCalledWith(
                query,
                [mockSearchResult.semanticMatches[0]],
                mockSearchResult.queryIntent
            );
        });

        it('should handle recording errors gracefully', async () => {
            const query = 'test query';
            const clickedResultId = 'content_123';
            const mockSearchResult = {
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 20,
                semanticMatches: [],
                queryIntent: {
                    type: 'search',
                    confidence: 0.5,
                    entities: [],
                    keywords: ['test', 'query']
                },
                suggestions: [],
                searchTime: {
                    parsing: 5,
                    searching: 10,
                    ranking: 5,
                    total: 20
                }
            };

            mockRankingInstance.updateUserPreferences.mockImplementation(() => {
                throw new Error('Recording failed');
            });

            // Should not throw error
            await expect(
                searchInterface.recordSearchInteraction(query, clickedResultId, mockSearchResult)
            ).resolves.not.toThrow();
        });
    });

    describe('Enhanced Suggestions', () => {
        it('should generate refinement suggestions for too many results', async () => {
            const query = 'javascript';
            const manyResults = Array.from({ length: 25 }, (_, i) => ({
                contentId: `${i}`,
                title: `JavaScript Result ${i}`,
                snippet: `Content ${i}`,
                semanticScore: 0.7,
                keywordScore: 0.7,
                combinedScore: 0.7,
                matchType: 'semantic' as const,
                matchedConcepts: i < 10 ? ['javascript', 'tutorial'] : ['javascript', 'advanced']
            }));

            const mockSearchResult = {
                success: true,
                results: [],
                totalResults: 25,
                operationTime: 40,
                query,
                searchTerms: ['javascript'],
                semanticMatches: manyResults,
                queryIntent: {
                    type: 'search',
                    confidence: 0.8,
                    entities: ['JavaScript'],
                    keywords: ['javascript']
                },
                suggestions: []
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);
            mockRankingInstance.getAdaptiveWeights.mockReturnValue({});
            mockRankingInstance.rankSearchResults.mockReturnValue(manyResults);

            const result = await searchInterface.search(query);

            expect(result.suggestions.some(s => s.text.includes('tutorial') || s.text.includes('advanced'))).toBe(true);
        });

        it('should generate alternative suggestions for no results', async () => {
            const query = 'nonexistent programming language';
            const mockSearchResult = {
                success: true,
                results: [],
                totalResults: 0,
                operationTime: 20,
                query,
                searchTerms: ['nonexistent', 'programming', 'language'],
                semanticMatches: [],
                queryIntent: {
                    type: 'search',
                    confidence: 0.6,
                    entities: [],
                    keywords: ['nonexistent', 'programming', 'language']
                },
                suggestions: []
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);
            mockRankingInstance.getAdaptiveWeights.mockReturnValue({});
            mockRankingInstance.rankSearchResults.mockReturnValue([]);

            const result = await searchInterface.search(query);

            expect(result.suggestions.length).toBeGreaterThan(0);
            expect(result.suggestions.some(s => s.type === 'related')).toBe(true);
        });
    });

    describe('Performance Tracking', () => {
        it('should track search timing breakdown', async () => {
            const query = 'performance test';
            const mockSearchResult = {
                success: true,
                results: [],
                totalResults: 1,
                operationTime: 30,
                query,
                searchTerms: ['performance', 'test'],
                semanticMatches: [],
                queryIntent: {
                    type: 'search',
                    confidence: 0.7,
                    entities: [],
                    keywords: ['performance', 'test']
                },
                suggestions: []
            };

            mockNLSearchInstance.search.mockResolvedValue(mockSearchResult);
            mockRankingInstance.getAdaptiveWeights.mockReturnValue({});
            mockRankingInstance.rankSearchResults.mockReturnValue([]);

            const result = await searchInterface.search(query);

            expect(result.searchTime).toBeDefined();
            expect(result.searchTime.parsing).toBeGreaterThanOrEqual(0);
            expect(result.searchTime.searching).toBeGreaterThanOrEqual(0);
            expect(result.searchTime.ranking).toBeGreaterThanOrEqual(0);
            expect(result.searchTime.total).toBeGreaterThanOrEqual(0);
            expect(result.searchTime.total).toBeGreaterThanOrEqual(
                result.searchTime.parsing + result.searchTime.searching + result.searchTime.ranking
            );
        });
    });

    describe('Utility Methods', () => {
        it('should clear search history', async () => {
            const localStorageSpy = vi.spyOn(Storage.prototype, 'removeItem');

            await searchInterface.clearSearchHistory();

            expect(localStorageSpy).toHaveBeenCalledWith('mindscribe_search_history');
        });

        it('should export search history', async () => {
            const mockHistory = [
                {
                    id: '1',
                    query: 'test query',
                    timestamp: new Date(),
                    resultCount: 5,
                    clickedResults: []
                }
            ];

            mockNLSearchInstance.getSearchHistory.mockResolvedValue(mockHistory);

            const history = await searchInterface.exportSearchHistory();

            expect(history).toEqual(mockHistory);
            expect(mockNLSearchInstance.getSearchHistory).toHaveBeenCalledWith(1000);
        });

        it('should return search statistics', () => {
            const stats = searchInterface.getSearchStats();

            expect(stats).toBeDefined();
            expect(typeof stats.totalSearches).toBe('number');
            expect(typeof stats.averageResultCount).toBe('number');
            expect(Array.isArray(stats.topQueries)).toBe(true);
            expect(Array.isArray(stats.searchPatterns)).toBe(true);
        });
    });
});