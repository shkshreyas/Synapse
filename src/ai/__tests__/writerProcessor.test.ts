// Tests for WriterAPIProcessor

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { WriterAPIProcessor } from '../writerProcessor';
import { CapturedContent } from '../../types/content';

// Mock Chrome AI Writer API
const mockWriter = {
    write: vi.fn(),
    destroy: vi.fn()
};

const mockWriterAPI = {
    capabilities: vi.fn(),
    create: vi.fn().mockResolvedValue(mockWriter)
};

// Setup global window mock
Object.defineProperty(window, 'ai', {
    value: {
        writer: mockWriterAPI
    },
    writable: true
});

describe('WriterAPIProcessor', () => {
    let processor: WriterAPIProcessor;
    let mockContent: CapturedContent;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock API availability
        mockWriterAPI.capabilities.mockResolvedValue({
            available: 'readily'
        });

        processor = WriterAPIProcessor.getInstance();

        mockContent = {
            id: 'test-content-1',
            url: 'https://example.com/article',
            title: 'Introduction to Machine Learning',
            content: 'Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn from data. Supervised learning uses labeled data to train models. Unsupervised learning finds patterns in unlabeled data. Reinforcement learning learns through trial and error. Deep learning uses neural networks with multiple layers. These techniques are used in image recognition, natural language processing, and recommendation systems.',
            metadata: {
                readingTime: 5,
                pageType: 'article',
                language: 'en',
                wordCount: 150,
                imageCount: 2,
                linkCount: 5
            },
            captureMethod: 'manual',
            timestamp: new Date()
        };
    });

    describe('generateEnhancedContent', () => {
        it('should generate study questions, flashcards, and key points successfully', async () => {
            const mockStudyQuestions = `Q: What is machine learning?
Q: What are the main types of machine learning?
Q: How does supervised learning work?
Q: What is the difference between supervised and unsupervised learning?`;

            const mockFlashcards = `FRONT: What is machine learning?
BACK: A subset of artificial intelligence that focuses on algorithms that can learn from data
DIFFICULTY: easy
CATEGORY: definition

FRONT: What are the three main types of machine learning?
BACK: Supervised learning, unsupervised learning, and reinforcement learning
DIFFICULTY: medium
CATEGORY: classification`;

            const mockKeyPoints = `• Machine learning is a subset of artificial intelligence
• Supervised learning uses labeled data to train models
• Unsupervised learning finds patterns in unlabeled data
• Deep learning uses neural networks with multiple layers
• Applications include image recognition and NLP`;

            mockWriter.write
                .mockResolvedValueOnce(mockStudyQuestions)
                .mockResolvedValueOnce(mockFlashcards)
                .mockResolvedValueOnce(mockKeyPoints);

            const result = await processor.generateEnhancedContent(mockContent);

            expect(result.success).toBe(true);
            expect(result.studyQuestions).toHaveLength(4);
            expect(result.studyQuestions[0]).toBe('What is machine learning?');
            expect(result.flashcards).toHaveLength(2);
            expect(result.flashcards[0].front).toBe('What is machine learning?');
            expect(result.flashcards[0].difficulty).toBe('easy');
            expect(result.keyPoints).toHaveLength(5);
            expect(result.confidence).toBeGreaterThan(0);
        });

        it('should handle API unavailability gracefully', async () => {
            mockWriterAPI.capabilities.mockResolvedValue({
                available: 'no'
            });

            const unavailableProcessor = WriterAPIProcessor.getInstance();
            const result = await unavailableProcessor.generateEnhancedContent(mockContent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not available');
            expect(result.studyQuestions).toHaveLength(0);
            expect(result.flashcards).toHaveLength(0);
            expect(result.keyPoints).toHaveLength(0);
        });

        it('should use fallback generation when API fails', async () => {
            mockWriterAPI.create.mockRejectedValue(new Error('API Error'));

            const result = await processor.generateEnhancedContent(mockContent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('API Error');
            expect(result.studyQuestions.length).toBeGreaterThan(0); // Should have fallback content
            expect(result.flashcards.length).toBeGreaterThan(0);
            expect(result.keyPoints.length).toBeGreaterThan(0);
            expect(result.confidence).toBe(0.3); // Lower confidence for fallback
        });

        it('should cache results for identical content', async () => {
            mockWriter.write
                .mockResolvedValueOnce('Q: Test question?')
                .mockResolvedValueOnce('FRONT: Test\nBACK: Answer\nDIFFICULTY: easy\nCATEGORY: test')
                .mockResolvedValueOnce('• Test key point');

            // First call
            const result1 = await processor.generateEnhancedContent(mockContent);
            expect(result1.success).toBe(true);

            // Second call should use cache
            const result2 = await processor.generateEnhancedContent(mockContent);
            expect(result2.success).toBe(true);
            expect(result2.studyQuestions).toEqual(result1.studyQuestions);

            // API should only be called once for each type (3 total calls)
            expect(mockWriter.write).toHaveBeenCalledTimes(3);
        });

        it('should parse study questions correctly from various formats', async () => {
            const mockResponse = `Q: What is machine learning?
2. How does supervised learning work?
What are the applications of deep learning?
Q: What is the difference between AI and ML?`;

            mockWriter.write
                .mockResolvedValueOnce(mockResponse)
                .mockResolvedValueOnce('FRONT: Test\nBACK: Answer\nDIFFICULTY: easy\nCATEGORY: test')
                .mockResolvedValueOnce('• Test point');

            const result = await processor.generateEnhancedContent(mockContent);

            expect(result.studyQuestions).toHaveLength(4);
            expect(result.studyQuestions[0]).toBe('What is machine learning?');
            expect(result.studyQuestions[1]).toBe('How does supervised learning work?');
            expect(result.studyQuestions[2]).toBe('What are the applications of deep learning?');
        });

        it('should parse flashcards with all required fields', async () => {
            const mockResponse = `FRONT: What is supervised learning?
BACK: A type of machine learning that uses labeled data to train models
DIFFICULTY: medium
CATEGORY: machine learning

FRONT: Define neural network
BACK: A computing system inspired by biological neural networks
DIFFICULTY: hard
CATEGORY: deep learning`;

            mockWriter.write
                .mockResolvedValueOnce('Q: Test?')
                .mockResolvedValueOnce(mockResponse)
                .mockResolvedValueOnce('• Test point');

            const result = await processor.generateEnhancedContent(mockContent);

            expect(result.flashcards).toHaveLength(2);
            expect(result.flashcards[0].front).toBe('What is supervised learning?');
            expect(result.flashcards[0].back).toBe('A type of machine learning that uses labeled data to train models');
            expect(result.flashcards[0].difficulty).toBe('medium');
            expect(result.flashcards[0].category).toBe('machine learning');
        });

        it('should handle malformed flashcard responses gracefully', async () => {
            const mockResponse = `FRONT: Incomplete flashcard
BACK: 
DIFFICULTY: easy

FRONT: What is AI?
BACK: Artificial Intelligence
DIFFICULTY: invalid_difficulty
CATEGORY: AI`;

            mockWriter.write
                .mockResolvedValueOnce('Q: Test?')
                .mockResolvedValueOnce(mockResponse)
                .mockResolvedValueOnce('• Test point');

            const result = await processor.generateEnhancedContent(mockContent);

            // Should only include valid flashcards
            expect(result.flashcards).toHaveLength(1);
            expect(result.flashcards[0].front).toBe('What is AI?');
            expect(result.flashcards[0].difficulty).toBe('medium'); // Default fallback
        });
    });

    describe('fallback content generation', () => {
        it('should generate basic questions when API fails', async () => {
            mockWriterAPI.create.mockRejectedValue(new Error('API unavailable'));

            const result = await processor.generateEnhancedContent(mockContent);

            expect(result.success).toBe(false);
            expect(result.studyQuestions.length).toBeGreaterThan(0);
            expect(result.studyQuestions[0]).toContain('Introduction to Machine Learning');
        });

        it('should create flashcards from content structure', async () => {
            const contentWithDefinitions = {
                ...mockContent,
                content: 'Machine learning is a subset of AI. Supervised learning is a type that uses labeled data. Deep learning means using neural networks.'
            };

            mockWriterAPI.create.mockRejectedValue(new Error('API unavailable'));

            const result = await processor.generateEnhancedContent(contentWithDefinitions);

            expect(result.flashcards.length).toBeGreaterThan(0);
            expect(result.flashcards.some(card => card.front.includes('Machine learning'))).toBe(true);
        });

        it('should extract key points from important sentences', async () => {
            const contentWithKeywords = {
                ...mockContent,
                content: 'This is important: Machine learning is essential for AI. The key point is that supervised learning uses labeled data. It is crucial to understand that deep learning requires neural networks.'
            };

            mockWriterAPI.create.mockRejectedValue(new Error('API unavailable'));

            const result = await processor.generateEnhancedContent(contentWithKeywords);

            expect(result.keyPoints.length).toBeGreaterThan(0);
            expect(result.keyPoints.some(point => point.includes('important') || point.includes('key') || point.includes('crucial'))).toBe(true);
        });
    });

    describe('content synthesis', () => {
        it('should synthesize related content pieces', async () => {
            const relatedContent = [
                mockContent,
                {
                    ...mockContent,
                    id: 'content-2',
                    title: 'Deep Learning Fundamentals',
                    content: 'Deep learning is a subset of machine learning that uses neural networks. It excels at pattern recognition and has revolutionized computer vision and natural language processing.'
                }
            ];

            const mockSynthesisResponse = `SYNTHESIS: Both machine learning and deep learning are fundamental to modern AI, with deep learning being a specialized subset that uses neural networks for complex pattern recognition tasks.

CONNECTIONS:
- Deep learning is a subset of machine learning
- Both are used in natural language processing
- Neural networks are key to deep learning applications
- Pattern recognition is a common application area`;

            mockWriter.write.mockResolvedValueOnce(mockSynthesisResponse);

            const result = await processor.synthesizeRelatedContent(relatedContent);

            expect(result.synthesis).toContain('machine learning and deep learning');
            expect(result.connections).toHaveLength(4);
            expect(result.connections[0]).toBe('Deep learning is a subset of machine learning');
            expect(result.confidence).toBe(0.7);
        });

        it('should handle insufficient content for synthesis', async () => {
            const result = await processor.synthesizeRelatedContent([mockContent]);

            expect(result.synthesis).toBe('');
            expect(result.connections).toHaveLength(0);
            expect(result.confidence).toBe(0);
        });
    });

    describe('cache management', () => {
        it('should clear cache when requested', async () => {
            mockWriter.write.mockResolvedValue('Test content');

            await processor.generateEnhancedContent(mockContent);
            expect(processor.getCacheSize()).toBeGreaterThan(0);

            processor.clearCache();
            expect(processor.getCacheSize()).toBe(0);
        });

        it('should report cache size correctly', async () => {
            mockWriter.write.mockResolvedValue('Test content');

            expect(processor.getCacheSize()).toBe(0);

            await processor.generateEnhancedContent(mockContent);
            expect(processor.getCacheSize()).toBe(1);
        });
    });

    describe('API availability', () => {
        it('should correctly report API availability', () => {
            expect(processor.isAPIAvailable()).toBe(true);
        });
    });
});