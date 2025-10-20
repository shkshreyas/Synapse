// Integration test for AI processing pipeline

import { describe, it, expect, beforeEach } from 'vitest';
import { AIProcessingPipeline } from '../processingPipeline';
import { CapturedContent } from '../../types/content';

describe('AI Processing Integration', () => {
    let pipeline: AIProcessingPipeline;
    let mockContent: CapturedContent;

    beforeEach(() => {
        pipeline = AIProcessingPipeline.getInstance();

        mockContent = {
            id: 'test-content-1',
            url: 'https://example.com/article',
            title: 'Introduction to Machine Learning',
            content: 'Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn from data.',
            metadata: {
                readingTime: 5,
                pageType: 'article',
                language: 'en',
                wordCount: 100,
                imageCount: 1,
                linkCount: 3
            },
            captureMethod: 'manual',
            timestamp: new Date()
        };
    });

    it('should create AI processing pipeline instance', () => {
        expect(pipeline).toBeDefined();
        expect(pipeline.getAPIAvailability).toBeDefined();
        expect(pipeline.processContent).toBeDefined();
    });

    it('should report API availability status', () => {
        const availability = pipeline.getAPIAvailability();

        expect(availability).toHaveProperty('promptAPI');
        expect(availability).toHaveProperty('summarizerAPI');
        expect(availability).toHaveProperty('writerAPI');
        expect(availability).toHaveProperty('translatorAPI');
        expect(availability).toHaveProperty('overallAvailability');

        // In test environment, APIs should not be available
        expect(availability.overallAvailability).toBe(false);
    });

    it('should handle content processing when APIs are unavailable', async () => {
        const options = {
            enableConceptExtraction: true,
            enableSummaryGeneration: true,
            enableContentGeneration: true,
            enableTranslation: false
        };

        const result = await pipeline.processContent(mockContent, options);

        expect(result).toBeDefined();
        expect(result.success).toBe(false); // Should fail when APIs are unavailable
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.totalProcessingTime).toBeGreaterThan(0);
    });

    it('should create stored content from processing result', async () => {
        const processingResult = {
            conceptExtraction: {
                concepts: [{ name: 'Machine Learning', confidence: 0.9, category: 'technology' as const }],
                tags: ['ml', 'ai'],
                category: 'tutorial',
                confidence: 0.9,
                success: true,
                processingTime: 100
            },
            totalProcessingTime: 100,
            success: true,
            errors: []
        };

        const storedContent = await pipeline.createStoredContent(mockContent, processingResult);

        expect(storedContent.id).toBe(mockContent.id);
        expect(storedContent.concepts).toEqual(['Machine Learning']);
        expect(storedContent.tags).toEqual(['ml', 'ai']);
        expect(storedContent.category).toBe('tutorial');
        expect(storedContent.timesAccessed).toBe(0);
        expect(storedContent.syncedToCloud).toBe(false);
        expect(storedContent.version).toBe(1);
    });

    it('should track API usage', () => {
        // Reset usage first to get a clean state
        pipeline.resetAPIUsage();

        const resetUsage = pipeline.getAPIUsage();
        expect(resetUsage.totalCalls).toBe(0);
        expect(resetUsage.promptApi).toBe(0);
        expect(resetUsage.summarizerApi).toBe(0);
        expect(resetUsage.writerApi).toBe(0);
        expect(resetUsage.translatorApi).toBe(0);
    });

    it('should manage caches', () => {
        const cacheSizes = pipeline.getCacheSizes();
        expect(cacheSizes).toHaveProperty('summarizerCache');
        expect(cacheSizes).toHaveProperty('writerCache');
        expect(cacheSizes).toHaveProperty('translatorCache');

        // Should not throw when clearing caches
        expect(() => pipeline.clearAllCaches()).not.toThrow();
    });
});