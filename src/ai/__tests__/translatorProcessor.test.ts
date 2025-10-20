// Tests for TranslatorAPIProcessor

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { TranslatorAPIProcessor } from '../translatorProcessor';
import { CapturedContent } from '../../types/content';

// Mock Chrome AI Translator API
const mockTranslator = {
    translate: vi.fn(),
    destroy: vi.fn()
};

const mockLanguageDetector = {
    detect: vi.fn(),
    destroy: vi.fn()
};

const mockTranslatorAPI = {
    capabilities: vi.fn(),
    create: vi.fn().mockResolvedValue(mockTranslator)
};

const mockLanguageDetectorAPI = {
    create: vi.fn().mockResolvedValue(mockLanguageDetector)
};

// Setup global window mock
Object.defineProperty(window, 'ai', {
    value: {
        translator: mockTranslatorAPI,
        languageDetector: mockLanguageDetectorAPI
    },
    writable: true
});

describe('TranslatorAPIProcessor', () => {
    let processor: TranslatorAPIProcessor;
    let mockContent: CapturedContent;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock API availability
        mockTranslatorAPI.capabilities.mockResolvedValue({
            available: 'readily'
        });

        processor = TranslatorAPIProcessor.getInstance();

        mockContent = {
            id: 'test-content-1',
            url: 'https://example.com/article',
            title: 'Introducción al Aprendizaje Automático',
            content: 'El aprendizaje automático es una rama de la inteligencia artificial que se centra en algoritmos que pueden aprender de los datos. Incluye aprendizaje supervisado, no supervisado y por refuerzo.',
            metadata: {
                readingTime: 5,
                pageType: 'article',
                language: 'es',
                wordCount: 100,
                imageCount: 1,
                linkCount: 3
            },
            captureMethod: 'manual',
            timestamp: new Date()
        };
    });

    describe('translateContent', () => {
        it('should translate content successfully', async () => {
            mockLanguageDetector.detect.mockResolvedValue([
                { detectedLanguage: 'es', confidence: 0.95 }
            ]);

            mockTranslator.translate.mockResolvedValue(
                'Machine learning is a branch of artificial intelligence that focuses on algorithms that can learn from data. It includes supervised, unsupervised, and reinforcement learning.'
            );

            const result = await processor.translateContent(mockContent, 'en');

            expect(result.success).toBe(true);
            expect(result.detectedLanguage).toBe('es');
            expect(result.targetLanguage).toBe('en');
            expect(result.translatedContent).toContain('Machine learning');
            expect(result.confidence).toBeGreaterThan(0);
        });

        it('should handle same language detection gracefully', async () => {
            const englishContent = {
                ...mockContent,
                content: 'Machine learning is a subset of artificial intelligence.',
                metadata: { ...mockContent.metadata, language: 'en' }
            };

            mockLanguageDetector.detect.mockResolvedValue([
                { detectedLanguage: 'en', confidence: 0.95 }
            ]);

            const result = await processor.translateContent(englishContent, 'en');

            expect(result.success).toBe(true);
            expect(result.detectedLanguage).toBe('en');
            expect(result.targetLanguage).toBe('en');
            expect(result.translatedContent).toBe(englishContent.content);
            expect(result.confidence).toBe(1.0);
        });

        it('should handle API unavailability gracefully', async () => {
            mockTranslatorAPI.capabilities.mockResolvedValue({
                available: 'no'
            });

            const unavailableProcessor = TranslatorAPIProcessor.getInstance();
            const result = await unavailableProcessor.translateContent(mockContent, 'en');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not available');
            expect(result.translatedContent).toBe('');
        });

        it('should cache translation results', async () => {
            mockLanguageDetector.detect.mockResolvedValue([
                { detectedLanguage: 'es', confidence: 0.95 }
            ]);
            mockTranslator.translate.mockResolvedValue('Translated content');

            // First call
            const result1 = await processor.translateContent(mockContent, 'en');
            expect(result1.success).toBe(true);

            // Second call should use cache
            const result2 = await processor.translateContent(mockContent, 'en');
            expect(result2.success).toBe(true);
            expect(result2.translatedContent).toBe(result1.translatedContent);

            // API should only be called once
            expect(mockTranslator.translate).toHaveBeenCalledTimes(1);
        });

        it('should handle translation errors gracefully', async () => {
            mockLanguageDetector.detect.mockResolvedValue([
                { detectedLanguage: 'es', confidence: 0.95 }
            ]);
            mockTranslatorAPI.create.mockRejectedValue(new Error('Translation failed'));

            const result = await processor.translateContent(mockContent, 'en');

            expect(result.success).toBe(false);
            expect(result.error).toContain('Translation failed');
        });

        it('should split long content into chunks', async () => {
            const longContent = {
                ...mockContent,
                content: 'a'.repeat(5000) // Very long content
            };

            mockLanguageDetector.detect.mockResolvedValue([
                { detectedLanguage: 'es', confidence: 0.95 }
            ]);
            mockTranslator.translate.mockResolvedValue('translated chunk');

            const result = await processor.translateContent(longContent, 'en');

            expect(result.success).toBe(true);
            // Should be called multiple times for chunks
            expect(mockTranslator.translate).toHaveBeenCalledTimes(3); // Approximately 3 chunks for 5000 chars
        });
    });

    describe('detectLanguage', () => {
        it('should detect language using Chrome AI API', async () => {
            mockLanguageDetector.detect.mockResolvedValue([
                { detectedLanguage: 'es', confidence: 0.95 }
            ]);

            const detectedLanguage = await processor.detectLanguage(mockContent);

            expect(detectedLanguage).toBe('es');
            expect(mockLanguageDetector.detect).toHaveBeenCalledWith(mockContent.content);
        });

        it('should use fallback detection when API fails', async () => {
            mockLanguageDetectorAPI.create.mockRejectedValue(new Error('Detection failed'));

            const spanishContent = {
                ...mockContent,
                content: 'El aprendizaje automático es una rama de la inteligencia artificial que se centra en algoritmos.'
            };

            const detectedLanguage = await processor.detectLanguage(spanishContent);

            expect(detectedLanguage).toBe('es'); // Should detect Spanish through fallback
        });

        it('should detect Chinese characters', async () => {
            mockLanguageDetectorAPI.create.mockRejectedValue(new Error('API unavailable'));

            const chineseContent = {
                ...mockContent,
                content: '机器学习是人工智能的一个分支，专注于可以从数据中学习的算法。'
            };

            const detectedLanguage = await processor.detectLanguage(chineseContent);

            expect(detectedLanguage).toBe('zh');
        });

        it('should detect Japanese characters', async () => {
            mockLanguageDetectorAPI.create.mockRejectedValue(new Error('API unavailable'));

            const japaneseContent = {
                ...mockContent,
                content: '機械学習は人工知能の一分野で、データから学習できるアルゴリズムに焦点を当てています。'
            };

            const detectedLanguage = await processor.detectLanguage(japaneseContent);

            expect(detectedLanguage).toBe('ja');
        });

        it('should cache language detection results', async () => {
            mockLanguageDetector.detect.mockResolvedValue([
                { detectedLanguage: 'es', confidence: 0.95 }
            ]);

            // First call
            const result1 = await processor.detectLanguage(mockContent);
            expect(result1).toBe('es');

            // Second call should use cache
            const result2 = await processor.detectLanguage(mockContent);
            expect(result2).toBe('es');

            // API should only be called once
            expect(mockLanguageDetector.detect).toHaveBeenCalledTimes(1);
        });
    });

    describe('createBilingualContent', () => {
        it('should create bilingual content successfully', async () => {
            mockLanguageDetector.detect.mockResolvedValue([
                { detectedLanguage: 'es', confidence: 0.95 }
            ]);

            mockTranslator.translate
                .mockResolvedValueOnce('Introduction to Machine Learning') // Title translation
                .mockResolvedValueOnce('Machine learning is a branch of artificial intelligence that focuses on algorithms that can learn from data. It includes supervised, unsupervised, and reinforcement learning.'); // Content translation

            const result = await processor.createBilingualContent(mockContent, 'en');

            expect(result.original).toEqual(mockContent);
            expect(result.translated.id).toBe('test-content-1_en');
            expect(result.translated.title).toBe('Introduction to Machine Learning');
            expect(result.translated.content).toContain('Machine learning');
            expect(result.translated.metadata.language).toBe('en');
            expect(result.translationResult.success).toBe(true);
        });

        it('should handle translation failure in bilingual content', async () => {
            mockLanguageDetector.detect.mockRejectedValue(new Error('Detection failed'));
            mockTranslatorAPI.create.mockRejectedValue(new Error('Translation failed'));

            const result = await processor.createBilingualContent(mockContent, 'en');

            expect(result.original).toEqual(mockContent);
            expect(result.translated).toEqual(mockContent); // Should return original when translation fails
            expect(result.translationResult.success).toBe(false);
        });
    });

    describe('language support', () => {
        it('should return supported languages', () => {
            const supportedLanguages = processor.getSupportedLanguages();

            expect(supportedLanguages.has('en')).toBe(true);
            expect(supportedLanguages.has('es')).toBe(true);
            expect(supportedLanguages.has('fr')).toBe(true);
            expect(supportedLanguages.get('en')).toBe('English');
            expect(supportedLanguages.get('es')).toBe('Spanish');
        });

        it('should check language support correctly', () => {
            expect(processor.isLanguageSupported('en')).toBe(true);
            expect(processor.isLanguageSupported('es')).toBe(true);
            expect(processor.isLanguageSupported('xyz')).toBe(false);
        });

        it('should get language names correctly', () => {
            expect(processor.getLanguageName('en')).toBe('English');
            expect(processor.getLanguageName('es')).toBe('Spanish');
            expect(processor.getLanguageName('xyz')).toBe('xyz'); // Unknown language returns code
        });
    });

    describe('translation quality assessment', () => {
        it('should assess high quality translation', async () => {
            const originalText = 'El aprendizaje automático es importante.';
            const translatedText = 'Machine learning is important.';

            const quality = await processor.getTranslationQuality(
                originalText,
                translatedText,
                'es',
                'en'
            );

            expect(quality.quality).toBe('high');
            expect(quality.confidence).toBeGreaterThan(0.7);
            expect(quality.issues).toHaveLength(0);
        });

        it('should detect poor quality translation', async () => {
            const originalText = 'El aprendizaje automático es una rama importante de la inteligencia artificial.';
            const translatedText = 'ML'; // Too short

            const quality = await processor.getTranslationQuality(
                originalText,
                translatedText,
                'es',
                'en'
            );

            expect(quality.quality).toBe('low');
            expect(quality.confidence).toBeLessThan(0.4);
            expect(quality.issues.some(issue => issue.includes('too short'))).toBe(true);
        });

        it('should detect untranslated content', async () => {
            const originalText = 'El aprendizaje automático es importante.';
            const translatedText = 'El aprendizaje automático es importante.'; // Same as original

            const quality = await processor.getTranslationQuality(
                originalText,
                translatedText,
                'es',
                'en'
            );

            expect(quality.quality).toBe('low');
            expect(quality.issues.some(issue => issue.includes('No translation occurred'))).toBe(true);
        });
    });

    describe('cache management', () => {
        it('should clear all caches when requested', async () => {
            mockLanguageDetector.detect.mockResolvedValue([
                { detectedLanguage: 'es', confidence: 0.95 }
            ]);
            mockTranslator.translate.mockResolvedValue('Translated content');

            await processor.translateContent(mockContent, 'en');
            await processor.detectLanguage(mockContent);

            const cacheSize = processor.getCacheSize();
            expect(cacheSize.translations).toBeGreaterThan(0);
            expect(cacheSize.detections).toBeGreaterThan(0);

            processor.clearCache();

            const newCacheSize = processor.getCacheSize();
            expect(newCacheSize.translations).toBe(0);
            expect(newCacheSize.detections).toBe(0);
        });

        it('should report cache sizes correctly', async () => {
            mockLanguageDetector.detect.mockResolvedValue([
                { detectedLanguage: 'es', confidence: 0.95 }
            ]);
            mockTranslator.translate.mockResolvedValue('Translated content');

            const initialSize = processor.getCacheSize();
            expect(initialSize.translations).toBe(0);
            expect(initialSize.detections).toBe(0);

            await processor.translateContent(mockContent, 'en');

            const afterTranslation = processor.getCacheSize();
            expect(afterTranslation.translations).toBe(1);
            expect(afterTranslation.detections).toBe(1); // Language detection is also cached
        });
    });

    describe('API availability', () => {
        it('should correctly report API availability', () => {
            expect(processor.isAPIAvailable()).toBe(true);
        });
    });
});