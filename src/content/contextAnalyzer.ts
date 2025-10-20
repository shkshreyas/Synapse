// Context analysis for current browsing to enable smart content resurfacing

import { contentExtractor } from './contentExtractor.js';
import { metadataCollector } from './metadataCollector.js';
import { ExtractedContent, PageMetadata } from '../types/content.js';
import { StoredContent } from '../types/storage.js';

export interface BrowsingContext {
    url: string;
    title: string;
    content: string;
    metadata: PageMetadata;
    extractedKeywords: string[];
    concepts: string[];
    category: string;
    timestamp: Date;
    confidence: number;
}

export interface RelevanceMatch {
    contentId: string;
    relevanceScore: number;
    matchReasons: string[];
    suggestedTiming: 'immediate' | 'delayed' | 'background';
    priority: 'high' | 'medium' | 'low';
}

export interface ContextAnalysisResult {
    context: BrowsingContext;
    relevantContent: RelevanceMatch[];
    processingTime: number;
    success: boolean;
    error?: string;
}

export interface ContextAnalysisOptions {
    enableKeywordExtraction: boolean;
    enableConceptExtraction: boolean;
    enableCategoryDetection: boolean;
    minRelevanceThreshold: number;
    maxSuggestions: number;
    includeRecentContent: boolean;
    recentContentDays: number;
}

export class ContextAnalyzer {
    private readonly defaultOptions: ContextAnalysisOptions = {
        enableKeywordExtraction: true,
        enableConceptExtraction: true,
        enableCategoryDetection: true,
        minRelevanceThreshold: 0.3,
        maxSuggestions: 5,
        includeRecentContent: true,
        recentContentDays: 30
    };

    /**
     * Analyzes the current browsing context and finds relevant saved content
     */
    async analyzeCurrentContext(
        savedContent: StoredContent[],
        options: Partial<ContextAnalysisOptions> = {}
    ): Promise<ContextAnalysisResult> {
        const startTime = performance.now();
        const config = { ...this.defaultOptions, ...options };

        try {
            // Extract current page context
            const context = await this.extractCurrentContext(config);

            // Find relevant content matches
            const relevantContent = await this.findRelevantContent(
                context,
                savedContent,
                config
            );

            return {
                context,
                relevantContent,
                processingTime: performance.now() - startTime,
                success: true
            };
        } catch (error) {
            return {
                context: this.createEmptyContext(),
                relevantContent: [],
                processingTime: performance.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Extracts context from the current webpage
     */
    private async extractCurrentContext(
        options: ContextAnalysisOptions
    ): Promise<BrowsingContext> {
        // Extract content using existing extractor
        const extractionResult = await contentExtractor.extractContent({
            includeImages: false,
            includeLinks: true,
            includeHeadings: true,
            minContentLength: 50
        });

        if (!extractionResult.success || !extractionResult.content) {
            throw new Error('Failed to extract page content');
        }

        const extracted = extractionResult.content;
        const metadata = metadataCollector.collectMetadata(extracted.mainContent);

        // Extract keywords from content
        const keywords = options.enableKeywordExtraction
            ? this.extractKeywords(extracted.mainContent, extracted.headings)
            : [];

        // Extract concepts (simplified implementation)
        const concepts = options.enableConceptExtraction
            ? await this.extractConcepts(extracted.mainContent, keywords)
            : [];

        // Detect category
        const category = options.enableCategoryDetection
            ? this.detectContentCategory(extracted, metadata, concepts)
            : 'other';

        return {
            url: window.location.href,
            title: extracted.title,
            content: extracted.mainContent,
            metadata,
            extractedKeywords: keywords,
            concepts,
            category,
            timestamp: new Date(),
            confidence: extractionResult.confidence
        };
    }

    /**
     * Extracts keywords from content and headings
     */
    private extractKeywords(content: string, headings: any[]): string[] {
        const text = content + ' ' + headings.map(h => h.text).join(' ');

        // Simple keyword extraction using TF-IDF-like approach
        const words = this.tokenizeText(text);
        const wordFreq = this.calculateWordFrequency(words);

        // Filter and rank keywords
        const keywords = Object.entries(wordFreq)
            .filter(([word, freq]) => {
                return word.length > 3 &&
                    freq > 1 &&
                    !this.isStopWord(word) &&
                    this.isSignificantWord(word);
            })
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([word]) => word);

        return keywords;
    }

    /**
     * Extracts concepts from content (simplified implementation)
     */
    private async extractConcepts(content: string, keywords: string[]): Promise<string[]> {
        // In a full implementation, this would use Chrome's Prompt API
        // For now, we'll use a simplified approach based on keywords and patterns

        const concepts: string[] = [];

        // Technical concepts
        const techPatterns = [
            /\b(API|REST|GraphQL|database|algorithm|framework|library|SDK)\b/gi,
            /\b(JavaScript|Python|React|Node\.js|TypeScript|HTML|CSS)\b/gi,
            /\b(machine learning|AI|neural network|deep learning)\b/gi
        ];

        // Business concepts
        const businessPatterns = [
            /\b(strategy|marketing|sales|revenue|growth|customer)\b/gi,
            /\b(product|service|business model|startup|enterprise)\b/gi
        ];

        // Academic concepts
        const academicPatterns = [
            /\b(research|study|analysis|methodology|hypothesis|theory)\b/gi,
            /\b(education|learning|teaching|curriculum|assessment)\b/gi
        ];

        const allPatterns = [...techPatterns, ...businessPatterns, ...academicPatterns];

        for (const pattern of allPatterns) {
            const matches = content.match(pattern);
            if (matches) {
                concepts.push(...matches.map(m => m.toLowerCase()));
            }
        }

        // Add significant keywords as concepts
        concepts.push(...keywords.slice(0, 10));

        // Remove duplicates and return
        return [...new Set(concepts)].slice(0, 15);
    }

    /**
     * Detects content category based on various signals
     */
    private detectContentCategory(
        extracted: ExtractedContent,
        metadata: PageMetadata,
        concepts: string[]
    ): string {
        const url = window.location.href.toLowerCase();
        const content = extracted.mainContent.toLowerCase();

        // Check for documentation indicators first (more specific)
        if (content.includes('api documentation') || content.includes('documentation guide') ||
            content.includes('developers') || content.includes('authentication') ||
            url.includes('docs') || url.includes('documentation') ||
            metadata.pageType === 'documentation') {
            return 'documentation';
        }

        // Use existing page type as base
        if (metadata.pageType !== 'other') {
            return metadata.pageType;
        }

        // Check for specific domains/patterns
        if (url.includes('github.com') || url.includes('stackoverflow.com')) {
            return 'documentation';
        }

        if (url.includes('news.') || url.includes('/news/') || url.includes('blog')) {
            return 'article';
        }

        // Check concepts for category hints
        const techConcepts = concepts.filter(c =>
            ['api', 'code', 'programming', 'software', 'development'].some(tech =>
                c.includes(tech)
            )
        );

        if (techConcepts.length > 2) {
            return 'documentation';
        }

        // Check content patterns
        if (content.includes('tutorial') || content.includes('how to') ||
            content.includes('guide') || content.includes('step')) {
            return 'documentation';
        }

        if (content.includes('research') || content.includes('study') ||
            content.includes('analysis')) {
            return 'article';
        }

        return 'other';
    }

    /**
     * Finds relevant saved content based on current context
     */
    private async findRelevantContent(
        context: BrowsingContext,
        savedContent: StoredContent[],
        options: ContextAnalysisOptions
    ): Promise<RelevanceMatch[]> {
        const matches: RelevanceMatch[] = [];

        // Filter recent content if enabled
        let candidateContent = savedContent;
        if (options.includeRecentContent) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - options.recentContentDays);
            candidateContent = savedContent.filter(c => c.timestamp >= cutoffDate);
        }

        for (const content of candidateContent) {
            const relevanceScore = await this.calculateRelevanceScore(context, content);

            if (relevanceScore.score >= options.minRelevanceThreshold) {
                matches.push({
                    contentId: content.id,
                    relevanceScore: relevanceScore.score,
                    matchReasons: relevanceScore.reasons,
                    suggestedTiming: this.determineSuggestedTiming(relevanceScore.score),
                    priority: this.determinePriority(relevanceScore.score, content)
                });
            }
        }

        // Sort by relevance score and limit results
        return matches
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, options.maxSuggestions);
    }

    /**
     * Calculates relevance score between current context and saved content
     */
    private async calculateRelevanceScore(
        context: BrowsingContext,
        content: StoredContent
    ): Promise<{ score: number; reasons: string[] }> {
        const reasons: string[] = [];
        let totalScore = 0;
        let weightSum = 0;

        // URL similarity (weight: 0.15)
        const urlWeight = 0.15;
        const urlScore = this.calculateUrlSimilarity(context.url, content.url);
        totalScore += urlScore * urlWeight;
        weightSum += urlWeight;

        if (urlScore > 0.5) {
            reasons.push('Similar website or domain');
        }

        // Category matching (weight: 0.2)
        const categoryWeight = 0.2;
        const categoryScore = context.category === content.category ? 1 : 0;
        totalScore += categoryScore * categoryWeight;
        weightSum += categoryWeight;

        if (categoryScore > 0) {
            reasons.push(`Same category: ${context.category}`);
        }

        // Keyword overlap (weight: 0.25)
        const keywordWeight = 0.25;
        const keywordScore = this.calculateKeywordOverlap(
            context.extractedKeywords,
            content.tags || []
        );
        totalScore += keywordScore * keywordWeight;
        weightSum += keywordWeight;

        if (keywordScore > 0.3) {
            reasons.push('Shared keywords and topics');
        }

        // Concept overlap (weight: 0.25)
        const conceptWeight = 0.25;
        const conceptScore = this.calculateConceptOverlap(
            context.concepts,
            content.concepts || []
        );
        totalScore += conceptScore * conceptWeight;
        weightSum += conceptWeight;

        if (conceptScore > 0.3) {
            reasons.push('Related concepts and themes');
        }

        // Content similarity (weight: 0.15)
        const contentWeight = 0.15;
        const contentScore = this.calculateContentSimilarity(
            context.content,
            content.content
        );
        totalScore += contentScore * contentWeight;
        weightSum += contentWeight;

        if (contentScore > 0.4) {
            reasons.push('Similar content themes');
        }

        // Normalize score
        const finalScore = weightSum > 0 ? totalScore / weightSum : 0;

        return {
            score: Math.round(finalScore * 100) / 100,
            reasons
        };
    }

    /**
     * Calculates URL similarity (same domain, similar path)
     */
    private calculateUrlSimilarity(url1: string, url2: string): number {
        try {
            const parsed1 = new URL(url1);
            const parsed2 = new URL(url2);

            // Same domain gets high score
            if (parsed1.hostname === parsed2.hostname) {
                return 0.8;
            }

            // Similar domain (subdomain or similar name)
            const domain1 = parsed1.hostname.split('.').slice(-2).join('.');
            const domain2 = parsed2.hostname.split('.').slice(-2).join('.');

            if (domain1 === domain2) {
                return 0.6;
            }

            // Similar path structure
            const path1 = parsed1.pathname.split('/').filter(p => p.length > 0);
            const path2 = parsed2.pathname.split('/').filter(p => p.length > 0);

            if (path1.length > 0 && path2.length > 0) {
                const commonPaths = path1.filter(p => path2.includes(p));
                const pathSimilarity = commonPaths.length / Math.max(path1.length, path2.length);
                return pathSimilarity * 0.4;
            }

            return 0;
        } catch {
            return 0;
        }
    }

    /**
     * Calculates keyword overlap using Jaccard similarity
     */
    private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
        if (keywords1.length === 0 && keywords2.length === 0) return 0;

        const set1 = new Set(keywords1.map(k => k.toLowerCase()));
        const set2 = new Set(keywords2.map(k => k.toLowerCase()));

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    /**
     * Calculates concept overlap using Jaccard similarity
     */
    private calculateConceptOverlap(concepts1: string[], concepts2: string[]): number {
        if (concepts1.length === 0 && concepts2.length === 0) return 0;

        const set1 = new Set(concepts1.map(c => c.toLowerCase()));
        const set2 = new Set(concepts2.map(c => c.toLowerCase()));

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    /**
     * Calculates content similarity using word overlap
     */
    private calculateContentSimilarity(content1: string, content2: string): number {
        const words1 = this.extractSignificantWords(content1);
        const words2 = this.extractSignificantWords(content2);

        if (words1.length === 0 && words2.length === 0) return 0;

        const set1 = new Set(words1);
        const set2 = new Set(words2);

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    /**
     * Determines suggested timing for content resurfacing
     */
    private determineSuggestedTiming(relevanceScore: number): RelevanceMatch['suggestedTiming'] {
        if (relevanceScore > 0.7) {
            return 'immediate';
        } else if (relevanceScore > 0.5) {
            return 'delayed';
        } else {
            return 'background';
        }
    }

    /**
     * Determines priority based on relevance and content properties
     */
    private determinePriority(
        relevanceScore: number,
        content: StoredContent
    ): RelevanceMatch['priority'] {
        let priority: RelevanceMatch['priority'] = 'low';

        // Base priority on relevance score
        if (relevanceScore > 0.7) {
            priority = 'high';
        } else if (relevanceScore > 0.5) {
            priority = 'medium';
        }

        // Boost priority for important or frequently accessed content
        if (content.importance && content.importance > 7) {
            priority = priority === 'low' ? 'medium' : 'high';
        }

        if (content.timesAccessed > 5) {
            priority = priority === 'low' ? 'medium' : priority;
        }

        return priority;
    }

    // Utility methods
    private tokenizeText(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0);
    }

    private calculateWordFrequency(words: string[]): Record<string, number> {
        const freq: Record<string, number> = {};
        for (const word of words) {
            freq[word] = (freq[word] || 0) + 1;
        }
        return freq;
    }

    private isStopWord(word: string): boolean {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
            'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
        ]);
        return stopWords.has(word.toLowerCase());
    }

    private isSignificantWord(word: string): boolean {
        // Check if word contains meaningful content
        return /^[a-zA-Z]+$/.test(word) && word.length > 2;
    }

    private extractSignificantWords(text: string): string[] {
        return this.tokenizeText(text)
            .filter(word => word.length > 3 && !this.isStopWord(word))
            .slice(0, 100);
    }

    private createEmptyContext(): BrowsingContext {
        return {
            url: window.location.href,
            title: document.title || 'Untitled',
            content: '',
            metadata: {
                readingTime: 0,
                pageType: 'other',
                language: 'en',
                wordCount: 0,
                imageCount: 0,
                linkCount: 0
            },
            extractedKeywords: [],
            concepts: [],
            category: 'other',
            timestamp: new Date(),
            confidence: 0
        };
    }
}

// Export singleton instance
export const contextAnalyzer = new ContextAnalyzer();