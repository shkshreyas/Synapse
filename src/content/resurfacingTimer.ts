// Timing algorithms for optimal content resurfacing

import { StoredContent } from '../types/storage.js';
import { RelevanceMatch } from './contextAnalyzer.js';

export interface ResurfacingTiming {
    contentId: string;
    suggestedTime: Date;
    confidence: number;
    reason: string;
    urgency: 'immediate' | 'soon' | 'later' | 'eventual';
}

export interface TimingFactors {
    lastAccessed: Date;
    accessFrequency: number;
    contentAge: number; // days since capture
    relevanceScore: number;
    userEngagement: number; // based on time spent, notes, ratings
    contextualRelevance: number;
    forgettingCurve: number; // 0-1, higher means more likely to be forgotten
}

export interface UserBehaviorPattern {
    preferredTimings: number[]; // Hours of day when user is most receptive
    averageSessionLength: number; // Minutes
    responseRate: number; // 0-1, how often user engages with suggestions
    dismissalPatterns: string[]; // Common reasons for dismissing suggestions
    engagementByCategory: Record<string, number>;
    engagementByTime: Record<number, number>; // Hour -> engagement rate
}

export interface TimingOptions {
    respectQuietHours: boolean;
    quietHoursStart: number; // Hour (0-23)
    quietHoursEnd: number; // Hour (0-23)
    maxSuggestionsPerHour: number;
    minTimeBetweenSuggestions: number; // Minutes
    enableForgettingCurve: boolean;
    enableContextualTiming: boolean;
}

export class ResurfacingTimer {
    private readonly defaultOptions: TimingOptions = {
        respectQuietHours: true,
        quietHoursStart: 22, // 10 PM
        quietHoursEnd: 8,    // 8 AM
        maxSuggestionsPerHour: 3,
        minTimeBetweenSuggestions: 15,
        enableForgettingCurve: true,
        enableContextualTiming: true
    };

    private userBehavior: UserBehaviorPattern = {
        preferredTimings: [9, 10, 11, 14, 15, 16], // Default work hours
        averageSessionLength: 25,
        responseRate: 0.3,
        dismissalPatterns: [],
        engagementByCategory: {},
        engagementByTime: {}
    };

    private recentSuggestions: Array<{ time: Date; contentId: string }> = [];

    /**
     * Calculates optimal timing for content resurfacing
     */
    calculateOptimalTiming(
        content: StoredContent,
        relevanceMatch: RelevanceMatch,
        options: Partial<TimingOptions> = {}
    ): ResurfacingTiming {
        const config = { ...this.defaultOptions, ...options };
        const now = new Date();

        // Calculate timing factors
        const factors = this.calculateTimingFactors(content, relevanceMatch);

        // Determine base timing based on urgency
        let baseDelay = this.getBaseDelay(relevanceMatch.suggestedTiming, factors);

        // Apply forgetting curve adjustment
        if (config.enableForgettingCurve) {
            baseDelay = this.applyForgettingCurve(baseDelay, factors);
        }

        // Apply contextual timing
        if (config.enableContextualTiming) {
            baseDelay = this.applyContextualTiming(baseDelay, factors);
        }

        // Calculate suggested time
        const suggestedTime = new Date(now.getTime() + baseDelay);

        // Adjust for user preferences and constraints
        const adjustedTime = this.adjustForUserPreferences(suggestedTime, config);

        // Calculate confidence and urgency
        const confidence = this.calculateTimingConfidence(factors, baseDelay);
        const urgency = this.determineUrgency(adjustedTime, now, factors);

        return {
            contentId: content.id,
            suggestedTime: adjustedTime,
            confidence,
            reason: this.generateTimingReason(factors, baseDelay),
            urgency
        };
    }

    /**
     * Calculates timing factors for a content item
     */
    private calculateTimingFactors(
        content: StoredContent,
        relevanceMatch: RelevanceMatch
    ): TimingFactors {
        const now = new Date();
        const daysSinceCapture = (now.getTime() - content.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        const daysSinceAccess = (now.getTime() - content.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);

        // Calculate access frequency (accesses per day since capture)
        const accessFrequency = daysSinceCapture > 0 ? content.timesAccessed / daysSinceCapture : 0;

        // Calculate user engagement score
        const userEngagement = this.calculateUserEngagement(content);

        // Calculate forgetting curve (Ebbinghaus curve approximation)
        const forgettingCurve = this.calculateForgettingCurve(daysSinceAccess, accessFrequency);

        return {
            lastAccessed: content.lastAccessed,
            accessFrequency,
            contentAge: daysSinceCapture,
            relevanceScore: relevanceMatch.relevanceScore,
            userEngagement,
            contextualRelevance: relevanceMatch.relevanceScore,
            forgettingCurve
        };
    }

    /**
     * Calculates user engagement score based on various factors
     */
    private calculateUserEngagement(content: StoredContent): number {
        let engagement = 0.5; // Base engagement

        // Factor in access frequency
        if (content.timesAccessed > 5) engagement += 0.2;
        else if (content.timesAccessed > 2) engagement += 0.1;

        // Factor in user rating
        if (content.userRating) {
            engagement += (content.userRating - 3) * 0.1; // -0.2 to +0.2
        }

        // Factor in user notes
        if (content.userNotes && content.userNotes.length > 10) {
            engagement += 0.15;
        }

        // Factor in content importance
        if (content.importance) {
            engagement += (content.importance - 5) * 0.05; // -0.25 to +0.25
        }

        return Math.max(0, Math.min(1, engagement));
    }

    /**
     * Calculates forgetting curve value (0 = completely forgotten, 1 = fully remembered)
     */
    private calculateForgettingCurve(daysSinceAccess: number, accessFrequency: number): number {
        // Ebbinghaus forgetting curve: R = e^(-t/S)
        // Where R = retention, t = time, S = strength of memory

        // Strength increases with access frequency
        const memoryStrength = Math.max(1, 1 + accessFrequency * 2);

        // Calculate retention
        const retention = Math.exp(-daysSinceAccess / memoryStrength);

        return Math.max(0, Math.min(1, retention));
    }

    /**
     * Gets base delay in milliseconds based on suggested timing
     */
    private getBaseDelay(
        suggestedTiming: RelevanceMatch['suggestedTiming'],
        factors: TimingFactors
    ): number {
        const minute = 60 * 1000;
        const hour = 60 * minute;

        switch (suggestedTiming) {
            case 'immediate':
                return 2 * minute; // 2 minutes
            case 'delayed':
                return 15 * minute; // 15 minutes
            case 'background':
                return 2 * hour; // 2 hours
            default:
                return hour; // 1 hour default
        }
    }

    /**
     * Applies forgetting curve to adjust timing
     */
    private applyForgettingCurve(baseDelay: number, factors: TimingFactors): number {
        // If content is being forgotten (low retention), suggest sooner
        const forgettingFactor = 1 - factors.forgettingCurve;

        // Reduce delay based on how much content is being forgotten
        const adjustment = forgettingFactor * 0.5; // Up to 50% reduction

        return Math.max(baseDelay * (1 - adjustment), 60000); // Minimum 1 minute
    }

    /**
     * Applies contextual timing based on relevance and user engagement
     */
    private applyContextualTiming(baseDelay: number, factors: TimingFactors): number {
        let adjustment = 1;

        // High relevance = suggest sooner
        if (factors.relevanceScore > 0.7) {
            adjustment *= 0.7;
        } else if (factors.relevanceScore > 0.5) {
            adjustment *= 0.85;
        }

        // High user engagement = suggest sooner
        if (factors.userEngagement > 0.7) {
            adjustment *= 0.8;
        }

        // Frequently accessed content = suggest sooner
        if (factors.accessFrequency > 0.5) {
            adjustment *= 0.9;
        }

        return Math.max(baseDelay * adjustment, 60000); // Minimum 1 minute
    }

    /**
     * Adjusts timing for user preferences and constraints
     */
    private adjustForUserPreferences(
        suggestedTime: Date,
        options: TimingOptions
    ): Date {
        let adjustedTime = new Date(suggestedTime);

        // Check quiet hours
        if (options.respectQuietHours) {
            adjustedTime = this.avoidQuietHours(adjustedTime, options);
        }

        // Check suggestion frequency limits
        adjustedTime = this.respectFrequencyLimits(adjustedTime, options);

        // Align with user's preferred timing patterns
        adjustedTime = this.alignWithUserPreferences(adjustedTime);

        return adjustedTime;
    }

    /**
     * Avoids quiet hours by pushing suggestions to next available time
     */
    private avoidQuietHours(time: Date, options: TimingOptions): Date {
        const hour = time.getHours();
        const { quietHoursStart, quietHoursEnd } = options;

        // Check if time falls in quiet hours
        const inQuietHours = quietHoursStart > quietHoursEnd
            ? (hour >= quietHoursStart || hour < quietHoursEnd) // Overnight quiet hours
            : (hour >= quietHoursStart && hour < quietHoursEnd); // Same day quiet hours

        if (inQuietHours) {
            const adjustedTime = new Date(time);
            adjustedTime.setHours(quietHoursEnd, 0, 0, 0);

            // If we've moved to the next day, ensure it's still reasonable
            if (adjustedTime.getTime() - time.getTime() > 12 * 60 * 60 * 1000) {
                // If more than 12 hours away, suggest at end of current day instead
                adjustedTime.setTime(time.getTime());
                adjustedTime.setHours(quietHoursStart - 1, 0, 0, 0);
            }

            return adjustedTime;
        }

        return time;
    }

    /**
     * Respects frequency limits by spacing out suggestions
     */
    private respectFrequencyLimits(time: Date, options: TimingOptions): Date {
        const now = new Date();
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        // Clean old suggestions
        this.recentSuggestions = this.recentSuggestions.filter(s => s.time > hourAgo);

        // Check if we've hit the hourly limit
        if (this.recentSuggestions.length >= options.maxSuggestionsPerHour) {
            const oldestSuggestion = this.recentSuggestions[0];
            const nextAvailableTime = new Date(oldestSuggestion.time.getTime() + 60 * 60 * 1000);

            if (time < nextAvailableTime) {
                return nextAvailableTime;
            }
        }

        // Check minimum time between suggestions
        if (this.recentSuggestions.length > 0) {
            const lastSuggestion = this.recentSuggestions[this.recentSuggestions.length - 1];
            const minNextTime = new Date(lastSuggestion.time.getTime() + options.minTimeBetweenSuggestions * 60 * 1000);

            if (time < minNextTime) {
                return minNextTime;
            }
        }

        return time;
    }

    /**
     * Aligns timing with user's preferred patterns
     */
    private alignWithUserPreferences(time: Date): Date {
        const hour = time.getHours();

        // If current hour is not in preferred timings, find the next preferred hour
        if (!this.userBehavior.preferredTimings.includes(hour)) {
            const nextPreferredHour = this.findNextPreferredHour(hour);
            const adjustedTime = new Date(time);

            if (nextPreferredHour > hour) {
                adjustedTime.setHours(nextPreferredHour, 0, 0, 0);
            } else {
                // Next preferred hour is tomorrow
                adjustedTime.setDate(adjustedTime.getDate() + 1);
                adjustedTime.setHours(nextPreferredHour, 0, 0, 0);
            }

            return adjustedTime;
        }

        return time;
    }

    /**
     * Finds the next preferred hour for suggestions
     */
    private findNextPreferredHour(currentHour: number): number {
        const sortedHours = [...this.userBehavior.preferredTimings].sort((a, b) => a - b);

        for (const hour of sortedHours) {
            if (hour > currentHour) {
                return hour;
            }
        }

        // Return first hour of next day
        return sortedHours[0] || 9; // Default to 9 AM
    }

    /**
     * Calculates confidence in the timing suggestion
     */
    private calculateTimingConfidence(factors: TimingFactors, baseDelay: number): number {
        let confidence = 0.5; // Base confidence

        // Higher confidence for high relevance
        confidence += factors.relevanceScore * 0.3;

        // Higher confidence for engaged users
        confidence += factors.userEngagement * 0.2;

        // Higher confidence for frequently accessed content
        if (factors.accessFrequency > 0.3) {
            confidence += 0.1;
        }

        // Lower confidence for very old content
        if (factors.contentAge > 30) {
            confidence -= 0.1;
        }

        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Determines urgency level for the suggestion
     */
    private determineUrgency(
        suggestedTime: Date,
        now: Date,
        factors: TimingFactors
    ): ResurfacingTiming['urgency'] {
        const delayMinutes = (suggestedTime.getTime() - now.getTime()) / (1000 * 60);

        if (delayMinutes <= 5 && factors.relevanceScore > 0.7) {
            return 'immediate';
        } else if (delayMinutes <= 30) {
            return 'soon';
        } else if (delayMinutes <= 120) {
            return 'later';
        } else {
            return 'eventual';
        }
    }

    /**
     * Generates human-readable reason for the timing
     */
    private generateTimingReason(factors: TimingFactors, baseDelay: number): string {
        const reasons: string[] = [];

        if (factors.relevanceScore > 0.7) {
            reasons.push('highly relevant to current context');
        }

        if (factors.forgettingCurve < 0.3) {
            reasons.push('likely to be forgotten soon');
        }

        if (factors.accessFrequency > 0.5) {
            reasons.push('frequently accessed content');
        }

        if (factors.userEngagement > 0.7) {
            reasons.push('high user engagement');
        }

        if (reasons.length === 0) {
            return 'contextually relevant';
        }

        return reasons.join(', ');
    }

    /**
     * Records a suggestion for frequency tracking
     */
    recordSuggestion(contentId: string): void {
        this.recentSuggestions.push({
            time: new Date(),
            contentId
        });
    }

    /**
     * Updates user behavior patterns based on interactions
     */
    updateUserBehavior(
        hour: number,
        engaged: boolean,
        category?: string,
        dismissalReason?: string
    ): void {
        // Update engagement by time
        if (!this.userBehavior.engagementByTime[hour]) {
            this.userBehavior.engagementByTime[hour] = 0;
        }

        const currentRate = this.userBehavior.engagementByTime[hour];
        const newRate = engaged ? Math.min(1, currentRate + 0.1) : Math.max(0, currentRate - 0.05);
        this.userBehavior.engagementByTime[hour] = newRate;

        // Update preferred timings based on engagement
        if (engaged && newRate > 0.3 && !this.userBehavior.preferredTimings.includes(hour)) {
            this.userBehavior.preferredTimings.push(hour);
            this.userBehavior.preferredTimings.sort((a, b) => a - b);
        }

        // Update category engagement
        if (category) {
            if (!this.userBehavior.engagementByCategory[category]) {
                this.userBehavior.engagementByCategory[category] = 0.5;
            }

            const currentCategoryRate = this.userBehavior.engagementByCategory[category];
            const newCategoryRate = engaged
                ? Math.min(1, currentCategoryRate + 0.1)
                : Math.max(0, currentCategoryRate - 0.05);
            this.userBehavior.engagementByCategory[category] = newCategoryRate;
        }

        // Track dismissal patterns
        if (!engaged && dismissalReason) {
            if (!this.userBehavior.dismissalPatterns.includes(dismissalReason)) {
                this.userBehavior.dismissalPatterns.push(dismissalReason);
            }
        }

        // Update overall response rate
        const totalInteractions = Object.values(this.userBehavior.engagementByTime).length;
        const engagedInteractions = Object.values(this.userBehavior.engagementByTime)
            .filter(rate => rate > 0.5).length;

        this.userBehavior.responseRate = totalInteractions > 0
            ? engagedInteractions / totalInteractions
            : 0.3;
    }

    /**
     * Gets current user behavior patterns
     */
    getUserBehavior(): UserBehaviorPattern {
        return { ...this.userBehavior };
    }

    /**
     * Sets user behavior patterns (for loading saved preferences)
     */
    setUserBehavior(behavior: Partial<UserBehaviorPattern>): void {
        this.userBehavior = { ...this.userBehavior, ...behavior };
    }
}

// Export singleton instance
export const resurfacingTimer = new ResurfacingTimer();