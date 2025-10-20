// Integration tests for the smart content resurfacing system

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextAnalyzer } from '../contextAnalyzer.js';
import { ResurfacingTimer } from '../resurfacingTimer.js';
import { PreferenceManager } from '../preferenceManager.js';
import { SuggestionRanker } from '../suggestionRanker.js';
import { StoredContent } from '../../types/storage.js';

// Mock dependencies
vi.mock('../contentExtractor.js', () => ({
    contentExtractor: {
        extractContent: vi.fn().mockResolvedValue({
            success: true,
            content: {
                mainContent: 'This is a test article about JavaScript programming.',
                title: 'Test Article',
                metadata: {
                    readingTime: 2,
                    pageType: 'article',
                    language: 'en',
                    wordCount: 200,
                    imageCount: 0,
                    linkCount: 3
                },
                images: [],
                links: [],
                headings: [{ level: 1, text: 'JavaScript Programming' }]
            },
            processingTime: 100,
            confidence: 0.8
        })
    }
}));

vi.mock('../metadataCollector.js', () => ({
    metadataCollector: {
        collectMetadata: vi.fn().mockReturnValue({
            readingTime: 2,
            pageType: 'article',
            language: 'en',
            wordCount: 200,
            imageCount: 0,
            linkCount: 3
        })
    }
}));

describe('Smart Content Resurfacing Integration', () => {
    let contextAnalyzer: ContextAnalyzer;
    let resurfacingTimer: ResurfacingTimer;
    let preferenceManager: PreferenceManager;
    let suggestionRanker: SuggestionRanker;
    let mockContent: StoredContent[];

    beforeEach(() => {
        contextAnalyzer = new ContextAnalyzer();
        resurfacingTimer = new ResurfacingTimer();
        preferenceManager = new PreferenceManager();
        suggestionRanker = new SuggestionRanker();

        // Mock window.location
        Object.defineProperty(window, 'location', {
            value: { href: 'https://example.com/test-page' },
            writable: true
        });

        mockContent = [
            {
                id: 'content-1',
                url: 'https://example.com/js-guide',
                title: 'JavaScript Best Practices',
                content: 'Learn JavaScript programming with these best practices and tips.',
                metadata: {
                    readingTime: 5,
                    pageType: 'article',
                    language: 'en',
                    wordCount: 800,
                    imageCount: 2,
                    linkCount: 5
                },
                captureMethod: 'manual',
                timestamp: new Date('2024-01-15'),
                timesAccessed: 3,
                lastAccessed: new Date('2024-01-20'),
                syncedToCloud: false,
                cloudAnalysisComplete: false,
                lastModified: new Date('2024-01-15'),
                storageSize: 1024,
                version: 1,
                concepts: ['javascript', 'programming', 'best practices'],
                tags: ['javascript', 'programming', 'tutorial'],
                category: 'documentation'
            }
        ];
    });

    describe('Context Analysis Pipeline', () => {
        it('should analyze context and generate suggestions', async () => {
            const result = await contextAnalyzer.analyzeCurrentContext(mockContent, {
                minRelevanceThreshold: 0.1
            });

            expect(result.success).toBe(true);
            expect(result.context).toBeDefined();
            expect(result.context.url).toBe('https://example.com/test-page');
            expect(result.context.extractedKeywords).toBeDefined();
            expect(result.context.concepts).toBeDefined();
        });

        it('should calculate timing for suggestions', () => {
            const suggestion = {
                contentId: 'content-1',
                content: mockContent[0],
                relevanceScore: 0.8,
                matchReasons: ['Similar content themes'],
                suggestedTiming: {
                    contentId: 'content-1',
                    suggestedTime: new Date(),
                    confidence: 0.9,
                    reason: 'High relevance',
                    urgency: 'immediate' as const
                },
                priority: 'high' as const,
                confidence: 0.9
            };

            const timing = resurfacingTimer.calculateOptimalTiming(
                mockContent[0],
                suggestion
            );

            expect(timing).toBeDefined();
            expect(timing.contentId).toBe('content-1');
            expect(timing.confidence).toBeGreaterThan(0);
            expect(timing.suggestedTime).toBeInstanceOf(Date);
        });

        it('should rank suggestions based on multiple criteria', () => {
            const suggestions = [{
                contentId: 'content-1',
                content: mockContent[0],
                relevanceScore: 0.8,
                matchReasons: ['Similar content themes'],
                suggestedTiming: {
                    contentId: 'content-1',
                    suggestedTime: new Date(),
                    confidence: 0.9,
                    reason: 'High relevance',
                    urgency: 'immediate' as const
                },
                priority: 'high' as const,
                confidence: 0.9
            }];

            const context = {
                currentUrl: 'https://example.com/test-page',
                currentCategory: 'article',
                timeOfDay: 10,
                dayOfWeek: 1,
                userActivity: 'browsing' as const,
                sessionDuration: 15
            };

            const result = suggestionRanker.rankSuggestions(
                suggestions,
                context,
                preferenceManager.getPreferences(),
                preferenceManager.getLearningMetrics()
            );

            expect(result.rankedSuggestions).toBeDefined();
            expect(result.filteringStats).toBeDefined();
            expect(result.rankingFactors).toBeDefined();
        });
    });

    describe('Learning and Adaptation', () => {
        it('should record and learn from user interactions', () => {
            const interaction = {
                contentId: 'content-1',
                suggestionId: 'suggestion-1',
                timestamp: new Date(),
                action: 'clicked' as const,
                context: {
                    currentUrl: 'https://example.com/test-page',
                    timeOnPage: 30,
                    relevanceScore: 0.8,
                    suggestedTiming: 'immediate',
                    priority: 'high'
                },
                timeToAction: 1000,
                suggestionMetadata: {
                    relevanceScore: 0.8,
                    priority: 'high',
                    matchReasons: ['Similar content themes'],
                    suggestedTiming: 'immediate'
                }
            };

            expect(() => {
                preferenceManager.recordInteraction(interaction);
            }).not.toThrow();

            const metrics = preferenceManager.getLearningMetrics();
            expect(metrics.totalEngagements).toBeGreaterThan(0);
        });

        it('should update user behavior patterns', () => {
            const initialBehavior = resurfacingTimer.getUserBehavior();

            // Simulate positive interaction at current hour
            const currentHour = new Date().getHours();
            resurfacingTimer.updateUserBehavior(currentHour, true, 'documentation');

            const updatedBehavior = resurfacingTimer.getUserBehavior();

            // Behavior should be updated
            expect(updatedBehavior.engagementByTime[currentHour]).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle context analysis failures gracefully', async () => {
            // Test with empty content array
            const result = await contextAnalyzer.analyzeCurrentContext([]);

            expect(result.success).toBe(true);
            expect(result.relevantContent).toEqual([]);
        });

        it('should handle invalid timing calculations', () => {
            const invalidContent = {
                ...mockContent[0],
                timestamp: new Date('invalid-date')
            };

            const suggestion = {
                contentId: 'content-1',
                content: invalidContent,
                relevanceScore: 0.8,
                matchReasons: ['Similar content themes'],
                suggestedTiming: {
                    contentId: 'content-1',
                    suggestedTime: new Date(),
                    confidence: 0.9,
                    reason: 'High relevance',
                    urgency: 'immediate' as const
                },
                priority: 'high' as const,
                confidence: 0.9
            };

            expect(() => {
                resurfacingTimer.calculateOptimalTiming(invalidContent, suggestion);
            }).not.toThrow();
        });
    });

    describe('Performance', () => {
        it('should complete context analysis within reasonable time', async () => {
            const startTime = performance.now();

            await contextAnalyzer.analyzeCurrentContext(mockContent);

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should complete within 1 second
            expect(duration).toBeLessThan(1000);
        });

        it('should handle large content sets efficiently', async () => {
            // Create a larger content set
            const largeContentSet = Array.from({ length: 100 }, (_, i) => ({
                ...mockContent[0],
                id: `content-${i}`,
                title: `Article ${i}`,
                content: `This is article number ${i} about various topics.`
            }));

            const startTime = performance.now();

            const result = await contextAnalyzer.analyzeCurrentContext(largeContentSet, {
                maxSuggestions: 5
            });

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
        });
    });
});