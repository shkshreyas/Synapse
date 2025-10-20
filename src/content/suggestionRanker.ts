// Suggestion ranking and filtering system for content resurfacing

import { ContextualSuggestion } from './contextIntegration.js';
import { StoredContent } from '../types/storage.js';
import { UserPreferences, LearningMetrics } from './preferenceManager.js';

export interface RankingCriteria {
    relevanceWeight: number;
    recencyWeight: number;
    popularityWeight: number;
    diversityWeight: number;
    userPreferenceWeight: number;
    contextualFitWeight: number;
}

export interface FilterCriteria {
    minRelevanceScore: number;
    maxAge: number; // days
    excludeRecentlyViewed: boolean;
    recentlyViewedHours: number;
    requireMinimumEngagement: boolean;
    minEngagementScore: number;
    enableCategoryDiversity: boolean;
    maxSuggestionsPerCategory: number;
}

export interface RankingResult {
    rankedSuggestions: ContextualSuggestion[];
    filteringStats: {
        totalCandidates: number;
        filteredOut: number;
        finalCount: number;
        filterReasons: Record<string, number>;
    };
    rankingFactors: Array<{
        suggestionId: string;
        factors: {
            relevanceScore: number;
            recencyScore: number;
            popularityScore: number;
            diversityScore: number;
            userPreferenceScore: number;
            contextualFitScore: number;
            finalScore: number;
        };
    }>;
}

export interface SuggestionContext {
    currentUrl: string;
    currentCategory: string;
    timeOfDay: number; // 0-23
    dayOfWeek: number; // 0-6
    userActivity: 'browsing' | 'reading' | 'researching' | 'working';
    sessionDuration: number; // minutes
}

export class SuggestionRanker {
    private readonly defaultRankingCriteria: RankingCriteria = {
        relevanceWeight: 0.35,
        recencyWeight: 0.15,
        popularityWeight: 0.15,
        diversityWeight: 0.10,
        userPreferenceWeight: 0.15,
        contextualFitWeight: 0.10
    };

    private readonly defaultFilterCriteria: FilterCriteria = {
        minRelevanceScore: 0.3,
        maxAge: 90, // 3 months
        excludeRecentlyViewed: true,
        recentlyViewedHours: 24,
        requireMinimumEngagement: false,
        minEngagementScore: 0.2,
        enableCategoryDiversity: true,
        maxSuggestionsPerCategory: 2
    };

    /**
     * Ranks and filters suggestions based on multiple criteria
     */
    rankSuggestions(
        suggestions: ContextualSuggestion[],
        context: SuggestionContext,
        userPreferences: UserPreferences,
        learningMetrics: LearningMetrics,
        rankingCriteria: Partial<RankingCriteria> = {},
        filterCriteria: Partial<FilterCriteria> = {}
    ): RankingResult {
        const ranking = { ...this.defaultRankingCriteria, ...rankingCriteria };
        const filtering = { ...this.defaultFilterCriteria, ...filterCriteria };

        // Step 1: Apply filters
        const filterResult = this.applyFilters(suggestions, filtering, context);

        // Step 2: Calculate ranking scores
        const scoredSuggestions = this.calculateRankingScores(
            filterResult.filteredSuggestions,
            context,
            userPreferences,
            learningMetrics,
            ranking
        );

        // Step 3: Apply diversity constraints
        const diversifiedSuggestions = this.applyDiversityConstraints(
            scoredSuggestions,
            filtering
        );

        // Step 4: Sort by final score
        const rankedSuggestions = diversifiedSuggestions.sort((a, b) => {
            const aScore = this.getFinalScore(a, ranking);
            const bScore = this.getFinalScore(b, ranking);
            return bScore - aScore;
        });

        return {
            rankedSuggestions,
            filteringStats: filterResult.stats,
            rankingFactors: scoredSuggestions.map(suggestion => ({
                suggestionId: suggestion.contentId,
                factors: this.getRankingFactors(suggestion, context, userPreferences, learningMetrics, ranking)
            }))
        };
    }

    /**
     * Applies filtering criteria to suggestions
     */
    private applyFilters(
        suggestions: ContextualSuggestion[],
        criteria: FilterCriteria,
        context: SuggestionContext
    ): {
        filteredSuggestions: ContextualSuggestion[];
        stats: RankingResult['filteringStats'];
    } {
        const stats = {
            totalCandidates: suggestions.length,
            filteredOut: 0,
            finalCount: 0,
            filterReasons: {} as Record<string, number>
        };

        const incrementFilterReason = (reason: string) => {
            stats.filterReasons[reason] = (stats.filterReasons[reason] || 0) + 1;
            stats.filteredOut++;
        };

        const now = new Date();
        const filteredSuggestions = suggestions.filter(suggestion => {
            // Relevance score filter
            if (suggestion.relevanceScore < criteria.minRelevanceScore) {
                incrementFilterReason('low_relevance');
                return false;
            }

            // Age filter
            const contentAge = (now.getTime() - suggestion.content.timestamp.getTime()) / (1000 * 60 * 60 * 24);
            if (contentAge > criteria.maxAge) {
                incrementFilterReason('too_old');
                return false;
            }

            // Recently viewed filter
            if (criteria.excludeRecentlyViewed) {
                const hoursSinceLastAccess = (now.getTime() - suggestion.content.lastAccessed.getTime()) / (1000 * 60 * 60);
                if (hoursSinceLastAccess < criteria.recentlyViewedHours) {
                    incrementFilterReason('recently_viewed');
                    return false;
                }
            }

            // Minimum engagement filter
            if (criteria.requireMinimumEngagement) {
                const engagementScore = this.calculateEngagementScore(suggestion.content);
                if (engagementScore < criteria.minEngagementScore) {
                    incrementFilterReason('low_engagement');
                    return false;
                }
            }

            return true;
        });

        stats.finalCount = filteredSuggestions.length;

        return { filteredSuggestions, stats };
    }

    /**
     * Calculates ranking scores for suggestions
     */
    private calculateRankingScores(
        suggestions: ContextualSuggestion[],
        context: SuggestionContext,
        userPreferences: UserPreferences,
        learningMetrics: LearningMetrics,
        criteria: RankingCriteria
    ): Array<ContextualSuggestion & { rankingScores: any }> {
        return suggestions.map(suggestion => ({
            ...suggestion,
            rankingScores: this.getRankingFactors(suggestion, context, userPreferences, learningMetrics, criteria)
        }));
    }

    /**
     * Calculates individual ranking factors for a suggestion
     */
    private getRankingFactors(
        suggestion: ContextualSuggestion,
        context: SuggestionContext,
        userPreferences: UserPreferences,
        learningMetrics: LearningMetrics,
        criteria: RankingCriteria
    ): RankingResult['rankingFactors'][0]['factors'] {
        const relevanceScore = suggestion.relevanceScore;
        const recencyScore = this.calculateRecencyScore(suggestion.content);
        const popularityScore = this.calculatePopularityScore(suggestion.content);
        const diversityScore = this.calculateDiversityScore(suggestion, context);
        const userPreferenceScore = this.calculateUserPreferenceScore(suggestion, userPreferences);
        const contextualFitScore = this.calculateContextualFitScore(suggestion, context, userPreferences);

        const finalScore =
            relevanceScore * criteria.relevanceWeight +
            recencyScore * criteria.recencyWeight +
            popularityScore * criteria.popularityWeight +
            diversityScore * criteria.diversityWeight +
            userPreferenceScore * criteria.userPreferenceWeight +
            contextualFitScore * criteria.contextualFitWeight;

        return {
            relevanceScore,
            recencyScore,
            popularityScore,
            diversityScore,
            userPreferenceScore,
            contextualFitScore,
            finalScore
        };
    }

    /**
     * Calculates recency score (newer content scores higher)
     */
    private calculateRecencyScore(content: StoredContent): number {
        const now = new Date();
        const daysSinceCapture = (now.getTime() - content.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        const daysSinceAccess = (now.getTime() - content.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);

        // Combine capture recency and access recency
        const captureRecency = Math.max(0, 1 - daysSinceCapture / 30); // Decay over 30 days
        const accessRecency = Math.max(0, 1 - daysSinceAccess / 7); // Decay over 7 days

        return (captureRecency * 0.3 + accessRecency * 0.7);
    }

    /**
     * Calculates popularity score based on access frequency and user engagement
     */
    private calculatePopularityScore(content: StoredContent): number {
        const accessFrequency = content.timesAccessed;
        const maxAccess = 20; // Normalize against this maximum
        const normalizedAccess = Math.min(accessFrequency / maxAccess, 1);

        // Factor in user rating if available
        let ratingBonus = 0;
        if (content.userRating) {
            ratingBonus = (content.userRating - 3) / 2; // Convert 1-5 scale to -1 to 1
        }

        // Factor in user notes (indicates engagement)
        let notesBonus = 0;
        if (content.userNotes && content.userNotes.length > 10) {
            notesBonus = 0.2;
        }

        return Math.max(0, Math.min(1, normalizedAccess + ratingBonus * 0.3 + notesBonus));
    }

    /**
     * Calculates diversity score (promotes variety in suggestions)
     */
    private calculateDiversityScore(suggestion: ContextualSuggestion, context: SuggestionContext): number {
        // Higher score for content from different categories than current context
        if (suggestion.content.category && suggestion.content.category !== context.currentCategory) {
            return 0.8;
        }

        // Medium score for same category but different domain
        try {
            const suggestionDomain = new URL(suggestion.content.url).hostname;
            const currentDomain = new URL(context.currentUrl).hostname;

            if (suggestionDomain !== currentDomain) {
                return 0.6;
            }
        } catch {
            // Invalid URLs, skip domain comparison
        }

        // Lower score for very similar content
        return 0.3;
    }

    /**
     * Calculates user preference score based on learned preferences
     */
    private calculateUserPreferenceScore(
        suggestion: ContextualSuggestion,
        userPreferences: UserPreferences
    ): number {
        let score = 0.5; // Base score

        // Category preference
        if (suggestion.content.category && userPreferences.preferredCategories[suggestion.content.category]) {
            const categoryPref = userPreferences.preferredCategories[suggestion.content.category];
            score += (categoryPref - 0.5) * 0.4; // Max ±0.2 adjustment
        }

        // Domain preference
        try {
            const domain = new URL(suggestion.content.url).hostname;
            if (userPreferences.preferredDomains[domain]) {
                const domainPref = userPreferences.preferredDomains[domain];
                score += (domainPref - 0.5) * 0.3; // Max ±0.15 adjustment
            }
        } catch {
            // Invalid URL, skip domain preference
        }

        // Author preference
        if (suggestion.content.metadata.author && userPreferences.preferredAuthors[suggestion.content.metadata.author]) {
            const authorPref = userPreferences.preferredAuthors[suggestion.content.metadata.author];
            score += (authorPref - 0.5) * 0.2; // Max ±0.1 adjustment
        }

        // Content length preference
        const contentLength = this.categorizeContentLength(suggestion.content.metadata.wordCount);
        if (userPreferences.preferredContentLength !== 'any' && contentLength === userPreferences.preferredContentLength) {
            score += 0.1;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Calculates contextual fit score based on current browsing context
     */
    private calculateContextualFitScore(
        suggestion: ContextualSuggestion,
        context: SuggestionContext,
        userPreferences: UserPreferences
    ): number {
        let score = 0.5; // Base score

        // Time-based contextual fit
        const currentHour = context.timeOfDay;
        if (userPreferences.preferredHours.includes(currentHour)) {
            score += 0.2;
        }

        // Activity-based contextual fit
        const activityBonus = this.getActivityBonus(suggestion, context.userActivity);
        score += activityBonus;

        // Session duration consideration
        if (context.sessionDuration > 10) { // Long session, user is engaged
            score += 0.1;
        } else if (context.sessionDuration < 2) { // Short session, suggest quick content
            if (suggestion.content.metadata.readingTime <= 3) {
                score += 0.15;
            } else {
                score -= 0.1;
            }
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Gets activity-based bonus for suggestions
     */
    private getActivityBonus(suggestion: ContextualSuggestion, activity: SuggestionContext['userActivity']): number {
        const category = suggestion.content.category;
        const readingTime = suggestion.content.metadata.readingTime;

        switch (activity) {
            case 'browsing':
                // Prefer shorter, diverse content while browsing
                return readingTime <= 5 ? 0.1 : -0.05;

            case 'reading':
                // Prefer longer, in-depth content while reading
                return readingTime > 5 ? 0.15 : 0.05;

            case 'researching':
                // Prefer documentation and detailed articles
                return category === 'documentation' || category === 'article' ? 0.2 : 0;

            case 'working':
                // Prefer relevant, actionable content
                return category === 'documentation' ? 0.15 : 0.05;

            default:
                return 0;
        }
    }

    /**
     * Applies diversity constraints to prevent too many similar suggestions
     */
    private applyDiversityConstraints(
        suggestions: Array<ContextualSuggestion & { rankingScores: any }>,
        criteria: FilterCriteria
    ): ContextualSuggestion[] {
        if (!criteria.enableCategoryDiversity) {
            return suggestions.map(s => ({ ...s, rankingScores: undefined }));
        }

        const categoryCount: Record<string, number> = {};
        const diversifiedSuggestions: ContextualSuggestion[] = [];

        // Sort by final score first
        const sortedSuggestions = suggestions.sort((a, b) =>
            this.getFinalScore(b, this.defaultRankingCriteria) - this.getFinalScore(a, this.defaultRankingCriteria)
        );

        for (const suggestion of sortedSuggestions) {
            const category = suggestion.content.category || 'other';
            const currentCount = categoryCount[category] || 0;

            if (currentCount < criteria.maxSuggestionsPerCategory) {
                diversifiedSuggestions.push(suggestion);
                categoryCount[category] = currentCount + 1;
            }
        }

        return diversifiedSuggestions;
    }

    /**
     * Calculates engagement score for content
     */
    private calculateEngagementScore(content: StoredContent): number {
        let score = 0;

        // Access frequency
        const accessScore = Math.min(content.timesAccessed / 10, 1) * 0.4;
        score += accessScore;

        // User rating
        if (content.userRating) {
            const ratingScore = (content.userRating - 1) / 4; // Convert 1-5 to 0-1
            score += ratingScore * 0.3;
        }

        // User notes
        if (content.userNotes && content.userNotes.length > 0) {
            const notesScore = Math.min(content.userNotes.length / 100, 1) * 0.2;
            score += notesScore;
        }

        // Importance rating
        if (content.importance) {
            const importanceScore = (content.importance - 1) / 9; // Convert 1-10 to 0-1
            score += importanceScore * 0.1;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Gets final score from suggestion with ranking scores
     */
    private getFinalScore(suggestion: any, criteria: RankingCriteria): number {
        if (suggestion.rankingScores) {
            return suggestion.rankingScores.finalScore;
        }

        // Fallback to relevance score
        return suggestion.relevanceScore || 0;
    }

    /**
     * Categorizes content length
     */
    private categorizeContentLength(wordCount: number): 'short' | 'medium' | 'long' {
        if (wordCount < 300) return 'short';
        if (wordCount < 1000) return 'medium';
        return 'long';
    }

    /**
     * Updates ranking criteria based on user feedback
     */
    updateRankingCriteria(
        feedback: Array<{
            suggestionId: string;
            userAction: 'engaged' | 'dismissed';
            rankingFactors: RankingResult['rankingFactors'][0]['factors'];
        }>
    ): Partial<RankingCriteria> {
        // Analyze which factors correlate with positive user actions
        const engagedFeedback = feedback.filter(f => f.userAction === 'engaged');
        const dismissedFeedback = feedback.filter(f => f.userAction === 'dismissed');

        if (engagedFeedback.length === 0) {
            return {}; // No positive feedback to learn from
        }

        // Calculate average factor scores for engaged vs dismissed suggestions
        const engagedAvg = this.calculateAverageFactors(engagedFeedback.map(f => f.rankingFactors));
        const dismissedAvg = dismissedFeedback.length > 0
            ? this.calculateAverageFactors(dismissedFeedback.map(f => f.rankingFactors))
            : null;

        // Adjust weights based on which factors perform better
        const adjustments: Partial<RankingCriteria> = {};
        const learningRate = 0.1; // How much to adjust weights

        if (dismissedAvg) {
            // Increase weights for factors that are higher in engaged suggestions
            if (engagedAvg.relevanceScore > dismissedAvg.relevanceScore) {
                adjustments.relevanceWeight = Math.min(0.5, this.defaultRankingCriteria.relevanceWeight + learningRate);
            }

            if (engagedAvg.userPreferenceScore > dismissedAvg.userPreferenceScore) {
                adjustments.userPreferenceWeight = Math.min(0.3, this.defaultRankingCriteria.userPreferenceWeight + learningRate);
            }

            if (engagedAvg.contextualFitScore > dismissedAvg.contextualFitScore) {
                adjustments.contextualFitWeight = Math.min(0.2, this.defaultRankingCriteria.contextualFitWeight + learningRate);
            }
        }

        return adjustments;
    }

    /**
     * Calculates average factor scores
     */
    private calculateAverageFactors(factorsList: RankingResult['rankingFactors'][0]['factors'][]): RankingResult['rankingFactors'][0]['factors'] {
        if (factorsList.length === 0) {
            return {
                relevanceScore: 0,
                recencyScore: 0,
                popularityScore: 0,
                diversityScore: 0,
                userPreferenceScore: 0,
                contextualFitScore: 0,
                finalScore: 0
            };
        }

        const sums = factorsList.reduce((acc, factors) => ({
            relevanceScore: acc.relevanceScore + factors.relevanceScore,
            recencyScore: acc.recencyScore + factors.recencyScore,
            popularityScore: acc.popularityScore + factors.popularityScore,
            diversityScore: acc.diversityScore + factors.diversityScore,
            userPreferenceScore: acc.userPreferenceScore + factors.userPreferenceScore,
            contextualFitScore: acc.contextualFitScore + factors.contextualFitScore,
            finalScore: acc.finalScore + factors.finalScore
        }), {
            relevanceScore: 0,
            recencyScore: 0,
            popularityScore: 0,
            diversityScore: 0,
            userPreferenceScore: 0,
            contextualFitScore: 0,
            finalScore: 0
        });

        const count = factorsList.length;
        return {
            relevanceScore: sums.relevanceScore / count,
            recencyScore: sums.recencyScore / count,
            popularityScore: sums.popularityScore / count,
            diversityScore: sums.diversityScore / count,
            userPreferenceScore: sums.userPreferenceScore / count,
            contextualFitScore: sums.contextualFitScore / count,
            finalScore: sums.finalScore / count
        };
    }
}

// Export singleton instance
export const suggestionRanker = new SuggestionRanker();