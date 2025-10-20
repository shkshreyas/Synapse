// Tests for AIProcessingPipeline

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AIProcessingPipeline } from '../processingPipeline';
import { CapturedContent } from '../../types/content';
import { PromptAPIProcessor } from '../promptProcessor';
import { SummarizerAPIProcessor } from '../summarizerProcessor';
import { WriterAPIProcessor } from '../writerProcessor';
import { TranslatorAPIProcessor } from '../translatorProcessor';

// Mock all processors
vi.mock('../promptProcessor');
vi.mock('../summarizerProcessor');
vi.mock('../writerProcessor');
vi.mock('../translatorProcessor');

describe('AIProcessingPipeline', () => {
    let pipeline: AIProcessingPipeline;
    let mockContent: CapturedContent;
    let mockPromptProcessor: any;
    let mockSummarizerProcessor: any;
    let mockWriterProcessor: any;
    let mockTranslatorProcessor: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock processors
        mockPromptProcessor = {
            extractConcepts: vi.fn(),
            isAPIAvailable: vi.fn().mockReturnValue(true)
        };

        mockSummarizerProcessor = {
            generateSummaries: vi.fn(),
            isAPIAvailable: vi.fn().mockReturnValue(true),
            clearCache: vi.fn(),
            getCacheSize: vi.fn().mockReturnValue(0),
            validateSummaryQuality: vi.fn()
        };

        mockWriterProcessor = {
            generateEnhancedContent: vi.fn(),
            synthesizeRelatedContent: vi.fn(),
            isAPIAvailable: vi.fn().mockReturnValue(true),
            clearCache: vi.fn(),
            getCacheSize: vi.fn().mockReturnValue(0)
        };

        mockTranslatorProcessor = {
            translateContent: vi.fn(),
            isAPIAvailable: vi.fn().mockReturnValue(true),
            clearCache: vi.fn(),
            getCacheSize: vi.fn().mockReturnValue({ translations: 0, detections: 0 })
        };

        // Mock the getInstance methods
        (PromptAPIProcessor.getInstance as Mock).mockReturnValue(mockPromptProcessor);
        (SummarizerAPIProcessor.getInstance as Mock).mockReturnValue(mockSummarizerProcessor);
        (WriterAPIProcessor.getInstance as Mock).mockReturnValue(mockWriterProcessor);
        (TranslatorAPIProcessor.getInstance as Mock).mockReturnValue(mockTranslatorProcessor);

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

    describe('processContent', () => {
        it('should process content with all features enabled successfully', async () => {
            // Mock successful responses from all processors
            mockPromptProcessor.extractConcepts.mockResolvedValue({
                concepts: [{ name: 'Machine Learning', confidence: 0.9, category: 'technology' }],
                tags: ['ml', 'ai'],
                category: 'tutorial',
                confidence: 0.9,
                success: true
            });

            mockSummarizerProcessor.generateSummaries.mockResolvedValue({
                summaries: {
                    tldr: 'ML is a subset of AI.',
                    quick: 'Machine learning focuses on algorithms that learn from data.',
                    detailed: 'Machine learning is an important subset of artificial intelligence...'
                },
                confidence: 0.8,
                success: true
            });

            mockWriterProcessor.generateEnhancedContent.mockResolvedValue({
                studyQuestions: ['What is machine learning?'],
                flashcards: [{ front: 'ML definition', back: 'Subset of AI', difficulty: 'easy', category: 'definition' }],
                keyPoints: ['ML learns from data'],
                confidence: 0.7,
                success: true
            });

            mockTranslatorProcessor.translateContent.mockResolvedValue({
                translatedContent: 'Translated content',
                detectedLanguage: 'en',
                targetLanguage: 'es',
                confidence: 0.9,
                success: true
            });

            const options = {
                enableConceptExtraction: true,
                enableSummaryGeneration: true,
                enableContentGeneration: true,
                enableTranslation: true,
                targetLanguage: 'es'
            };

            const result = await pipeline.processContent(mockContent, options);

            expect(result.success).toBe(true);
            expect(result.conceptExtraction).toBeDefined();
            expect(result.summaryGeneration).toBeDefined();
            expect(result.contentGeneration).toBeDefined();
            expect(result.translation).toBeDefined();
            expect(result.errors).toHaveLength(0);
            expect(result.totalProcessingTime).toBeGreaterThan(0);
        });

        it('should handle partial failures gracefully', async () => {
            mockPromptProcessor.extractConcepts.mockResolvedValue({
                concepts: [],
                tags: [],
                category: 'other',
                confidence: 0,
                success: false,
                error: 'Concept extraction failed'
            });

            mockSummarizerProcessor.generateSummaries.mockResolvedValue({
                summaries: {
                    tldr: 'Summary',
                    quick: 'Quick summary',
                    detailed: 'Detailed summary'
                },
                confidence: 0.8,
                success: true
            });

            mockWriterProcessor.generateEnhancedContent.mockResolvedValue({
                studyQuestions: ['Question'],
                flashcards: [],
                keyPoints: ['Point'],
                confidence: 0.6,
                success: true
            });

            const result = await pipeline.processContent(mockContent);

            expect(result.success).toBe(true); // Should still be successful if some processors work
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Concept extraction failed');
            expect(result.summaryGeneration?.success).toBe(true);
            expect(result.contentGeneration?.success).toBe(true);
        });

        it('should handle complete processing failure', async () => {
            mockPromptProcessor.extractConcepts.mockRejectedValue(new Error('API Error'));
            mockSummarizerProcessor.generateSummaries.mockRejectedValue(new Error('API Error'));
            mockWriterProcessor.generateEnhancedContent.mockRejectedValue(new Error('API Error'));

            const result = await pipeline.processContent(mockContent);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should respect processing options', async () => {
            const options = {
                enableConceptExtraction: true,
                enableSummaryGeneration: false,
                enableContentGeneration: false,
                enableTranslation: false
            };

            mockPromptProcessor.extractConcepts.mockResolvedValue({
                concepts: [],
                tags: [],
                category: 'other',
                confidence: 0.5,
                success: true
            });

            const result = await pipeline.processContent(mockContent, options);

            expect(mockPromptProcessor.extractConcepts).toHaveBeenCalled();
            expect(mockSummarizerProcessor.generateSummaries).not.toHaveBeenCalled();
            expect(mockWriterProcessor.generateEnhancedContent).not.toHaveBeenCalled();
            expect(mockTranslatorProcessor.translateContent).not.toHaveBeenCalled();
        });
    });

    describe('createStoredContent', () => {
        it('should create stored content with AI processing results', async () => {
            const processingResult = {
                conceptExtraction: {
                    concepts: [{ name: 'ML', confidence: 0.9, category: 'technology' as const }],
                    tags: ['ml', 'ai'],
                    category: 'tutorial',
                    confidence: 0.9,
                    success: true,
                    processingTime: 100
                },
                summaryGeneration: {
                    summaries: {
                        tldr: 'Short summary',
                        quick: 'Quick summary',
                        detailed: 'Detailed summary'
                    },
                    confidence: 0.8,
                    success: true,
                    processingTime: 200
                },
                totalProcessingTime: 300,
                success: true,
                errors: []
            };

            const storedContent = await pipeline.createStoredContent(mockContent, processingResult);

            expect(storedContent.id).toBe(mockContent.id);
            expect(storedContent.concepts).toEqual(['ML']);
            expect(storedContent.tags).toEqual(['ml', 'ai']);
            expect(storedContent.category).toBe('tutorial');
            expect(storedContent.summaries).toEqual(processingResult.summaryGeneration.summaries);
            expect(storedContent.importance).toBeGreaterThan(0);
            expect(storedContent.timesAccessed).toBe(0);
            expect(storedContent.syncedToCloud).toBe(false);
            expect(storedContent.version).toBe(1);
        });
    });

    describe('processMultipleContents', () => {
        it('should process multiple contents in batches', async () => {
            const contents = [mockContent, { ...mockContent, id: 'content-2' }, { ...mockContent, id: 'content-3' }];

            mockPromptProcessor.extractConcepts.mockResolvedValue({
                concepts: [],
                tags: [],
                category: 'other',
                confidence: 0.5,
                success: true
            });

            const results = await pipeline.processMultipleContents(contents);

            expect(results).toHaveLength(3);
            expect(mockPromptProcessor.extractConcepts).toHaveBeenCalledTimes(3);
        });
    });

    describe('synthesizeRelatedContents', () => {
        it('should synthesize related contents successfully', async () => {
            const contents = [mockContent, { ...mockContent, id: 'content-2' }];

            mockWriterProcessor.synthesizeRelatedContent.mockResolvedValue({
                synthesis: 'Both contents discuss machine learning',
                connections: ['Common topic: ML', 'Both are educational'],
                confidence: 0.8
            });

            const result = await pipeline.synthesizeRelatedContents(contents);

            expect(result.synthesis).toContain('machine learning');
            expect(result.connections).toHaveLength(2);
            expect(result.confidence).toBe(0.8);
        });

        it('should handle insufficient content for synthesis', async () => {
            const result = await pipeline.synthesizeRelatedContents([mockContent]);

            expect(result.synthesis).toBe('');
            expect(result.connections).toHaveLength(0);
            expect(result.confidence).toBe(0);
        });
    });

    describe('API availability', () => {
        it('should report API availability correctly', () => {
            const availability = pipeline.getAPIAvailability();

            expect(availability.promptAPI).toBe(true);
            expect(availability.summarizerAPI).toBe(true);
            expect(availability.writerAPI).toBe(true);
            expect(availability.translatorAPI).toBe(true);
            expect(availability.overallAvailability).toBe(true);
        });

        it('should report overall availability as true if any API is available', () => {
            mockPromptProcessor.isAPIAvailable.mockReturnValue(false);
            mockSummarizerProcessor.isAPIAvailable.mockReturnValue(false);
            mockWriterProcessor.isAPIAvailable.mockReturnValue(true); // Only this one available
            mockTranslatorProcessor.isAPIAvailable.mockReturnValue(false);

            const availability = pipeline.getAPIAvailability();

            expect(availability.overallAvailability).toBe(true);
        });
    });

    describe('API usage tracking', () => {
        it('should track API usage correctly', async () => {
            mockPromptProcessor.extractConcepts.mockResolvedValue({
                concepts: [],
                tags: [],
                category: 'other',
                confidence: 0.5,
                success: true
            });

            mockSummarizerProcessor.generateSummaries.mockResolvedValue({
                summaries: { tldr: '', quick: '', detailed: '' },
                confidence: 0.5,
                success: true
            });

            await pipeline.processContent(mockContent);

            const usage = pipeline.getAPIUsage();
            expect(usage.promptApi).toBe(3); // Concept extraction typically uses 3 calls
            expect(usage.summarizerApi).toBe(3); // 3 summaries
            expect(usage.totalCalls).toBeGreaterThan(0);
        });

        it('should reset API usage when requested', async () => {
            await pipeline.processContent(mockContent);

            let usage = pipeline.getAPIUsage();
            expect(usage.totalCalls).toBeGreaterThan(0);

            pipeline.resetAPIUsage();

            usage = pipeline.getAPIUsage();
            expect(usage.totalCalls).toBe(0);
            expect(usage.promptApi).toBe(0);
            expect(usage.summarizerApi).toBe(0);
        });
    });

    describe('cache management', () => {
        it('should clear all caches when requested', () => {
            pipeline.clearAllCaches();

            expect(mockSummarizerProcessor.clearCache).toHaveBeenCalled();
            expect(mockWriterProcessor.clearCache).toHaveBeenCalled();
            expect(mockTranslatorProcessor.clearCache).toHaveBeenCalled();
        });

        it('should report cache sizes correctly', () => {
            const cacheSizes = pipeline.getCacheSizes();

            expect(cacheSizes.summarizerCache).toBe(0);
            expect(cacheSizes.writerCache).toBe(0);
            expect(cacheSizes.translatorCache.translations).toBe(0);
            expect(cacheSizes.translatorCache.detections).toBe(0);
        });
    });

    describe('processing validation', () => {
        it('should validate successful processing results', async () => {
            const goodResult = {
                conceptExtraction: {
                    concepts: [{ name: 'ML', confidence: 0.9, category: 'technology' as const }],
                    tags: ['ml'],
                    category: 'tutorial',
                    confidence: 0.9,
                    success: true,
                    processingTime: 100
                },
                summaryGeneration: {
                    summaries: {
                        tldr: 'Good summary with sufficient length',
                        quick: 'This is a good quick summary with appropriate length',
                        detailed: 'This is a detailed summary that provides comprehensive information about the topic'
                    },
                    confidence: 0.8,
                    success: true,
                    processingTime: 200
                },
                totalProcessingTime: 300,
                success: true,
                errors: []
            };

            mockSummarizerProcessor.validateSummaryQuality.mockResolvedValue({
                isValid: true,
                issues: []
            });

            const validation = await pipeline.validateProcessingResult(goodResult);

            expect(validation.isValid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });

        it('should identify issues in processing results', async () => {
            const poorResult = {
                conceptExtraction: {
                    concepts: [],
                    tags: [],
                    category: 'other',
                    confidence: 0.1, // Low confidence
                    success: true,
                    processingTime: 100
                },
                totalProcessingTime: 100,
                success: true,
                errors: []
            };

            const validation = await pipeline.validateProcessingResult(poorResult);

            expect(validation.isValid).toBe(false);
            expect(validation.issues.length).toBeGreaterThan(0);
            expect(validation.recommendations.length).toBeGreaterThan(0);
        });
    });
});