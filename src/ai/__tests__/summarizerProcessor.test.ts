// Tests for SummarizerAPIProcessor

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SummarizerAPIProcessor } from '../summarizerProcessor';
import { CapturedContent } from '../../types/content';

// Mock Chrome AI Summarizer API
const mockSummarizer = {
    summarize: vi.fn(),
    destroy: vi.fn()
};

const mockSummarizerAPI = {
    capabilities: vi.fn(),
    create: vi.fn().mockResolvedValue(mockSummarizer)
};

// Setup global window mock
Object.defineProperty(window, 'ai', {
    value: {
        summarizer: mockSummarizerAPI
    },
    writable: true
});

describe('SummarizerAPIProcessor', () => {
    let processor: SummarizerAPIProcessor;
    let mockContent: CapturedContent;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock API availability
        mockSummarizerAPI.capabilities.mockResolvedValue({
            available: 'readily'
        });

        processor = SummarizerAPIProcessor.getInstance();

        mockContent = {
            id: 'test-content-1',
            url: 'https://example.com/article',
            title: 'The Future of Artificial Intelligence',
            content: 'Artificial intelligence is rapidly evolving and transforming various industries. Machine learning algorithms are becoming more sophisticated, enabling computers to perform tasks that were once thought to be exclusively human. Deep learning, a subset of machine learning, has shown remarkable success in areas such as image recognition, natural language processing, and game playing. As AI continues to advance, it raises important questions about ethics, employment, and the future of human-machine collaboration. Companies are investing heavily in AI research and development, leading to breakthrough innovations in autonomous vehicles, healthcare diagnostics, and personalized recommendations.',
            metadata: {
                readingTime: 8,
                pageType: 'article',
                language: 'en',
                wordCount: 200,
                imageCount: 1,
                linkCount: 3
            },
            captureMethod: 'manual',
            timestamp: new Date()
        };
    });

    describe('generateSummaries', () => {
        it('should generate three-tier summaries successfully', async () => {
            mockSummarizer.summarize
                .mockResolvedValueOnce('AI is transforming industries through advanced machine learning.') // TL;DR
                .mockResolvedValueOnce('AI is evolving rapidly, with machine learning and deep learning showing success in various applications. This raises important questions about ethics and employment.') // Quick
                .mockResolvedValueOnce('Artificial intelligence is rapidly transforming industries through sophisticated machine learning algorithms. Deep learning has achieved remarkable success in image recognition and natural language processing. As AI advances, it raises important ethical questions and concerns about employment, while companies continue investing heavily in research and development.'); // Detailed

            const result = await processor.generateSummaries(mockContent);

            expect(result.success).toBe(true);
            expect(result.summaries.tldr).toBe('AI is transforming industries through advanced machine learning.');
            expect(result.summaries.quick).toContain('AI is evolving rapidly');
            expect(result.summaries.detailed).toContain('Artificial intelligence is rapidly transforming');
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.processingTime).toBeGreaterThan(0);
        });

        it('should handle API unavailability gracefully', async () => {
            // Mock API as unavailable
            mockSummarizerAPI.capabilities.mockResolvedValue({
                available: 'no'
            });

            const unavailableProcessor = SummarizerAPIProcessor.getInstance();
            const result = await unavailableProcessor.generateSummaries(mockContent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not available');
            expect(result.summaries.tldr).toBe('');
            expect(result.summaries.quick).toBe('');
            expect(result.summaries.detailed).toBe('');
        });

        it('should use fallback summarization when API fails', async () => {
            mockSummarizerAPI.create.mockRejectedValue(new Error('API Error'));

            const result = await processor.generateSummaries(mockContent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('API Error');
            expect(result.summaries.tldr).toBeTruthy(); // Should have fallback content
            expect(result.confidence).toBe(0.3); // Lower confidence for fallback
        });

        it('should cache results for identical content', async () => {
            mockSummarizer.summarize
                .mockResolvedValueOnce('Cached TL;DR')
                .mockResolvedValueOnce('Cached quick summary')
                .mockResolvedValueOnce('Cached detailed summary');

            // First call
            const result1 = await processor.generateSummaries(mockContent);
            expect(result1.success).toBe(true);

            // Second call should use cache
            const result2 = await processor.generateSummaries(mockContent);
            expect(result2.success).toBe(true);
            expect(result2.summaries.tldr).toBe(result1.summaries.tldr);

            // API should only be called once (for the three summaries)
            expect(mockSummarizer.summarize).toHaveBeenCalledTimes(3);
        });

        it('should handle long content by truncating appropriately', async () => {
            const longContent = {
                ...mockContent,
                content: 'a'.repeat(10000) // Very long content
            };

            mockSummarizer.summarize.mockResolvedValue('Summary of long content');

            const result = await processor.generateSummaries(longContent);

            expect(result.success).toBe(true);
            expect(mockSummarizer.summarize).toHaveBeenCalled();

            // Verify content was truncated (check the call arguments)
            const callArgs = (mockSummarizer.summarize as Mock).mock.calls[0][0];
            expect(callArgs.length).toBeLessThan(10000);
        });

        it('should clean summaries by removing common prefixes', async () => {
            mockSummarizer.summarize
                .mockResolvedValueOnce('TL;DR: AI is transforming industries.')
                .mockResolvedValueOnce('In summary, AI is evolving rapidly with machine learning.')
                .mockResolvedValueOnce('Summary: Artificial intelligence is rapidly transforming industries.');

            const result = await processor.generateSummaries(mockContent);

            expect(result.summaries.tldr).toBe('AI is transforming industries.');
            expect(result.summaries.quick).toBe('AI is evolving rapidly with machine learning.');
            expect(result.summaries.detailed).toBe('Artificial intelligence is rapidly transforming industries.');
        });
    });

    describe('fallback summarization', () => {
        it('should generate extractive summaries when API fails', async () => {
            mockSummarizerAPI.create.mockRejectedValue(new Error('API unavailable'));

            const result = await processor.generateSummaries(mockContent);

            expect(result.success).toBe(false);
            expect(result.summaries.tldr).toBeTruthy();
            expect(result.summaries.quick).toBeTruthy();
            expect(result.summaries.detailed).toBeTruthy();

            // Fallback should use content from original text
            const originalWords = mockContent.content.toLowerCase().split(/\s+/);
            const summaryWords = result.summaries.detailed.toLowerCase().split(/\s+/);
            const hasOverlap = originalWords.some(word => summaryWords.includes(word));
            expect(hasOverlap).toBe(true);
        });

        it('should handle empty content gracefully', async () => {
            const emptyContent = {
                ...mockContent,
                content: ''
            };

            mockSummarizerAPI.create.mockRejectedValue(new Error('API unavailable'));

            const result = await processor.generateSummaries(emptyContent);

            expect(result.success).toBe(false);
            expect(result.summaries.tldr).toBe(mockContent.title);
            expect(result.summaries.quick).toBe(mockContent.title);
            expect(result.summaries.detailed).toBe(mockContent.title);
        });
    });

    describe('summary validation', () => {
        it('should validate summary quality correctly', async () => {
            const goodSummaries = {
                tldr: 'AI is transforming industries through machine learning.',
                quick: 'Artificial intelligence is rapidly evolving with sophisticated algorithms. Deep learning shows success in various applications.',
                detailed: 'Artificial intelligence is rapidly transforming industries through sophisticated machine learning algorithms and deep learning techniques. These technologies have achieved remarkable success in image recognition, natural language processing, and other applications, while raising important ethical questions about the future of human-machine collaboration.'
            };

            const validation = await processor.validateSummaryQuality(goodSummaries, mockContent.content);

            expect(validation.isValid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });

        it('should identify quality issues in summaries', async () => {
            const poorSummaries = {
                tldr: 'AI', // Too short
                quick: 'AI is good'.repeat(100), // Too long
                detailed: 'AI is good' // Same as quick (too similar)
            };

            const validation = await processor.validateSummaryQuality(poorSummaries, mockContent.content);

            expect(validation.isValid).toBe(false);
            expect(validation.issues.length).toBeGreaterThan(0);
            expect(validation.issues.some(issue => issue.includes('too short'))).toBe(true);
        });
    });

    describe('cache management', () => {
        it('should clear cache when requested', async () => {
            mockSummarizer.summarize.mockResolvedValue('Test summary');

            await processor.generateSummaries(mockContent);
            expect(processor.getCacheSize()).toBeGreaterThan(0);

            processor.clearCache();
            expect(processor.getCacheSize()).toBe(0);
        });

        it('should report cache size correctly', async () => {
            mockSummarizer.summarize.mockResolvedValue('Test summary');

            expect(processor.getCacheSize()).toBe(0);

            await processor.generateSummaries(mockContent);
            expect(processor.getCacheSize()).toBe(1);

            // Different content should increase cache size
            const differentContent = { ...mockContent, id: 'different-id', content: 'Different content' };
            await processor.generateSummaries(differentContent);
            expect(processor.getCacheSize()).toBe(2);
        });
    });

    describe('API availability', () => {
        it('should correctly report API availability', () => {
            expect(processor.isAPIAvailable()).toBe(true);
        });
    });
});