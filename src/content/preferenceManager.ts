// User preference learning for content resurfacing quality

import { StoredContent } from '../types/storage.js';
import { RelevanceMatch } from './contextAnalyzer.js';
import { ResurfacingTiming } from './resurfacingTimer.js';

export interface UserPreferences {
    // Content preferences
    preferredCategories: Record<string, number>; // category -> preference score (0-1)
    preferredAuthors: Record<string, number>;
    preferredDomains: Record<string, number>;
    preferredContentLength: 'short' | 'medium' | 'long' | 'any';

    // Timing preferences
    preferredHours: number[]; // Hours when user is most receptive
    maxSuggestionsPerDay: number;
    minTimeBetweenSuggestions: number; // Minutes

    // Interaction preferences
    preferredSuggestionStyle: 'minimal' | 'detailed' | 'contextual';
    autoHideAfterSeconds: number;
    enableSoundNotifications: boolean;

    // Quality thresholds
    minRelevanceThreshold: number;
    minConfidenceThreshold: number;

    // Learning parameters
    learningRate: number; // How quickly to adapt to new patterns
    decayRate: number; // How quickly to forget old patterns
}

export interface InteractionEvent {
    contentId: string;
    suggestionId: string;
    timestamp: Date;
    action: 'viewed' | 'clicked' | 'dismissed' | 'saved' | 'shared' | 'ignored';
    context: {
        currentUrl: string;
        timeOnPage: number; // Seconds
        relevanceScore: number;
        suggestedTiming: string;
        priority: string;
    };
    dismissalReason?: 'not_relevant' | 'bad_timing' | 'already_seen' | 'too_frequent' | 'other';
    engagementDuration?: number; // Seconds spent with suggested content
}

export interface LearningMetrics {
    totalSuggestions: number;
    totalEngagements: number;
    engagementRate: number;
    averageEngagementDuration: number;
    dismissalRate: number;
    categoryPerformance: Record<string, { suggestions: number; engagements: number }>;
    timingPerformance: Record<string, { suggestions: number; engagements: number }>;
    recentTrends: {
        weeklyEngagementRate: number;
        improvementTrend: 'improving' | 'stable' | 'declining';
    };
}

export interface PreferenceUpdate {
    category: string;
    field: string;
    oldValue: any;
    newValue: any;
    confidence: number;
    reason: string;
}

export class PreferenceManager {
    private preferences: UserPreferences;
    private interactionHistory: InteractionEvent[] = [];
    private learningMetrics: LearningMetrics;
    private readonly maxHistorySize = 1000;

    constructor() {
        this.preferences = this.getDefaultPreferences();
        this.learningMetrics = this.getDefaultMetrics();
    }

    /**
     * Records user interaction with a suggestion
     */
    recordInteraction(event: InteractionEvent): void {
        // Add to history
        this.interactionHistory.push(event);

        // Maintain history size limit
        if (this.interactionHistory.length > this.maxHistorySize) {
            this.interactionHistory = this.interactionHistory.slice(-this.maxHistorySize);
        }

        // Update learning metrics
        this.updateLearningMetrics(event);

        // Update preferences based on interaction
        this.updatePreferencesFromInteraction(event);
    }

    /**
     * Learns from user interaction patterns to improve suggestions
     */
    private updatePreferencesFromInteraction(event: InteractionEvent): void {
        const updates: PreferenceUpdate[] = [];
        const { action, context, dismissalReason, engagementDuration } = event;

        // Determine if this was a positive or negative interaction
        const isPositive = ['viewed', 'clicked', 'saved', 'shared'].includes(action);
        const isNegative = ['dismissed', 'ignored'].includes(action);

        // Learn category preferences
        const content = this.getContentById(event.contentId);
        if (content?.category) {
            const currentPref = this.preferences.preferredCategories[content.category] || 0.5;
            let adjustment = 0;

            if (isPositive) {
                adjustment = this.preferences.learningRate * (engagementDuration ? Math.min(engagementDuration / 60, 1) : 0.5);
            } else if (isNegative) {
                adjustment = -this.preferences.learningRate * 0.3;
            }

            const newPref = Math.max(0, Math.min(1, currentPref + adjustment));
            this.preferences.preferredCategories[content.category] = newPref;

            updates.push({
                category: 'content',
                field: 'preferredCategories',
                oldValue: currentPref,
                newValue: newPref,
                confidence: Math.abs(adjustment),
                reason: `User ${action} ${content.category} content`
            });
        }

        // Learn timing preferences
        const hour = event.timestamp.getHours();
        if (isPositive && !this.preferences.preferredHours.includes(hour)) {
            // Add hour to preferred times if user engaged positively
            this.preferences.preferredHours.push(hour);
            this.preferences.preferredHours.sort((a, b) => a - b);

            updates.push({
                category: 'timing',
                field: 'preferredHours',
                oldValue: [...this.preferences.preferredHours],
                newValue: this.preferences.preferredHours,
                confidence: 0.7,
                reason: `User engaged at ${hour}:00`
            });
        } else if (isNegative && dismissalReason === 'bad_timing') {
            // Remove hour from preferred times if consistently dismissed
            const hourDismissals = this.interactionHistory.filter(e =>
                e.timestamp.getHours() === hour &&
                e.action === 'dismissed' &&
                e.dismissalReason === 'bad_timing'
            ).length;

            if (hourDismissals > 3) {
                this.preferences.preferredHours = this.preferences.preferredHours.filter(h => h !== hour);

                updates.push({
                    category: 'timing',
                    field: 'preferredHours',
                    oldValue: [...this.preferences.preferredHours, hour],
                    newValue: this.preferences.preferredHours,
                    confidence: 0.8,
                    reason: `Consistently dismissed at ${hour}:00`
                });
            }
        }

        // Learn domain preferences
        if (content?.url) {
            try {
                const domain = new URL(content.url).hostname;
                const currentDomainPref = this.preferences.preferredDomains[domain] || 0.5;
                let domainAdjustment = 0;

                if (isPositive) {
                    domainAdjustment = this.preferences.learningRate * 0.3;
                } else if (isNegative) {
                    domainAdjustment = -this.preferences.learningRate * 0.2;
                }

                const newDomainPref = Math.max(0, Math.min(1, currentDomainPref + domainAdjustment));
                this.preferences.preferredDomains[domain] = newDomainPref;

                updates.push({
                    category: 'content',
                    field: 'preferredDomains',
                    oldValue: currentDomainPref,
                    newValue: newDomainPref,
                    confidence: Math.abs(domainAdjustment),
                    reason: `User ${action} content from ${domain}`
                });
            } catch {
                // Invalid URL, skip domain learning
            }
        }

        // Learn relevance threshold preferences
        if (isNegative && dismissalReason === 'not_relevant') {
            // Increase minimum relevance threshold if user dismisses low-relevance content
            if (context.relevanceScore < this.preferences.minRelevanceThreshold + 0.1) {
                const oldThreshold = this.preferences.minRelevanceThreshold;
                this.preferences.minRelevanceThreshold = Math.min(0.8, oldThreshold + 0.05);

                updates.push({
                    category: 'quality',
                    field: 'minRelevanceThreshold',
                    oldValue: oldThreshold,
                    newValue: this.preferences.minRelevanceThreshold,
                    confidence: 0.6,
                    reason: 'User dismissed low-relevance content'
                });
            }
        }

        // Learn frequency preferences
        if (dismissalReason === 'too_frequent') {
            // Increase time between suggestions
            const oldInterval = this.preferences.minTimeBetweenSuggestions;
            this.preferences.minTimeBetweenSuggestions = Math.min(120, oldInterval + 5);

            updates.push({
                category: 'timing',
                field: 'minTimeBetweenSuggestions',
                oldValue: oldInterval,
                newValue: this.preferences.minTimeBetweenSuggestions,
                confidence: 0.8,
                reason: 'User indicated suggestions too frequent'
            });
        }

        // Apply decay to old preferences
        this.applyPreferenceDecay();
    }

    /**
     * Applies decay to preferences to prevent over-fitting to old patterns
     */
    private applyPreferenceDecay(): void {
        const decayFactor = 1 - this.preferences.decayRate;

        // Decay category preferences toward neutral (0.5)
        for (const category in this.preferences.preferredCategories) {
            const current = this.preferences.preferredCategories[category];
            this.preferences.preferredCategories[category] = current * decayFactor + 0.5 * this.preferences.decayRate;
        }

        // Decay domain preferences toward neutral (0.5)
        for (const domain in this.preferences.preferredDomains) {
            const current = this.preferences.preferredDomains[domain];
            this.preferences.preferredDomains[domain] = current * decayFactor + 0.5 * this.preferences.decayRate;
        }

        // Decay author preferences toward neutral (0.5)
        for (const author in this.preferences.preferredAuthors) {
            const current = this.preferences.preferredAuthors[author];
            this.preferences.preferredAuthors[author] = current * decayFactor + 0.5 * this.preferences.decayRate;
        }
    }

    /**
     * Updates learning metrics based on interaction
     */
    private updateLearningMetrics(event: InteractionEvent): void {
        this.learningMetrics.totalSuggestions++;

        const isEngagement = ['viewed', 'clicked', 'saved', 'shared'].includes(event.action);
        if (isEngagement) {
            this.learningMetrics.totalEngagements++;

            if (event.engagementDuration) {
                const currentAvg = this.learningMetrics.averageEngagementDuration;
                const totalEngagements = this.learningMetrics.totalEngagements;
                this.learningMetrics.averageEngagementDuration =
                    (currentAvg * (totalEngagements - 1) + event.engagementDuration) / totalEngagements;
            }
        }

        // Update engagement rate
        this.learningMetrics.engagementRate =
            this.learningMetrics.totalEngagements / this.learningMetrics.totalSuggestions;

        // Update dismissal rate
        const dismissals = this.interactionHistory.filter(e => e.action === 'dismissed').length;
        this.learningMetrics.dismissalRate = dismissals / this.learningMetrics.totalSuggestions;

        // Update category performance
        const content = this.getContentById(event.contentId);
        if (content?.category) {
            if (!this.learningMetrics.categoryPerformance[content.category]) {
                this.learningMetrics.categoryPerformance[content.category] = { suggestions: 0, engagements: 0 };
            }

            this.learningMetrics.categoryPerformance[content.category].suggestions++;
            if (isEngagement) {
                this.learningMetrics.categoryPerformance[content.category].engagements++;
            }
        }

        // Update timing performance
        const timingKey = event.context.suggestedTiming;
        if (!this.learningMetrics.timingPerformance[timingKey]) {
            this.learningMetrics.timingPerformance[timingKey] = { suggestions: 0, engagements: 0 };
        }

        this.learningMetrics.timingPerformance[timingKey].suggestions++;
        if (isEngagement) {
            this.learningMetrics.timingPerformance[timingKey].engagements++;
        }

        // Update recent trends
        this.updateRecentTrends();
    }

    /**
     * Updates recent trend analysis
     */
    private updateRecentTrends(): void {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentInteractions = this.interactionHistory.filter(e => e.timestamp >= oneWeekAgo);

        if (recentInteractions.length > 0) {
            const recentEngagements = recentInteractions.filter(e =>
                ['viewed', 'clicked', 'saved', 'shared'].includes(e.action)
            ).length;

            this.learningMetrics.recentTrends.weeklyEngagementRate =
                recentEngagements / recentInteractions.length;

            // Determine trend
            const overallRate = this.learningMetrics.engagementRate;
            const weeklyRate = this.learningMetrics.recentTrends.weeklyEngagementRate;

            if (weeklyRate > overallRate + 0.05) {
                this.learningMetrics.recentTrends.improvementTrend = 'improving';
            } else if (weeklyRate < overallRate - 0.05) {
                this.learningMetrics.recentTrends.improvementTrend = 'declining';
            } else {
                this.learningMetrics.recentTrends.improvementTrend = 'stable';
            }
        }
    }

    /**
     * Adjusts suggestion quality based on learned preferences
     */
    adjustSuggestionQuality(
        relevanceMatches: RelevanceMatch[],
        content: StoredContent[]
    ): RelevanceMatch[] {
        return relevanceMatches
            .map(match => this.applyPreferenceAdjustments(match, content))
            .filter(match => match.relevanceScore >= this.preferences.minRelevanceThreshold)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, this.preferences.maxSuggestionsPerDay);
    }

    /**
     * Applies learned preferences to adjust relevance scores
     */
    private applyPreferenceAdjustments(
        match: RelevanceMatch,
        allContent: StoredContent[]
    ): RelevanceMatch {
        const content = allContent.find(c => c.id === match.contentId);
        if (!content) return match;

        let adjustedScore = match.relevanceScore;
        const adjustmentReasons = [...match.matchReasons];

        // Apply category preference
        if (content.category && this.preferences.preferredCategories[content.category]) {
            const categoryPref = this.preferences.preferredCategories[content.category];
            const categoryAdjustment = (categoryPref - 0.5) * 0.2; // Max ±0.1 adjustment
            adjustedScore += categoryAdjustment;

            if (categoryAdjustment > 0.05) {
                adjustmentReasons.push('preferred category');
            } else if (categoryAdjustment < -0.05) {
                adjustmentReasons.push('less preferred category');
            }
        }

        // Apply domain preference
        if (content.url) {
            try {
                const domain = new URL(content.url).hostname;
                const domainPref = this.preferences.preferredDomains[domain];

                if (domainPref !== undefined) {
                    const domainAdjustment = (domainPref - 0.5) * 0.15; // Max ±0.075 adjustment
                    adjustedScore += domainAdjustment;

                    if (domainAdjustment > 0.03) {
                        adjustmentReasons.push('preferred domain');
                    } else if (domainAdjustment < -0.03) {
                        adjustmentReasons.push('less preferred domain');
                    }
                }
            } catch {
                // Invalid URL, skip domain adjustment
            }
        }

        // Apply author preference
        if (content.metadata.author && this.preferences.preferredAuthors[content.metadata.author]) {
            const authorPref = this.preferences.preferredAuthors[content.metadata.author];
            const authorAdjustment = (authorPref - 0.5) * 0.1; // Max ±0.05 adjustment
            adjustedScore += authorAdjustment;

            if (authorAdjustment > 0.02) {
                adjustmentReasons.push('preferred author');
            }
        }

        // Apply content length preference
        const contentLength = this.categorizeContentLength(content.metadata.wordCount);
        if (this.preferences.preferredContentLength !== 'any' &&
            contentLength === this.preferences.preferredContentLength) {
            adjustedScore += 0.05;
            adjustmentReasons.push('preferred content length');
        }

        // Ensure score stays within bounds
        adjustedScore = Math.max(0, Math.min(1, adjustedScore));

        return {
            ...match,
            relevanceScore: adjustedScore,
            matchReasons: adjustmentReasons
        };
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
     * Gets current user preferences
     */
    getPreferences(): UserPreferences {
        return { ...this.preferences };
    }

    /**
     * Updates user preferences
     */
    updatePreferences(updates: Partial<UserPreferences>): void {
        this.preferences = { ...this.preferences, ...updates };
    }

    /**
     * Gets learning metrics
     */
    getLearningMetrics(): LearningMetrics {
        return { ...this.learningMetrics };
    }

    /**
     * Gets interaction history
     */
    getInteractionHistory(limit?: number): InteractionEvent[] {
        const history = [...this.interactionHistory];
        return limit ? history.slice(-limit) : history;
    }

    /**
     * Exports preferences and learning data for backup
     */
    exportData(): { preferences: UserPreferences; metrics: LearningMetrics; history: InteractionEvent[] } {
        return {
            preferences: this.getPreferences(),
            metrics: this.getLearningMetrics(),
            history: this.getInteractionHistory()
        };
    }

    /**
     * Imports preferences and learning data from backup
     */
    importData(data: { preferences?: UserPreferences; metrics?: LearningMetrics; history?: InteractionEvent[] }): void {
        if (data.preferences) {
            this.preferences = { ...this.getDefaultPreferences(), ...data.preferences };
        }

        if (data.metrics) {
            this.learningMetrics = { ...this.getDefaultMetrics(), ...data.metrics };
        }

        if (data.history) {
            this.interactionHistory = data.history.slice(-this.maxHistorySize);
        }
    }

    /**
     * Resets all learning data
     */
    resetLearning(): void {
        this.preferences = this.getDefaultPreferences();
        this.learningMetrics = this.getDefaultMetrics();
        this.interactionHistory = [];
    }

    // Helper methods
    private getDefaultPreferences(): UserPreferences {
        return {
            preferredCategories: {},
            preferredAuthors: {},
            preferredDomains: {},
            preferredContentLength: 'any',
            preferredHours: [9, 10, 11, 14, 15, 16], // Default work hours
            maxSuggestionsPerDay: 10,
            minTimeBetweenSuggestions: 15,
            preferredSuggestionStyle: 'contextual',
            autoHideAfterSeconds: 10,
            enableSoundNotifications: false,
            minRelevanceThreshold: 0.3,
            minConfidenceThreshold: 0.5,
            learningRate: 0.1,
            decayRate: 0.01
        };
    }

    private getDefaultMetrics(): LearningMetrics {
        return {
            totalSuggestions: 0,
            totalEngagements: 0,
            engagementRate: 0,
            averageEngagementDuration: 0,
            dismissalRate: 0,
            categoryPerformance: {},
            timingPerformance: {},
            recentTrends: {
                weeklyEngagementRate: 0,
                improvementTrend: 'stable'
            }
        };
    }

    private getContentById(contentId: string): StoredContent | undefined {
        // This would typically fetch from storage
        // For now, return undefined as we don't have access to storage here
        return undefined;
    }
}

// Export singleton instance
export const preferenceManager = new PreferenceManager();