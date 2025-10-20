// Summarizer API processor for content summaries

import { SummaryGenerationResult } from './types';
import { CapturedContent } from '../types/content';

export class SummarizerAPIProcessor {
    private static instance: SummarizerAPIProcessor;
    private isAvailable: boolean = false;
    private summaryCache: Map<string, SummaryGenerationResult> = new Map();

    private constructor() {
        this.checkAPIAvailability();
    }

    public static getInstance(): SummarizerAPIProcessor {
        if (!SummarizerAPIProcessor.instance) {
            SummarizerAPIProcessor.instance = new SummarizerAPIProcessor();
        }
        return SummarizerAPIProcessor.instance;
    }

    private async checkAPIAvailability(): Promise<void> {
        try {
            // Check if Chrome AI Summarizer API is available
            if ('ai' in window && 'summarizer' in (window as any).ai) {
                const capabilities = await (window as any).ai.summarizer.capabilities();
                this.isAvailable = capabilities.available === 'readily';
            } else {
                this.isAvailable = false;
            }
        } catch (error) {
            console.warn('Chrome AI Summarizer API not available:', error);
            this.isAvailable = false;
        }
    }

    public async generateSummaries(content: CapturedContent): Promise<SummaryGenerationResult> {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(content);

        // Check cache first
        const cached = this.summaryCache.get(cacheKey);
        if (cached) {
            return {
                ...cached,
                processingTime: Date.now() - startTime
            };
        }

        if (!this.isAvailable) {
            return {
                summaries: {
                    tldr: '',
                    quick: '',
                    detailed: ''
                },
                confidence: 0,
                processingTime: Date.now() - startTime,
                success: false,
                error: 'Chrome AI Summarizer API not available'
            };
        }

        try {
            const summaries = await this.generateThreeTierSummaries(content);
            const processingTime = Date.now() - startTime;

            const result: SummaryGenerationResult = {
                summaries,
                confidence: this.calculateSummaryConfidence(summaries, content),
                processingTime,
                success: true
            };

            // Cache the result
            this.summaryCache.set(cacheKey, result);

            return result;

        } catch (error) {
            const fallbackResult = await this.generateFallbackSummaries(content);

            return {
                summaries: fallbackResult,
                confidence: 0.3,
                processingTime: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during summary generation'
            };
        }
    }

    private async generateThreeTierSummaries(content: CapturedContent): Promise<{ tldr: string, quick: string, detailed: string }> {
        const contentText = this.prepareContentForSummarization(content);

        // Generate TL;DR (1 sentence)
        const tldr = await this.generateSummary(contentText, {
            type: 'tl;dr',
            format: 'plain-text',
            length: 'short'
        });

        // Generate Quick summary (2-3 sentences)
        const quick = await this.generateSummary(contentText, {
            type: 'key-points',
            format: 'plain-text',
            length: 'medium'
        });

        // Generate Detailed summary (1 paragraph)
        const detailed = await this.generateSummary(contentText, {
            type: 'headline',
            format: 'plain-text',
            length: 'long'
        });

        return {
            tldr: this.cleanSummary(tldr),
            quick: this.cleanSummary(quick),
            detailed: this.cleanSummary(detailed)
        };
    }

    private async generateSummary(content: string, options: any): Promise<string> {
        const summarizer = await (window as any).ai.summarizer.create(options);

        try {
            const summary = await summarizer.summarize(content);
            return summary;
        } finally {
            summarizer.destroy();
        }
    }

    private prepareContentForSummarization(content: CapturedContent): string {
        // Combine title and content for better context
        let text = `Title: ${content.title}\n\n${content.content}`;

        // Limit content length for API constraints (typically 4000-8000 chars)
        const maxLength = 6000;
        if (text.length > maxLength) {
            // Try to cut at sentence boundaries
            const truncated = text.substring(0, maxLength);
            const lastSentence = truncated.lastIndexOf('.');
            if (lastSentence > maxLength * 0.8) {
                text = truncated.substring(0, lastSentence + 1);
            } else {
                text = truncated + '...';
            }
        }

        return text;
    }

    private cleanSummary(summary: string): string {
        // Remove common artifacts and clean up the summary
        return summary
            .trim()
            .replace(/^(Summary:|TL;DR:|In summary,?|To summarize,?)\s*/i, '')
            .replace(/\s+/g, ' ')
            .replace(/\.{2,}/g, '.')
            .trim();
    }

    private calculateSummaryConfidence(summaries: { tldr: string, quick: string, detailed: string }, content: CapturedContent): number {
        let confidence = 0.5; // Base confidence

        // Check if summaries are reasonable lengths
        if (summaries.tldr.length > 10 && summaries.tldr.length < 200) {
            confidence += 0.1;
        }

        if (summaries.quick.length > 50 && summaries.quick.length < 500) {
            confidence += 0.1;
        }

        if (summaries.detailed.length > 100 && summaries.detailed.length < 1000) {
            confidence += 0.1;
        }

        // Check if summaries contain key terms from the original content
        const contentWords = content.content.toLowerCase().split(/\s+/);
        const importantWords = contentWords.filter(word =>
            word.length > 4 &&
            !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'would', 'could', 'should', 'there', 'where', 'when'].includes(word)
        );

        const allSummaries = `${summaries.tldr} ${summaries.quick} ${summaries.detailed}`.toLowerCase();
        const matchedWords = importantWords.filter(word => allSummaries.includes(word));

        if (matchedWords.length > importantWords.length * 0.1) {
            confidence += 0.2;
        }

        // Check content length appropriateness
        const originalLength = content.content.length;
        const summaryLength = summaries.detailed.length;
        const compressionRatio = summaryLength / originalLength;

        if (compressionRatio > 0.05 && compressionRatio < 0.3) {
            confidence += 0.1;
        }

        return Math.min(confidence, 1.0);
    }

    private async generateFallbackSummaries(content: CapturedContent): Promise<{ tldr: string, quick: string, detailed: string }> {
        // Simple extractive summarization as fallback
        const sentences = this.extractSentences(content.content);

        if (sentences.length === 0) {
            return {
                tldr: content.title,
                quick: content.title,
                detailed: content.title
            };
        }

        // Score sentences based on position, length, and keyword frequency
        const scoredSentences = sentences.map((sentence, index) => ({
            sentence,
            score: this.scoreSentence(sentence, index, sentences.length, content)
        })).sort((a, b) => b.score - a.score);

        // Generate summaries of different lengths
        const tldr = scoredSentences[0]?.sentence || content.title;

        const quick = scoredSentences
            .slice(0, Math.min(3, scoredSentences.length))
            .map(s => s.sentence)
            .join(' ');

        const detailed = scoredSentences
            .slice(0, Math.min(5, scoredSentences.length))
            .map(s => s.sentence)
            .join(' ');

        return { tldr, quick, detailed };
    }

    private extractSentences(text: string): string[] {
        // Simple sentence splitting
        return text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 10 && s.length < 300)
            .slice(0, 20); // Limit to first 20 sentences
    }

    private scoreSentence(sentence: string, position: number, totalSentences: number, content: CapturedContent): number {
        let score = 0;

        // Position scoring (first and last sentences often important)
        if (position === 0) score += 0.3;
        if (position === totalSentences - 1) score += 0.2;
        if (position < totalSentences * 0.2) score += 0.1;

        // Length scoring (prefer medium-length sentences)
        const length = sentence.length;
        if (length > 50 && length < 200) score += 0.2;

        // Title word overlap
        const titleWords = content.title.toLowerCase().split(/\s+/);
        const sentenceWords = sentence.toLowerCase().split(/\s+/);
        const overlap = titleWords.filter(word => sentenceWords.includes(word)).length;
        score += (overlap / titleWords.length) * 0.3;

        // Keyword density (simple heuristic)
        const keywordPattern = /\b(important|key|main|primary|essential|significant|crucial|major)\b/i;
        if (keywordPattern.test(sentence)) score += 0.1;

        return score;
    }

    private generateCacheKey(content: CapturedContent): string {
        // Generate a cache key based on content hash
        const contentHash = this.simpleHash(content.content + content.title);
        return `summary_${content.id}_${contentHash}`;
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    public isAPIAvailable(): boolean {
        return this.isAvailable;
    }

    public clearCache(): void {
        this.summaryCache.clear();
    }

    public getCacheSize(): number {
        return this.summaryCache.size;
    }

    public async validateSummaryQuality(summaries: { tldr: string, quick: string, detailed: string }, originalContent: string): Promise<{ isValid: boolean, issues: string[] }> {
        const issues: string[] = [];

        // Check minimum lengths
        if (summaries.tldr.length < 10) {
            issues.push('TL;DR summary too short');
        }
        if (summaries.quick.length < 30) {
            issues.push('Quick summary too short');
        }
        if (summaries.detailed.length < 50) {
            issues.push('Detailed summary too short');
        }

        // Check maximum lengths
        if (summaries.tldr.length > 300) {
            issues.push('TL;DR summary too long');
        }
        if (summaries.quick.length > 800) {
            issues.push('Quick summary too long');
        }
        if (summaries.detailed.length > 1500) {
            issues.push('Detailed summary too long');
        }

        // Check for repetition
        if (summaries.tldr === summaries.quick || summaries.quick === summaries.detailed) {
            issues.push('Summaries are too similar');
        }

        // Check for meaningful content
        const meaningfulWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        const tldrWords = summaries.tldr.toLowerCase().split(/\s+/);
        const meaningfulCount = tldrWords.filter(word => !meaningfulWords.includes(word)).length;

        if (meaningfulCount < 3) {
            issues.push('TL;DR lacks meaningful content');
        }

        return {
            isValid: issues.length === 0,
            issues
        };
    }
}