// Advanced search result ranking and relevance scoring

import { StoredContent } from '../types/storage';
import { SemanticMatch, QueryIntent } from './naturalLanguageSearch';

export interface RankingFactors {
    keywordRelevance: number;
    semanticRelevance: number;
    contentQuality: number;
    userEngagement: number;
    recency: number;
    authority: number;
    personalRelevance: number;
}

export interface RankingWeights {
    keywordRelevance: number;
    semanticRelevance: number;
    contentQuality: number;
    userEngagement: number;
    recency: number;
    authority: number;
    personalRelevance: number;
}

export interface UserPreferences {
    preferredContentTypes: string[];
    preferredLanguages: string[];
    topicInterests: Map<string, number>; // topic -> interest score (0-1)
    authorPreferences: Map<string, number>; // author -> preference score (0-1)
    recentSearchPatterns: string[];
}

export class SearchRanking {
    private static instance: SearchRanking | null = null;
    private defaultWeights: RankingWeights;
    private userPreferences: UserPreferences;

    constructor() {
        this.defaultWeights = {
            keywordRelevance: 0.25,
            semanticRelevance: 0.20,
            contentQuality: 0.15,
            userEngagement: 0.15,
            recency: 0.10,
            authority: 0.10,
            personalRelevance: 0.05
        };

        this.userPreferences = {
            preferredContentTypes: [],
            preferredLanguages: ['en'],
            topicInterests: new Map(),
            authorPreferences: new Map(),
            recentSearchPatterns: []
        };

        this.loadUserPreferences();
    }

    static getInstance(): SearchRanking {
        if (!SearchRanking.instance) {
            SearchRanking.instance = new SearchRanking();
        }
        return SearchRanking.instance;
    }

    rankSearchResults(
        results: SemanticMatch[],
        query: string,
        intent: QueryIntent,
        customWeights?: Partial<RankingWeights>
    ): SemanticMatch[] {
        const weights = { ...this.defaultWeights, ...customWeights };

        // Calculate ranking factors for each result
        const rankedResults = results.map(result => {
            const factors = this.calculateRankingFactors(result, query, intent);
            const finalScore = this.calculateWeightedScore(factors, weights);

            return {
                ...result,
                combinedScore: finalScore,
                rankingFactors: factors
            };
        });

        // Sort by final score
        rankedResults.sort((a, b) => b.combinedScore - a.combinedScore);

        // Apply diversity filtering to avoid too many similar results
        return this.applyDiversityFiltering(rankedResults);
    }

    private calculateRankingFactors(
        result: SemanticMatch,
        query: string,
        intent: QueryIntent
    ): RankingFactors {
        return {
            keywordRelevance: this.calculateKeywordRelevance(result, query),
            semanticRelevance: this.calculateSemanticRelevance(result, intent),
            contentQuality: this.calculateContentQuality(result),
            userEngagement: this.calculateUserEngagement(result),
            recency: this.calculateRecency(result),
            authority: this.calculateAuthority(result),
            personalRelevance: this.calculatePersonalRelevance(result, intent)
        };
    }

    private calculateKeywordRelevance(result: SemanticMatch, query: string): number {
        const queryTerms = query.toLowerCase().split(/\s+/);
        const titleWords = result.title.toLowerCase().split(/\s+/);
        const snippetWords = result.snippet.toLowerCase().split(/\s+/);

        let score = 0;
        let totalTerms = queryTerms.length;

        for (const term of queryTerms) {
            if (term.length < 3) continue;

            // Title matches (higher weight)
            const titleMatches = titleWords.filter(word =>
                word.includes(term) || term.includes(word)
            ).length;
            score += titleMatches * 0.4;

            // Snippet matches
            const snippetMatches = snippetWords.filter(word =>
                word.includes(term) || term.includes(word)
            ).length;
            score += snippetMatches * 0.2;

            // Exact matches get bonus
            if (result.title.toLowerCase().includes(term)) {
                score += 0.3;
            }
            if (result.snippet.toLowerCase().includes(term)) {
                score += 0.1;
            }
        }

        return Math.min(score / totalTerms, 1.0);
    }

    private calculateSemanticRelevance(result: SemanticMatch, intent: QueryIntent): number {
        let score = result.semanticScore;

        // Boost based on matched concepts
        if (result.matchedConcepts && result.matchedConcepts.length > 0) {
            const conceptBoost = Math.min(result.matchedConcepts.length * 0.1, 0.3);
            score += conceptBoost;
        }

        // Intent-specific boosts
        switch (intent.type) {
            case 'question':
                if (result.snippet.includes('?') || result.snippet.includes('answer')) {
                    score += 0.1;
                }
                break;
            case 'howto':
                if (result.title.toLowerCase().includes('how') ||
                    result.snippet.toLowerCase().includes('step')) {
                    score += 0.1;
                }
                break;
            case 'definition':
                if (result.snippet.toLowerCase().includes('definition') ||
                    result.snippet.toLowerCase().includes('means')) {
                    score += 0.1;
                }
                break;
        }

        return Math.min(score, 1.0);
    }

    private calculateContentQuality(result: SemanticMatch): number {
        // This would typically require access to the full content
        // For now, we'll use heuristics based on available data
        let score = 0.5; // Base quality score

        // Title quality indicators
        const titleLength = result.title.length;
        if (titleLength >= 20 && titleLength <= 100) {
            score += 0.1; // Good title length
        }

        // Snippet quality indicators
        const snippetLength = result.snippet.replace(/<[^>]*>/g, '').length;
        if (snippetLength >= 100 && snippetLength <= 300) {
            score += 0.1; // Good snippet length
        }

        // Check for quality indicators in snippet
        const qualityIndicators = [
            'example', 'tutorial', 'guide', 'documentation', 'official',
            'comprehensive', 'detailed', 'step-by-step', 'complete'
        ];

        const snippetLower = result.snippet.toLowerCase();
        const qualityMatches = qualityIndicators.filter(indicator =>
            snippetLower.includes(indicator)
        ).length;

        score += Math.min(qualityMatches * 0.05, 0.2);

        // Penalize very short content
        if (snippetLength < 50) {
            score -= 0.2;
        }

        return Math.max(Math.min(score, 1.0), 0.0);
    }

    private calculateUserEngagement(result: SemanticMatch): number {
        // This would require access to user interaction data
        // For now, return a base score that could be enhanced with real data
        return 0.5;
    }

    private calculateRecency(result: SemanticMatch): number {
        // This would require access to content creation/modification dates
        // For now, return a neutral score
        return 0.5;
    }

    private calculateAuthority(result: SemanticMatch): number {
        let score = 0.5; // Base authority score

        // Domain authority indicators (would need full URL)
        const authorityDomains = [
            'stackoverflow.com', 'github.com', 'developer.mozilla.org',
            'docs.microsoft.com', 'aws.amazon.com', 'google.com',
            'wikipedia.org', 'medium.com'
        ];

        // Check if snippet contains authority indicators
        const authorityIndicators = [
            'official', 'documentation', 'reference', 'specification',
            'standard', 'certified', 'verified', 'authoritative'
        ];

        const snippetLower = result.snippet.toLowerCase();
        const titleLower = result.title.toLowerCase();

        const authorityMatches = authorityIndicators.filter(indicator =>
            snippetLower.includes(indicator) || titleLower.includes(indicator)
        ).length;

        score += Math.min(authorityMatches * 0.1, 0.3);

        return Math.min(score, 1.0);
    }

    private calculatePersonalRelevance(result: SemanticMatch, intent: QueryIntent): number {
        let score = 0.5; // Base personal relevance

        // Check against user's topic interests
        if (result.matchedConcepts) {
            for (const concept of result.matchedConcepts) {
                const interest = this.userPreferences.topicInterests.get(concept.toLowerCase());
                if (interest) {
                    score += interest * 0.2;
                }
            }
        }

        // Check against preferred content types
        // This would require access to content metadata

        // Check against recent search patterns
        const queryKeywords = intent.keywords;
        const recentPatternMatches = this.userPreferences.recentSearchPatterns.filter(pattern =>
            queryKeywords.some(keyword => pattern.toLowerCase().includes(keyword.toLowerCase()))
        ).length;

        score += Math.min(recentPatternMatches * 0.1, 0.2);

        return Math.min(score, 1.0);
    }

    private calculateWeightedScore(factors: RankingFactors, weights: RankingWeights): number {
        return (
            factors.keywordRelevance * weights.keywordRelevance +
            factors.semanticRelevance * weights.semanticRelevance +
            factors.contentQuality * weights.contentQuality +
            factors.userEngagement * weights.userEngagement +
            factors.recency * weights.recency +
            factors.authority * weights.authority +
            factors.personalRelevance * weights.personalRelevance
        );
    }

    private applyDiversityFiltering(results: SemanticMatch[]): SemanticMatch[] {
        const diverseResults: SemanticMatch[] = [];
        const seenTitles = new Set<string>();
        const conceptCounts = new Map<string, number>();

        for (const result of results) {
            // Skip very similar titles
            const normalizedTitle = result.title.toLowerCase().replace(/[^\w\s]/g, '');
            const titleWords = normalizedTitle.split(/\s+/).slice(0, 5).join(' ');

            if (seenTitles.has(titleWords)) {
                continue;
            }
            seenTitles.add(titleWords);

            // Limit results from the same concept cluster
            let skipForConcepts = false;
            if (result.matchedConcepts) {
                for (const concept of result.matchedConcepts) {
                    const count = conceptCounts.get(concept) || 0;
                    if (count >= 3) { // Max 3 results per concept
                        skipForConcepts = true;
                        break;
                    }
                }

                if (!skipForConcepts) {
                    for (const concept of result.matchedConcepts) {
                        conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
                    }
                }
            }

            if (!skipForConcepts) {
                diverseResults.push(result);
            }

            // Limit total results
            if (diverseResults.length >= 50) {
                break;
            }
        }

        return diverseResults;
    }

    updateUserPreferences(
        searchQuery: string,
        clickedResults: SemanticMatch[],
        intent: QueryIntent
    ): void {
        // Update topic interests based on clicked results
        for (const result of clickedResults) {
            if (result.matchedConcepts) {
                for (const concept of result.matchedConcepts) {
                    const currentInterest = this.userPreferences.topicInterests.get(concept) || 0;
                    this.userPreferences.topicInterests.set(concept, Math.min(currentInterest + 0.1, 1.0));
                }
            }
        }

        // Update recent search patterns
        this.userPreferences.recentSearchPatterns.unshift(searchQuery);
        if (this.userPreferences.recentSearchPatterns.length > 20) {
            this.userPreferences.recentSearchPatterns = this.userPreferences.recentSearchPatterns.slice(0, 20);
        }

        // Save updated preferences
        this.saveUserPreferences();
    }

    getAdaptiveWeights(intent: QueryIntent, resultCount: number): RankingWeights {
        const weights = { ...this.defaultWeights };

        // Adjust weights based on query intent
        switch (intent.type) {
            case 'question':
                weights.semanticRelevance += 0.1;
                weights.contentQuality += 0.1;
                weights.keywordRelevance -= 0.1;
                weights.recency -= 0.1;
                break;

            case 'howto':
                weights.contentQuality += 0.15;
                weights.authority += 0.1;
                weights.keywordRelevance -= 0.1;
                weights.personalRelevance -= 0.15;
                break;

            case 'definition':
                weights.authority += 0.15;
                weights.contentQuality += 0.1;
                weights.semanticRelevance -= 0.1;
                weights.userEngagement -= 0.15;
                break;

            case 'search':
                weights.personalRelevance += 0.1;
                weights.userEngagement += 0.1;
                weights.authority -= 0.1;
                weights.contentQuality -= 0.1;
                break;
        }

        // Adjust based on result count
        if (resultCount > 100) {
            // Too many results, prioritize relevance
            weights.keywordRelevance += 0.1;
            weights.semanticRelevance += 0.1;
            weights.recency -= 0.1;
            weights.personalRelevance -= 0.1;
        } else if (resultCount < 10) {
            // Few results, be more inclusive
            weights.semanticRelevance += 0.1;
            weights.personalRelevance += 0.1;
            weights.keywordRelevance -= 0.1;
            weights.authority -= 0.1;
        }

        // Normalize weights to sum to 1
        const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        for (const key in weights) {
            weights[key as keyof RankingWeights] /= totalWeight;
        }

        return weights;
    }

    private async loadUserPreferences(): Promise<void> {
        try {
            const stored = localStorage.getItem('mindscribe_user_preferences');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.userPreferences = {
                    ...this.userPreferences,
                    ...parsed,
                    topicInterests: new Map(parsed.topicInterests || []),
                    authorPreferences: new Map(parsed.authorPreferences || [])
                };
            }
        } catch (error) {
            console.error('Failed to load user preferences:', error);
        }
    }

    private saveUserPreferences(): void {
        try {
            const toSave = {
                ...this.userPreferences,
                topicInterests: Array.from(this.userPreferences.topicInterests.entries()),
                authorPreferences: Array.from(this.userPreferences.authorPreferences.entries())
            };
            localStorage.setItem('mindscribe_user_preferences', JSON.stringify(toSave));
        } catch (error) {
            console.error('Failed to save user preferences:', error);
        }
    }

    // Public methods for external preference management
    setPreferredContentTypes(types: string[]): void {
        this.userPreferences.preferredContentTypes = types;
        this.saveUserPreferences();
    }

    setPreferredLanguages(languages: string[]): void {
        this.userPreferences.preferredLanguages = languages;
        this.saveUserPreferences();
    }

    addTopicInterest(topic: string, interest: number): void {
        this.userPreferences.topicInterests.set(topic.toLowerCase(), Math.max(0, Math.min(1, interest)));
        this.saveUserPreferences();
    }

    getUserPreferences(): UserPreferences {
        return { ...this.userPreferences };
    }
}