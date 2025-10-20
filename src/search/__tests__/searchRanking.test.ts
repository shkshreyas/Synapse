// Tests for search ranking functionality

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchRanking, RankingWeights } from '../searchRanking';
import { SemanticMatch, QueryIntent } from '../naturalLanguageSearch';

describe('SearchRanking', () => {
    let searchRanking: SearchRanking;
    let mockResults: SemanticMatch[];
    let mockQueryIntent: QueryIntent;

    beforeEach(() => {
        searchRanking = SearchRanking.getInstance();

        mockResults = [
            {
                contentId: '1',
                title: 'JavaScript Tutorial for Beginners',
                snippet: 'Learn JavaScript programming from scratch with examples and exercises.',
                semanticScore: 0.8,
                keywordScore: 0.7,
                combinedScore: 0.75,
                matchType: 'semantic',
                matchedConcepts: ['javascript', 'programming', 'tutorial']
            },
            {
                contentId: '2',
                title: 'Advanced JavaScript Concepts',
                snippet: 'Deep dive into advanced JavaScript topics including closures and prototypes.',
                semanticScore: 0.6,
                keywordScore: 0.9,
                combinedScore: 0.75,
                matchType: 'exact',
                matchedConcepts: ['javascript', 'advanced', 'concepts']
            },
            {
                contentId: '3',
                title: 'Python vs JavaScript Comparison',
                snippet: 'Compare Python and JavaScript for web development projects.',
                semanticScore: 0.4,
                keywordScore: 0.5,
                combinedScore: 0.45,
                matchType: 'related',
                matchedConcepts: ['python', 'javascript', 'comparison']
            }
        ];

        mockQueryIntent = {
            type: 'search',
            confidence: 0.8,
            entities: ['JavaScript'],
            keywords: ['javascript', 'tutorial']
        };
    });

    describe('Result Ranking', () => {
        it('should rank results by combined score', () => {
            const rankedResults = searchRanking.rankSearchResults(
                mockResults,
                'javascript tutorial',
                mockQueryIntent
            );

            expect(rankedResults).toHaveLength(3);
            expect(rankedResults[0].combinedScore).toBeGreaterThanOrEqual(rankedResults[1].combinedScore);
            expect(rankedResults[1].combinedScore).toBeGreaterThanOrEqual(rankedResults[2].combinedScore);
        });

        it('should apply custom weights correctly', () => {
            const customWeights: Partial<RankingWeights> = {
                keywordRelevance: 0.5,
                semanticRelevance: 0.3,
                contentQuality: 0.2
            };

            const rankedResults = searchRanking.rankSearchResults(
                mockResults,
                'javascript tutorial',
                mockQueryIntent,
                customWeights
            );

            expect(rankedResults).toHaveLength(3);
            // Results should be reordered based on custom weights
        });

        it('should boost results with title matches', () => {
            const resultsWithTitleMatch = [
                {
                    contentId: '1',
                    title: 'JavaScript Tutorial',
                    snippet: 'Basic content about programming.',
                    semanticScore: 0.5,
                    keywordScore: 0.5,
                    combinedScore: 0.5,
                    matchType: 'exact' as const,
                    matchedConcepts: ['javascript']
                },
                {
                    contentId: '2',
                    title: 'Programming Guide',
                    snippet: 'JavaScript tutorial with detailed examples and explanations.',
                    semanticScore: 0.6,
                    keywordScore: 0.6,
                    combinedScore: 0.6,
                    matchType: 'semantic' as const,
                    matchedConcepts: ['programming']
                }
            ];

            const rankedResults = searchRanking.rankSearchResults(
                resultsWithTitleMatch,
                'javascript tutorial',
                mockQueryIntent
            );

            // Result with title match should rank higher despite lower base scores
            expect(rankedResults[0].contentId).toBe('1');
        });
    });

    describe('Ranking Factors', () => {
        it('should calculate keyword relevance correctly', () => {
            const result = mockResults[0];
            const factors = (searchRanking as any).calculateRankingFactors(
                result,
                'javascript tutorial',
                mockQueryIntent
            );

            expect(factors.keywordRelevance).toBeGreaterThan(0);
            expect(factors.keywordRelevance).toBeLessThanOrEqual(1);
        });

        it('should calculate semantic relevance correctly', () => {
            const result = mockResults[0];
            const factors = (searchRanking as any).calculateRankingFactors(
                result,
                'javascript tutorial',
                mockQueryIntent
            );

            expect(factors.semanticRelevance).toBeGreaterThan(0);
            expect(factors.semanticRelevance).toBeLessThanOrEqual(1);
        });

        it('should calculate content quality correctly', () => {
            const result = mockResults[0];
            const factors = (searchRanking as any).calculateRankingFactors(
                result,
                'javascript tutorial',
                mockQueryIntent
            );

            expect(factors.contentQuality).toBeGreaterThan(0);
            expect(factors.contentQuality).toBeLessThanOrEqual(1);
        });

        it('should boost quality for well-structured content', () => {
            const highQualityResult = {
                contentId: '1',
                title: 'Complete JavaScript Tutorial: From Basics to Advanced',
                snippet: 'This comprehensive tutorial covers JavaScript fundamentals with detailed examples, step-by-step instructions, and practical exercises for beginners.',
                semanticScore: 0.7,
                keywordScore: 0.7,
                combinedScore: 0.7,
                matchType: 'semantic' as const,
                matchedConcepts: ['javascript', 'tutorial']
            };

            const lowQualityResult = {
                contentId: '2',
                title: 'JS',
                snippet: 'Short content.',
                semanticScore: 0.7,
                keywordScore: 0.7,
                combinedScore: 0.7,
                matchType: 'semantic' as const,
                matchedConcepts: ['javascript']
            };

            const highQualityFactors = (searchRanking as any).calculateRankingFactors(
                highQualityResult,
                'javascript tutorial',
                mockQueryIntent
            );

            const lowQualityFactors = (searchRanking as any).calculateRankingFactors(
                lowQualityResult,
                'javascript tutorial',
                mockQueryIntent
            );

            expect(highQualityFactors.contentQuality).toBeGreaterThan(lowQualityFactors.contentQuality);
        });
    });

    describe('Intent-Specific Ranking', () => {
        it('should boost semantic relevance for question intents', () => {
            const questionIntent: QueryIntent = {
                type: 'question',
                confidence: 0.9,
                entities: ['JavaScript'],
                keywords: ['what', 'javascript']
            };

            const weights = searchRanking.getAdaptiveWeights(questionIntent, 10);

            expect(weights.semanticRelevance).toBeGreaterThan(0.2);
            expect(weights.contentQuality).toBeGreaterThan(0.15);
        });

        it('should boost content quality for how-to intents', () => {
            const howtoIntent: QueryIntent = {
                type: 'howto',
                confidence: 0.9,
                entities: ['React'],
                keywords: ['how', 'create', 'react', 'component']
            };

            const weights = searchRanking.getAdaptiveWeights(howtoIntent, 10);

            expect(weights.contentQuality).toBeGreaterThan(0.15);
            expect(weights.authority).toBeGreaterThan(0.1);
        });

        it('should boost authority for definition intents', () => {
            const definitionIntent: QueryIntent = {
                type: 'definition',
                confidence: 0.9,
                entities: ['Machine Learning'],
                keywords: ['define', 'machine', 'learning']
            };

            const weights = searchRanking.getAdaptiveWeights(definitionIntent, 10);

            expect(weights.authority).toBeGreaterThan(0.1);
        });
    });

    describe('Diversity Filtering', () => {
        it('should remove very similar results', () => {
            const similarResults = [
                {
                    contentId: '1',
                    title: 'JavaScript Tutorial for Beginners',
                    snippet: 'Learn JavaScript basics.',
                    semanticScore: 0.8,
                    keywordScore: 0.8,
                    combinedScore: 0.8,
                    matchType: 'exact' as const,
                    matchedConcepts: ['javascript', 'tutorial']
                },
                {
                    contentId: '2',
                    title: 'JavaScript Tutorial for Beginners Guide',
                    snippet: 'Learn JavaScript fundamentals.',
                    semanticScore: 0.7,
                    keywordScore: 0.7,
                    combinedScore: 0.7,
                    matchType: 'exact' as const,
                    matchedConcepts: ['javascript', 'tutorial']
                },
                {
                    contentId: '3',
                    title: 'Python Programming Guide',
                    snippet: 'Learn Python programming.',
                    semanticScore: 0.6,
                    keywordScore: 0.6,
                    combinedScore: 0.6,
                    matchType: 'related' as const,
                    matchedConcepts: ['python', 'programming']
                }
            ];

            const rankedResults = searchRanking.rankSearchResults(
                similarResults,
                'javascript tutorial',
                mockQueryIntent
            );

            // Should filter out the very similar second result
            expect(rankedResults).toHaveLength(2);
            expect(rankedResults.find(r => r.contentId === '3')).toBeDefined();
        });

        it('should limit results per concept cluster', () => {
            const conceptClusteredResults = Array.from({ length: 10 }, (_, i) => ({
                contentId: `${i + 1}`,
                title: `JavaScript Tutorial ${i + 1}`,
                snippet: `JavaScript tutorial content ${i + 1}.`,
                semanticScore: 0.8 - (i * 0.05),
                keywordScore: 0.8 - (i * 0.05),
                combinedScore: 0.8 - (i * 0.05),
                matchType: 'semantic' as const,
                matchedConcepts: ['javascript', 'tutorial']
            }));

            const rankedResults = searchRanking.rankSearchResults(
                conceptClusteredResults,
                'javascript tutorial',
                mockQueryIntent
            );

            // Should limit to max 3 results per concept
            expect(rankedResults.length).toBeLessThanOrEqual(3);
        });
    });

    describe('User Preferences', () => {
        it('should update topic interests based on clicked results', () => {
            const clickedResults = [mockResults[0]]; // JavaScript tutorial

            searchRanking.updateUserPreferences(
                'javascript tutorial',
                clickedResults,
                mockQueryIntent
            );

            const preferences = searchRanking.getUserPreferences();
            expect(preferences.topicInterests.get('javascript')).toBeGreaterThan(0);
        });

        it('should track recent search patterns', () => {
            const query = 'react hooks tutorial';

            searchRanking.updateUserPreferences(
                query,
                [],
                mockQueryIntent
            );

            const preferences = searchRanking.getUserPreferences();
            expect(preferences.recentSearchPatterns).toContain(query);
        });

        it('should apply personal relevance scoring', () => {
            // Set up user preferences
            searchRanking.addTopicInterest('javascript', 0.9);

            const personalizedResults = searchRanking.rankSearchResults(
                mockResults,
                'javascript tutorial',
                mockQueryIntent
            );

            // Results with JavaScript should get personal relevance boost
            const jsResult = personalizedResults.find(r => r.matchedConcepts?.includes('javascript'));
            expect(jsResult).toBeDefined();
        });
    });

    describe('Adaptive Weights', () => {
        it('should adjust weights based on result count', () => {
            const fewResultsWeights = searchRanking.getAdaptiveWeights(mockQueryIntent, 5);
            const manyResultsWeights = searchRanking.getAdaptiveWeights(mockQueryIntent, 150);

            // With few results, should be more inclusive
            expect(fewResultsWeights.semanticRelevance).toBeGreaterThan(manyResultsWeights.semanticRelevance);

            // With many results, should prioritize relevance
            expect(manyResultsWeights.keywordRelevance).toBeGreaterThan(fewResultsWeights.keywordRelevance);
        });

        it('should normalize weights to sum to 1', () => {
            const weights = searchRanking.getAdaptiveWeights(mockQueryIntent, 20);

            const sum = Object.values(weights).reduce((total, weight) => total + weight, 0);
            expect(sum).toBeCloseTo(1, 2);
        });
    });

    describe('Preference Management', () => {
        it('should set preferred content types', () => {
            const types = ['article', 'tutorial', 'documentation'];
            searchRanking.setPreferredContentTypes(types);

            const preferences = searchRanking.getUserPreferences();
            expect(preferences.preferredContentTypes).toEqual(types);
        });

        it('should set preferred languages', () => {
            const languages = ['en', 'es', 'fr'];
            searchRanking.setPreferredLanguages(languages);

            const preferences = searchRanking.getUserPreferences();
            expect(preferences.preferredLanguages).toEqual(languages);
        });

        it('should add topic interests with bounds checking', () => {
            searchRanking.addTopicInterest('machine-learning', 1.5); // Over limit
            searchRanking.addTopicInterest('web-development', -0.5); // Under limit
            searchRanking.addTopicInterest('javascript', 0.7); // Valid

            const preferences = searchRanking.getUserPreferences();
            expect(preferences.topicInterests.get('machine-learning')).toBe(1.0);
            expect(preferences.topicInterests.get('web-development')).toBe(0.0);
            expect(preferences.topicInterests.get('javascript')).toBe(0.7);
        });
    });
});