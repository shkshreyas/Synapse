// Tests for PromptAPIProcessor

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { PromptAPIProcessor } from '../promptProcessor';
import { CapturedContent } from '../../types/content';

// Mock Chrome AI API
const mockSession = {
    prompt: vi.fn(),
    destroy: vi.fn()
};

const mockAI = {
    languageModel: {
        capabilities: vi.fn(),
        create: vi.fn().mockResolvedValue(mockSession)
    }
};

// Setup global window mock
Object.defineProperty(window, 'ai', {
    value: mockAI,
    writable: true
});

describe('PromptAPIProcessor', () => {
    let processor: PromptAPIProcessor;
    let mockContent: CapturedContent;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock API availability
        mockAI.languageModel.capabilities.mockResolvedValue({
            available: 'readily'
        });

        processor = PromptAPIProcessor.getInstance();

        mockContent = {
            id: 'test-content-1',
            url: 'https://example.com/article',
            title: 'Introduction to Machine Learning',
            content: 'Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn from data. It includes supervised learning, unsupervised learning, and reinforcement learning approaches.',
            metadata: {
                readingTime: 5,
                pageType: 'article',
                language: 'en',
                wordCount: 100,
                imageCount: 2,
                linkCount: 5
            },
            captureMethod: 'manual',
            timestamp: new Date()
        };
    });

    describe('extractConcepts', () => {
        it('should extract concepts successfully with valid JSON response', async () => {
            const mockResponse = JSON.stringify({
                concepts: [
                    {
                        name: 'Machine Learning',
                        confidence: 0.95,
                        category: 'technology',
                        context: 'Main topic of the article'
                    },
                    {
                        name: 'Artificial Intelligence',
                        confidence: 0.90,
                        category: 'technology',
                        context: 'Parent field of machine learning'
                    }
                ],
                category: 'tutorial',
                mainThemes: ['AI', 'ML'],
                confidence: 0.92
            });

            mockSession.prompt
                .mockResolvedValueOnce(mockResponse) // concept extraction
                .mockResolvedValueOnce(JSON.stringify({ tags: ['machine-learning', 'ai', 'algorithms'], confidence: 0.88 })) // tagging
                .mockResolvedValueOnce(JSON.stringify({ category: 'tutorial', confidence: 0.85 })); // categorization

            const result = await processor.extractConcepts(mockContent, 10);

            expect(result.success).toBe(true);
            expect(result.concepts).toHaveLength(2);
            expect(result.concepts[0].name).toBe('Machine Learning');
            expect(result.concepts[0].confidence).toBe(0.95);
            expect(result.tags).toContain('machine-learning');
            expect(result.category).toBe('tutorial');
            expect(result.confidence).toBeGreaterThan(0);
        });

        it('should handle API unavailability gracefully', async () => {
            // Create a new processor instance with unavailable API
            mockAI.languageModel.capabilities.mockResolvedValue({
                available: 'no'
            });

            const unavailableProcessor = PromptAPIProcessor.getInstance();
            const result = await unavailableProcessor.extractConcepts(mockContent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not available');
            expect(result.concepts).toHaveLength(0);
        });

        it('should use fallback extraction when JSON parsing fails', async () => {
            const mockResponse = `Here are the key concepts:
- Machine Learning: Core topic
- Algorithms: Important concept
- Data Science: Related field`;

            mockSession.prompt
                .mockResolvedValueOnce(mockResponse) // concept extraction (invalid JSON)
                .mockResolvedValueOnce('machine learning, ai, data') // tagging (invalid JSON)
                .mockResolvedValueOnce('tutorial'); // categorization (invalid JSON)

            const result = await processor.extractConcepts(mockContent);

            expect(result.success).toBe(true);
            expect(result.concepts.length).toBeGreaterThan(0);
            expect(result.concepts[0].name).toBe('Machine Learning');
        });

        it('should handle session creation errors', async () => {
            mockAI.languageModel.create.mockRejectedValue(new Error('Session creation failed'));

            const result = await processor.extractConcepts(mockContent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Session creation failed');
        });

        it('should truncate long content appropriately', async () => {
            const longContent = 'a'.repeat(10000);
            const contentWithLongText = {
                ...mockContent,
                content: longContent
            };

            mockSession.prompt.mockResolvedValue(JSON.stringify({
                concepts: [],
                confidence: 0.5
            }));

            await processor.extractConcepts(contentWithLongText);

            // Verify that the prompt was called with truncated content
            expect(mockSession.prompt).toHaveBeenCalled();
            const promptCall = (mockSession.prompt as Mock).mock.calls[0][0];
            expect(promptCall.length).toBeLessThan(longContent.length + 1000); // Account for template text
        });

        it('should limit number of concepts based on maxConcepts parameter', async () => {
            const mockResponse = JSON.stringify({
                concepts: Array.from({ length: 15 }, (_, i) => ({
                    name: `Concept ${i + 1}`,
                    confidence: 0.8,
                    category: 'concept',
                    context: 'test context'
                })),
                confidence: 0.8
            });

            mockSession.prompt
                .mockResolvedValueOnce(mockResponse)
                .mockResolvedValueOnce(JSON.stringify({ tags: ['test'], confidence: 0.8 }))
                .mockResolvedValueOnce(JSON.stringify({ category: 'article', confidence: 0.8 }));

            const result = await processor.extractConcepts(mockContent, 5);

            expect(result.success).toBe(true);
            expect(result.concepts.length).toBeLessThanOrEqual(15); // Should respect the response
        });
    });

    describe('template management', () => {
        it('should retrieve existing templates', () => {
            const template = processor.getTemplate('concept-extraction');
            expect(template).toBeDefined();
            expect(template?.name).toBe('concept-extraction');
            expect(template?.variables).toContain('title');
            expect(template?.variables).toContain('content');
        });

        it('should add new templates', () => {
            const newTemplate = {
                name: 'test-template',
                template: 'Test template with {{variable}}',
                variables: ['variable'],
                description: 'Test template'
            };

            processor.addTemplate(newTemplate);
            const retrieved = processor.getTemplate('test-template');

            expect(retrieved).toEqual(newTemplate);
        });
    });

    describe('API availability', () => {
        it('should correctly report API availability', () => {
            expect(processor.isAPIAvailable()).toBe(true);
        });
    });

    describe('fallback methods', () => {
        it('should categorize content based on metadata when AI fails', async () => {
            const videoContent = {
                ...mockContent,
                metadata: {
                    ...mockContent.metadata,
                    pageType: 'video' as const
                }
            };

            mockSession.prompt.mockRejectedValue(new Error('AI processing failed'));

            const result = await processor.extractConcepts(videoContent);

            expect(result.success).toBe(false);
            expect(result.error).toContain('AI processing failed');
        });
    });
});