// Advanced search ranking algorithms for MindScribe

import { StoredContent, SearchableMetadata } from '../types/storage';
import { ScoredSearchResult } from './searchIndex';

export interface RankingFactors {
    textRelevance: number;
    titleMatch: number;
    exactMatch: number;
    tagMatch: number;
    conceptMatch: number;
    recency: number;
    importance: number;
    userEngagement: number;
    contentQuality: number;
    semanticSimilarity: number;
}

export interface RankingWeights {
    textRelevance: number;
    titleMatch: number;
    exactMatch: number;
    tagMatch: number;
    conceptMatch: number;
    recency: number;
    importance: number;
    userEngagement: number;
    contentQuality: number;
    semanticSimilarity: number;
}

export class SearchRanking {
    private static instance: SearchRanking | null = null;
    private readonly defaultWeights: RankingWeights;

    constructor() {
        this.defaultWeights = {
            textRelevance: 1.0,
            titleMatch: 2.0,
            exactMatch: 1.5,
            tagMatch: 1.3,
            conceptMatch: 1.2,
            recency: 0.3,
            importance: 0.8,
            userEngagement: 0.6,
            contentQuality: 0.4,
            semanticSimilarity: 0.9
        };
    }

    static getInstance(): SearchRanking {
        if (!SearchRanking.instance) {
            SearchRanking.instance = new SearchRanking();
        }
        return SearchRanking.instance;
    }

    calculateRelevanceScore(
        content: StoredContent,
        searchTerms: string[],
        weights?: Partial<RankingWeights>
    ): number {
        const finalWeights = { ...this.defaultWeights, ...weights };
        const factors = this.calculateRankingFactors(content, searchTerms);

        let totalScore = 0;
        let totalWeight = 0;

        for (const [factor, value] of Object.entries(factors)) {
            const weight = finalWeights[factor as keyof RankingWeights];
            totalScore += value * weight;
            totalWeight += weight;
        }

        // Normalize score to 0-100 range
        return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
    }

    private calculateRankingFactors(content: StoredContent, searchTerms: string[]): RankingFactors {
        return {
            textRelevance: this.calculateTextRelevance(content, searchTerms),
            titleMatch: this.calculateTitleMatch(content, searchTerms),
            exactMatch: this.calculateExactMatch(content, searchTerms),
            tagMatch: this.calculateTagMatch(content, searchTerms),
            conceptMatch: this.calculateConceptMatch(content, searchTerms),
            recency: this.calculateRecencyScore(content),
            importance: this.calculateImportanceScore(content),
            userEngagement: this.calculateUserEngagementScore(content),
            contentQuality: this.calculateContentQualityScore(content),
            semanticSimilarity: this.calculateSemanticSimilarity(content, searchTerms)
        };
    }

    private calculateTextRelevance(content: StoredContent, searchTerms: string[]): number {
        const contentText = (content.title + ' ' + content.content).toLowerCase();
        const totalWords = contentText.split(/\s+/).length;
        let matchCount = 0;
        let totalTermFrequency = 0;

        for (const term of searchTerms) {
            const termLower = term.toLowerCase();
            const matches = (contentText.match(new RegExp(termLower, 'g')) || []).length;

            if (matches > 0) {
                matchCount++;
                // TF-IDF inspired scoring
                const termFrequency = matches / totalWords;
                totalTermFrequency += termFrequency;
            }
        }

        if (searchTerms.length === 0) return 0;

        // Combine term coverage and frequency
        const coverage = matchCount / searchTerms.length;
        const avgFrequency = totalTermFrequency / searchTerms.length;

        return (coverage * 0.7 + avgFrequency * 0.3) * 100;
    }

    private calculateTitleMatch(content: StoredContent, searchTerms: string[]): number {
        const titleLower = content.title.toLowerCase();
        let matchScore = 0;

        for (const term of searchTerms) {
            const termLower = term.toLowerCase();

            if (titleLower === termLower) {
                matchScore += 100; // Exact title match
            } else if (titleLower.includes(termLower)) {
                // Partial match with position bonus
                const position = titleLower.indexOf(termLower);
                const positionBonus = Math.max(0, 50 - position * 2); // Earlier positions get higher scores
                matchScore += 50 + positionBonus;
            }
        }

        return Math.min(100, matchScore / searchTerms.length);
    }

    private calculateExactMatch(content: StoredContent, searchTerms: string[]): number {
        const fullText = (content.title + ' ' + content.content).toLowerCase();
        const searchPhrase = searchTerms.join(' ').toLowerCase();

        if (fullText.includes(searchPhrase)) {
            // Bonus for exact phrase match
            const titleMatch = content.title.toLowerCase().includes(searchPhrase);
            return titleMatch ? 100 : 75;
        }

        // Check for exact word matches
        let exactMatches = 0;
        for (const term of searchTerms) {
            const wordBoundaryRegex = new RegExp(`\\b${term.toLowerCase()}\\b`);
            if (wordBoundaryRegex.test(fullText)) {
                exactMatches++;
            }
        }

        return (exactMatches / searchTerms.length) * 50;
    }

    private calculateTagMatch(content: StoredContent, searchTerms: string[]): number {
        if (!content.tags || content.tags.length === 0) return 0;

        const tagsLower = content.tags.map(tag => tag.toLowerCase());
        let matchScore = 0;

        for (const term of searchTerms) {
            const termLower = term.toLowerCase();

            for (const tag of tagsLower) {
                if (tag === termLower) {
                    matchScore += 100; // Exact tag match
                } else if (tag.includes(termLower) || termLower.includes(tag)) {
                    matchScore += 50; // Partial tag match
                }
            }
        }

        return Math.min(100, matchScore / searchTerms.length);
    }

    private calculateConceptMatch(content: StoredContent, searchTerms: string[]): number {
        if (!content.concepts || content.concepts.length === 0) return 0;

        const conceptsLower = content.concepts.map(concept => concept.toLowerCase());
        let matchScore = 0;

        for (const term of searchTerms) {
            const termLower = term.toLowerCase();

            for (const concept of conceptsLower) {
                if (concept === termLower) {
                    matchScore += 100; // Exact concept match
                } else if (concept.includes(termLower) || termLower.includes(concept)) {
                    matchScore += 60; // Partial concept match
                }
            }
        }

        return Math.min(100, matchScore / searchTerms.length);
    }

    private calculateRecencyScore(content: StoredContent): number {
        const now = Date.now();
        const contentTime = content.timestamp.getTime();
        const daysSinceCreation = (now - contentTime) / (1000 * 60 * 60 * 24);

        // Exponential decay: newer content gets higher scores
        if (daysSinceCreation <= 1) return 100;
        if (daysSinceCreation <= 7) return 90;
        if (daysSinceCreation <= 30) return 70;
        if (daysSinceCreation <= 90) return 50;
        if (daysSinceCreation <= 365) return 30;

        return Math.max(10, 30 - (daysSinceCreation - 365) * 0.1);
    }

    private calculateImportanceScore(content: StoredContent): number {
        if (!content.importance) return 50; // Default middle score

        // Convert 1-10 scale to 0-100 scale
        return (content.importance / 10) * 100;
    }

    private calculateUserEngagementScore(content: StoredContent): number {
        const accessCount = content.timesAccessed;
        const daysSinceLastAccess = (Date.now() - content.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);

        // Base score from access count
        let score = Math.min(80, accessCount * 10);

        // Recency of access bonus
        if (daysSinceLastAccess <= 1) score += 20;
        else if (daysSinceLastAccess <= 7) score += 15;
        else if (daysSinceLastAccess <= 30) score += 10;
        else if (daysSinceLastAccess <= 90) score += 5;

        // User rating bonus
        if (content.userRating) {
            score += (content.userRating / 5) * 20;
        }

        // User notes bonus
        if (content.userNotes && content.userNotes.trim().length > 0) {
            score += 10;
        }

        return Math.min(100, score);
    }

    private calculateContentQualityScore(content: StoredContent): number {
        let score = 50; // Base score

        // Content length factor
        const contentLength = content.content.length;
        if (contentLength > 5000) score += 20;
        else if (contentLength > 2000) score += 15;
        else if (contentLength > 1000) score += 10;
        else if (contentLength > 500) score += 5;
        else if (contentLength < 100) score -= 20;

        // Metadata completeness
        const metadata = content.metadata;
        if (metadata.author) score += 5;
        if (metadata.publishDate) score += 5;
        if (metadata.description) score += 5;
        if (metadata.keywords && metadata.keywords.length > 0) score += 5;

        // AI processing completeness
        if (content.summaries) score += 10;
        if (content.tags && content.tags.length > 0) score += 5;
        if (content.concepts && content.concepts.length > 0) score += 5;
        if (content.category) score += 5;

        // Reading time reasonableness
        const expectedReadingTime = Math.ceil(metadata.wordCount / 200); // ~200 words per minute
        const actualReadingTime = metadata.readingTime;
        const readingTimeRatio = Math.abs(expectedReadingTime - actualReadingTime) / expectedReadingTime;

        if (readingTimeRatio < 0.2) score += 5; // Reading time is reasonable
        else if (readingTimeRatio > 1) score -= 10; // Reading time seems off

        return Math.min(100, Math.max(0, score));
    }

    private calculateSemanticSimilarity(content: StoredContent, searchTerms: string[]): number {
        // Simplified semantic similarity based on word co-occurrence and context
        // In a full implementation, this would use embeddings or more sophisticated NLP

        const contentWords = this.extractSignificantWords(content.title + ' ' + content.content);
        const searchWords = searchTerms.map(term => term.toLowerCase());

        let similarityScore = 0;

        // Check for related words and synonyms (simplified)
        const synonymMap = this.getSimpleSynonymMap();

        for (const searchWord of searchWords) {
            const synonyms = synonymMap.get(searchWord) || [];

            // Direct word match
            if (contentWords.has(searchWord)) {
                similarityScore += 50;
                continue;
            }

            // Synonym match
            let synonymMatch = false;
            for (const synonym of synonyms) {
                if (contentWords.has(synonym)) {
                    similarityScore += 30;
                    synonymMatch = true;
                    break;
                }
            }

            if (synonymMatch) continue;

            // Partial word match (for compound words, etc.)
            for (const contentWord of contentWords) {
                if (contentWord.includes(searchWord) || searchWord.includes(contentWord)) {
                    if (Math.abs(contentWord.length - searchWord.length) <= 3) {
                        similarityScore += 20;
                        break;
                    }
                }
            }
        }

        return Math.min(100, similarityScore / searchTerms.length);
    }

    private extractSignificantWords(text: string): Set<string> {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
            'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
        ]);

        return new Set(
            text
                .toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 2 && !stopWords.has(word))
        );
    }

    private getSimpleSynonymMap(): Map<string, string[]> {
        // Simplified synonym mapping - in production, this would be more comprehensive
        return new Map([
            ['learn', ['study', 'education', 'knowledge', 'understand']],
            ['code', ['programming', 'development', 'software', 'coding']],
            ['article', ['post', 'blog', 'content', 'text']],
            ['tutorial', ['guide', 'howto', 'instruction', 'lesson']],
            ['research', ['study', 'analysis', 'investigation', 'paper']],
            ['technology', ['tech', 'technical', 'digital', 'computer']],
            ['design', ['ui', 'ux', 'interface', 'visual']],
            ['data', ['information', 'dataset', 'analytics', 'statistics']],
            ['web', ['website', 'internet', 'online', 'browser']],
            ['mobile', ['phone', 'app', 'application', 'smartphone']]
        ]);
    }

    // Method to adjust ranking weights based on user behavior
    adaptWeights(userFeedback: UserFeedback[]): RankingWeights {
        const adaptedWeights = { ...this.defaultWeights };

        // Analyze user feedback to adjust weights
        for (const feedback of userFeedback) {
            if (feedback.action === 'click' && feedback.position > 5) {
                // User clicked on lower-ranked results, might need to adjust weights
                if (feedback.resultMetadata.hadTitleMatch) {
                    adaptedWeights.titleMatch *= 0.95; // Slightly reduce title match weight
                }
                if (feedback.resultMetadata.hadTagMatch) {
                    adaptedWeights.tagMatch *= 1.05; // Slightly increase tag match weight
                }
            }

            if (feedback.action === 'ignore' && feedback.position <= 3) {
                // User ignored high-ranked results, might be over-weighted
                if (feedback.resultMetadata.hadExactMatch) {
                    adaptedWeights.exactMatch *= 0.98;
                }
            }
        }

        return adaptedWeights;
    }
}

export interface UserFeedback {
    query: string;
    resultId: string;
    position: number;
    action: 'click' | 'ignore' | 'bookmark' | 'share';
    timestamp: Date;
    resultMetadata: {
        hadTitleMatch: boolean;
        hadExactMatch: boolean;
        hadTagMatch: boolean;
        hadConceptMatch: boolean;
        relevanceScore: number;
    };
}