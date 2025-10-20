// Translator API processor for multilingual support

import { TranslationResult } from './types';
import { CapturedContent } from '../types/content';

export class TranslatorAPIProcessor {
    private static instance: TranslatorAPIProcessor;
    private isAvailable: boolean = false;
    private translationCache: Map<string, TranslationResult> = new Map();
    private languageDetectionCache: Map<string, string> = new Map();

    // Common language codes and their names
    private readonly supportedLanguages = new Map([
        ['en', 'English'],
        ['es', 'Spanish'],
        ['fr', 'French'],
        ['de', 'German'],
        ['it', 'Italian'],
        ['pt', 'Portuguese'],
        ['ru', 'Russian'],
        ['ja', 'Japanese'],
        ['ko', 'Korean'],
        ['zh', 'Chinese'],
        ['ar', 'Arabic'],
        ['hi', 'Hindi'],
        ['nl', 'Dutch'],
        ['sv', 'Swedish'],
        ['no', 'Norwegian'],
        ['da', 'Danish'],
        ['fi', 'Finnish'],
        ['pl', 'Polish'],
        ['tr', 'Turkish'],
        ['th', 'Thai']
    ]);

    private constructor() {
        this.checkAPIAvailability();
    }

    public static getInstance(): TranslatorAPIProcessor {
        if (!TranslatorAPIProcessor.instance) {
            TranslatorAPIProcessor.instance = new TranslatorAPIProcessor();
        }
        return TranslatorAPIProcessor.instance;
    }

    private async checkAPIAvailability(): Promise<void> {
        try {
            // Check if Chrome AI Translator API is available
            if ('ai' in window && 'translator' in (window as any).ai) {
                const capabilities = await (window as any).ai.translator.capabilities();
                this.isAvailable = capabilities.available === 'readily';
            } else {
                this.isAvailable = false;
            }
        } catch (error) {
            console.warn('Chrome AI Translator API not available:', error);
            this.isAvailable = false;
        }
    }

    public async translateContent(
        content: CapturedContent,
        targetLanguage: string = 'en'
    ): Promise<TranslationResult> {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(content, targetLanguage);

        // Check cache first
        const cached = this.translationCache.get(cacheKey);
        if (cached) {
            return {
                ...cached,
                processingTime: Date.now() - startTime
            };
        }

        if (!this.isAvailable) {
            return {
                translatedContent: '',
                detectedLanguage: 'unknown',
                targetLanguage,
                confidence: 0,
                processingTime: Date.now() - startTime,
                success: false,
                error: 'Chrome AI Translator API not available'
            };
        }

        try {
            // Step 1: Detect source language
            const detectedLanguage = await this.detectLanguage(content);

            // Step 2: Check if translation is needed
            if (detectedLanguage === targetLanguage) {
                const result: TranslationResult = {
                    translatedContent: content.content,
                    detectedLanguage,
                    targetLanguage,
                    confidence: 1.0,
                    processingTime: Date.now() - startTime,
                    success: true
                };

                this.translationCache.set(cacheKey, result);
                return result;
            }

            // Step 3: Perform translation
            const translatedContent = await this.performTranslation(
                content.content,
                detectedLanguage,
                targetLanguage
            );

            const confidence = this.calculateTranslationConfidence(
                content.content,
                translatedContent,
                detectedLanguage,
                targetLanguage
            );

            const result: TranslationResult = {
                translatedContent,
                detectedLanguage,
                targetLanguage,
                confidence,
                processingTime: Date.now() - startTime,
                success: true
            };

            // Cache the result
            this.translationCache.set(cacheKey, result);

            return result;

        } catch (error) {
            return {
                translatedContent: '',
                detectedLanguage: 'unknown',
                targetLanguage,
                confidence: 0,
                processingTime: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during translation'
            };
        }
    }

    public async detectLanguage(content: CapturedContent): Promise<string> {
        const cacheKey = `detect_${this.simpleHash(content.content)}`;

        // Check cache first
        const cached = this.languageDetectionCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Use Chrome AI Language Detection API if available
            if ('ai' in window && 'languageDetector' in (window as any).ai) {
                const detector = await (window as any).ai.languageDetector.create();
                const results = await detector.detect(content.content);
                detector.destroy();

                if (results && results.length > 0) {
                    const detectedLanguage = results[0].detectedLanguage;
                    this.languageDetectionCache.set(cacheKey, detectedLanguage);
                    return detectedLanguage;
                }
            }

            // Fallback: Use simple heuristic detection
            const detectedLanguage = this.fallbackLanguageDetection(content);
            this.languageDetectionCache.set(cacheKey, detectedLanguage);
            return detectedLanguage;

        } catch (error) {
            // Use metadata language as fallback
            const fallbackLanguage = content.metadata.language || 'en';
            this.languageDetectionCache.set(cacheKey, fallbackLanguage);
            return fallbackLanguage;
        }
    }

    private async performTranslation(
        text: string,
        sourceLanguage: string,
        targetLanguage: string
    ): Promise<string> {
        // Split long text into chunks to handle API limits
        const chunks = this.splitTextIntoChunks(text, 2000);
        const translatedChunks: string[] = [];

        for (const chunk of chunks) {
            const translator = await (window as any).ai.translator.create({
                sourceLanguage,
                targetLanguage
            });

            try {
                const translatedChunk = await translator.translate(chunk);
                translatedChunks.push(translatedChunk);
            } finally {
                translator.destroy();
            }
        }

        return translatedChunks.join(' ');
    }

    private splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
        if (text.length <= maxChunkSize) {
            return [text];
        }

        const chunks: string[] = [];
        let currentChunk = '';

        // Split by sentences first
        const sentences = text.split(/[.!?]+/);

        for (const sentence of sentences) {
            const trimmedSentence = sentence.trim();
            if (!trimmedSentence) continue;

            const sentenceWithPunctuation = trimmedSentence + '.';

            if (currentChunk.length + sentenceWithPunctuation.length <= maxChunkSize) {
                currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunctuation;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);
                }

                // If single sentence is too long, split by words
                if (sentenceWithPunctuation.length > maxChunkSize) {
                    const wordChunks = this.splitByWords(sentenceWithPunctuation, maxChunkSize);
                    chunks.push(...wordChunks);
                    currentChunk = '';
                } else {
                    currentChunk = sentenceWithPunctuation;
                }
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    private splitByWords(text: string, maxChunkSize: number): string[] {
        const words = text.split(' ');
        const chunks: string[] = [];
        let currentChunk = '';

        for (const word of words) {
            if (currentChunk.length + word.length + 1 <= maxChunkSize) {
                currentChunk += (currentChunk ? ' ' : '') + word;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk);
                }
                currentChunk = word;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    private fallbackLanguageDetection(content: CapturedContent): string {
        const text = content.content.toLowerCase();

        // Simple character-based detection for common languages
        const patterns = [
            { lang: 'zh', pattern: /[\u4e00-\u9fff]/ }, // Chinese characters
            { lang: 'ja', pattern: /[\u3040-\u309f\u30a0-\u30ff]/ }, // Japanese hiragana/katakana
            { lang: 'ko', pattern: /[\uac00-\ud7af]/ }, // Korean
            { lang: 'ar', pattern: /[\u0600-\u06ff]/ }, // Arabic
            { lang: 'ru', pattern: /[\u0400-\u04ff]/ }, // Cyrillic
            { lang: 'th', pattern: /[\u0e00-\u0e7f]/ }, // Thai
            { lang: 'hi', pattern: /[\u0900-\u097f]/ }, // Devanagari
        ];

        for (const { lang, pattern } of patterns) {
            if (pattern.test(text)) {
                return lang;
            }
        }

        // Word-based detection for European languages
        const commonWords = [
            { lang: 'es', words: ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'una'] },
            { lang: 'fr', words: ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'son', 'une', 'sur', 'avec', 'ne', 'se'] },
            { lang: 'de', words: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als'] },
            { lang: 'it', words: ['il', 'di', 'che', 'e', 'la', 'per', 'un', 'in', 'con', 'del', 'da', 'a', 'al', 'le', 'si', 'dei', 'su', 'come', 'dalla', 'questo'] },
            { lang: 'pt', words: ['o', 'de', 'a', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as'] },
            { lang: 'nl', words: ['de', 'van', 'het', 'een', 'en', 'in', 'te', 'dat', 'op', 'voor', 'met', 'als', 'zijn', 'er', 'maar', 'om', 'door', 'over', 'ze', 'zich'] }
        ];

        const words = text.split(/\s+/);
        let bestMatch = { lang: 'en', score: 0 };

        for (const { lang, words: commonWordList } of commonWords) {
            const matches = words.filter(word => commonWordList.includes(word)).length;
            const score = matches / words.length;

            if (score > bestMatch.score && score > 0.02) { // At least 2% match
                bestMatch = { lang, score };
            }
        }

        return bestMatch.lang;
    }

    private calculateTranslationConfidence(
        originalText: string,
        translatedText: string,
        sourceLanguage: string,
        targetLanguage: string
    ): number {
        let confidence = 0.5; // Base confidence

        // Check if translation is reasonable length
        const lengthRatio = translatedText.length / originalText.length;
        if (lengthRatio > 0.3 && lengthRatio < 3.0) {
            confidence += 0.2;
        }

        // Check if translation contains meaningful content
        const meaningfulWords = translatedText.split(/\s+/).filter(word => word.length > 2);
        if (meaningfulWords.length > originalText.split(/\s+/).length * 0.3) {
            confidence += 0.2;
        }

        // Bonus for well-supported language pairs
        const wellSupportedPairs = [
            ['en', 'es'], ['en', 'fr'], ['en', 'de'], ['en', 'it'], ['en', 'pt'],
            ['es', 'en'], ['fr', 'en'], ['de', 'en'], ['it', 'en'], ['pt', 'en']
        ];

        if (wellSupportedPairs.some(([src, tgt]) => src === sourceLanguage && tgt === targetLanguage)) {
            confidence += 0.1;
        }

        return Math.min(confidence, 1.0);
    }

    public async createBilingualContent(content: CapturedContent, targetLanguage: string = 'en'): Promise<{
        original: CapturedContent;
        translated: CapturedContent;
        translationResult: TranslationResult;
    }> {
        const translationResult = await this.translateContent(content, targetLanguage);

        if (!translationResult.success) {
            return {
                original: content,
                translated: content,
                translationResult
            };
        }

        // Create translated version of content
        const translatedContent: CapturedContent = {
            ...content,
            id: `${content.id}_${targetLanguage}`,
            title: await this.translateText(content.title, translationResult.detectedLanguage, targetLanguage),
            content: translationResult.translatedContent,
            metadata: {
                ...content.metadata,
                language: targetLanguage
            }
        };

        return {
            original: content,
            translated: translatedContent,
            translationResult
        };
    }

    private async translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
        if (sourceLanguage === targetLanguage) {
            return text;
        }

        try {
            const translator = await (window as any).ai.translator.create({
                sourceLanguage,
                targetLanguage
            });

            const translated = await translator.translate(text);
            translator.destroy();

            return translated;
        } catch (error) {
            return text; // Return original if translation fails
        }
    }

    public getSupportedLanguages(): Map<string, string> {
        return new Map(this.supportedLanguages);
    }

    public isLanguageSupported(languageCode: string): boolean {
        return this.supportedLanguages.has(languageCode);
    }

    public getLanguageName(languageCode: string): string {
        return this.supportedLanguages.get(languageCode) || languageCode;
    }

    private generateCacheKey(content: CapturedContent, targetLanguage: string): string {
        const contentHash = this.simpleHash(content.content);
        return `translation_${content.id}_${contentHash}_${targetLanguage}`;
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    public isAPIAvailable(): boolean {
        return this.isAvailable;
    }

    public clearCache(): void {
        this.translationCache.clear();
        this.languageDetectionCache.clear();
    }

    public getCacheSize(): { translations: number; detections: number } {
        return {
            translations: this.translationCache.size,
            detections: this.languageDetectionCache.size
        };
    }

    public async getTranslationQuality(
        originalText: string,
        translatedText: string,
        sourceLanguage: string,
        targetLanguage: string
    ): Promise<{
        quality: 'high' | 'medium' | 'low';
        confidence: number;
        issues: string[];
    }> {
        const issues: string[] = [];
        let confidence = this.calculateTranslationConfidence(
            originalText,
            translatedText,
            sourceLanguage,
            targetLanguage
        );

        // Check for common translation issues
        if (translatedText.length < originalText.length * 0.3) {
            issues.push('Translation appears too short');
            confidence -= 0.2;
        }

        if (translatedText.length > originalText.length * 3) {
            issues.push('Translation appears too long');
            confidence -= 0.1;
        }

        if (translatedText === originalText && sourceLanguage !== targetLanguage) {
            issues.push('No translation occurred');
            confidence = 0.1;
        }

        // Check for untranslated segments (common in failed translations)
        const originalWords = originalText.toLowerCase().split(/\s+/);
        const translatedWords = translatedText.toLowerCase().split(/\s+/);
        const untranslatedCount = originalWords.filter(word =>
            word.length > 4 && translatedWords.includes(word)
        ).length;

        if (untranslatedCount > originalWords.length * 0.3) {
            issues.push('Many words appear untranslated');
            confidence -= 0.2;
        }

        confidence = Math.max(0, Math.min(1, confidence));

        let quality: 'high' | 'medium' | 'low';
        if (confidence >= 0.7) {
            quality = 'high';
        } else if (confidence >= 0.4) {
            quality = 'medium';
        } else {
            quality = 'low';
        }

        return { quality, confidence, issues };
    }
}