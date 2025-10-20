// Feedback collection system for suggestion quality improvement

export interface FeedbackData {
    suggestionId: string;
    contentId: string;
    sessionId: string;
    timestamp: Date;

    // User action
    action: 'viewed' | 'clicked' | 'dismissed' | 'saved' | 'shared' | 'ignored';

    // Dismissal feedback
    dismissalReason?: 'not_relevant' | 'bad_timing' | 'already_seen' | 'too_frequent' | 'poor_quality' | 'other';
    dismissalComment?: string;

    // Quality ratings
    relevanceRating?: number; // 1-5 scale
    timingRating?: number; // 1-5 scale
    qualityRating?: number; // 1-5 scale

    // Context at time of feedback
    context: {
        currentUrl: string;
        timeOnPage: number; // seconds
        suggestionPosition: number; // position in list
        totalSuggestions: number;
        deviceType: 'desktop' | 'mobile' | 'tablet';
        timeOfDay: number; // 0-23
        dayOfWeek: number; // 0-6
    };

    // Engagement metrics
    timeToAction: number; // milliseconds from show to action
    hoverDuration?: number; // milliseconds
    clickPosition?: { x: number; y: number };

    // Additional metadata
    suggestionMetadata: {
        relevanceScore: number;
        priority: string;
        matchReasons: string[];
        suggestedTiming: string;
    };
}

export interface FeedbackAnalytics {
    totalFeedback: number;
    actionDistribution: Record<string, number>;
    dismissalReasons: Record<string, number>;
    averageRatings: {
        relevance: number;
        timing: number;
        quality: number;
    };
    engagementMetrics: {
        averageTimeToAction: number;
        averageHoverDuration: number;
        clickThroughRate: number;
        dismissalRate: number;
    };
    contextualInsights: {
        bestPerformingTimes: number[];
        bestPerformingDays: number[];
        devicePerformance: Record<string, number>;
        positionEffectiveness: Record<number, number>;
    };
    qualityTrends: {
        improvementRate: number; // percentage change over time
        recentTrend: 'improving' | 'stable' | 'declining';
        problemAreas: string[];
    };
}

export interface FeedbackPrompt {
    id: string;
    type: 'quick_rating' | 'detailed_survey' | 'dismissal_reason' | 'quality_check';
    trigger: 'after_dismissal' | 'after_engagement' | 'periodic' | 'low_performance';
    content: {
        title: string;
        message: string;
        options?: Array<{ value: string; label: string }>;
        allowComment?: boolean;
    };
    timing: {
        showAfter: number; // milliseconds
        autoHide: number; // milliseconds, 0 for manual
    };
}

export class FeedbackCollector {
    private feedbackHistory: FeedbackData[] = [];
    private pendingPrompts: Map<string, FeedbackPrompt> = new Map();
    private analytics: FeedbackAnalytics | null = null;
    private readonly maxHistorySize = 1000;

    // Callbacks for feedback events
    private feedbackCallbacks: Array<(feedback: FeedbackData) => void> = [];
    private analyticsCallbacks: Array<(analytics: FeedbackAnalytics) => void> = [];

    /**
     * Records user feedback for a suggestion
     */
    recordFeedback(feedback: Omit<FeedbackData, 'timestamp'>): void {
        const completeFeedback: FeedbackData = {
            ...feedback,
            timestamp: new Date()
        };

        // Add to history
        this.feedbackHistory.push(completeFeedback);

        // Maintain history size limit
        if (this.feedbackHistory.length > this.maxHistorySize) {
            this.feedbackHistory = this.feedbackHistory.slice(-this.maxHistorySize);
        }

        // Update analytics
        this.updateAnalytics();

        // Notify callbacks
        this.feedbackCallbacks.forEach(callback => {
            try {
                callback(completeFeedback);
            } catch (error) {
                console.error('Error in feedback callback:', error);
            }
        });

        // Check if we should show a feedback prompt
        this.checkForFeedbackPrompts(completeFeedback);
    }

    /**
     * Shows a feedback prompt to the user
     */
    showFeedbackPrompt(prompt: FeedbackPrompt): void {
        this.pendingPrompts.set(prompt.id, prompt);

        setTimeout(() => {
            this.displayPrompt(prompt);
        }, prompt.timing.showAfter);
    }

    /**
     * Handles user response to a feedback prompt
     */
    handlePromptResponse(
        promptId: string,
        response: {
            rating?: number;
            selectedOption?: string;
            comment?: string;
            dismissed?: boolean;
        }
    ): void {
        const prompt = this.pendingPrompts.get(promptId);
        if (!prompt) return;

        // Record the prompt response as feedback
        if (!response.dismissed) {
            // This would typically be associated with a specific suggestion
            // For now, we'll create a general feedback entry
            const feedbackData: Omit<FeedbackData, 'timestamp'> = {
                suggestionId: 'prompt-response',
                contentId: 'prompt-response',
                sessionId: 'current-session',
                action: 'viewed',
                context: this.getCurrentContext(),
                timeToAction: 0,
                suggestionMetadata: {
                    relevanceScore: 0,
                    priority: 'medium',
                    matchReasons: [],
                    suggestedTiming: 'immediate'
                }
            };

            if (response.rating) {
                switch (prompt.type) {
                    case 'quick_rating':
                        feedbackData.qualityRating = response.rating;
                        break;
                    case 'detailed_survey':
                        feedbackData.relevanceRating = response.rating;
                        break;
                }
            }

            if (response.selectedOption) {
                feedbackData.dismissalReason = response.selectedOption as any;
            }

            if (response.comment) {
                feedbackData.dismissalComment = response.comment;
            }

            this.recordFeedback(feedbackData);
        }

        // Remove prompt
        this.pendingPrompts.delete(promptId);
        this.hidePrompt(promptId);
    }

    /**
     * Gets current feedback analytics
     */
    getAnalytics(): FeedbackAnalytics {
        if (!this.analytics) {
            this.updateAnalytics();
        }
        return this.analytics!;
    }

    /**
     * Gets feedback history with optional filtering
     */
    getFeedbackHistory(
        filter?: {
            startDate?: Date;
            endDate?: Date;
            action?: string;
            contentId?: string;
        },
        limit?: number
    ): FeedbackData[] {
        let filtered = [...this.feedbackHistory];

        if (filter) {
            if (filter.startDate) {
                filtered = filtered.filter(f => f.timestamp >= filter.startDate!);
            }
            if (filter.endDate) {
                filtered = filtered.filter(f => f.timestamp <= filter.endDate!);
            }
            if (filter.action) {
                filtered = filtered.filter(f => f.action === filter.action);
            }
            if (filter.contentId) {
                filtered = filtered.filter(f => f.contentId === filter.contentId);
            }
        }

        return limit ? filtered.slice(-limit) : filtered;
    }

    /**
     * Adds callback for feedback events
     */
    onFeedback(callback: (feedback: FeedbackData) => void): void {
        this.feedbackCallbacks.push(callback);
    }

    /**
     * Adds callback for analytics updates
     */
    onAnalyticsUpdate(callback: (analytics: FeedbackAnalytics) => void): void {
        this.analyticsCallbacks.push(callback);
    }

    /**
     * Exports feedback data for analysis or backup
     */
    exportData(): {
        feedbackHistory: FeedbackData[];
        analytics: FeedbackAnalytics;
    } {
        return {
            feedbackHistory: this.getFeedbackHistory(),
            analytics: this.getAnalytics()
        };
    }

    /**
     * Imports feedback data from backup
     */
    importData(data: {
        feedbackHistory?: FeedbackData[];
        analytics?: FeedbackAnalytics;
    }): void {
        if (data.feedbackHistory) {
            this.feedbackHistory = data.feedbackHistory.slice(-this.maxHistorySize);
            this.updateAnalytics();
        }

        if (data.analytics) {
            this.analytics = data.analytics;
        }
    }

    /**
     * Updates analytics based on current feedback history
     */
    private updateAnalytics(): void {
        const feedback = this.feedbackHistory;

        if (feedback.length === 0) {
            this.analytics = this.getEmptyAnalytics();
            return;
        }

        // Action distribution
        const actionDistribution: Record<string, number> = {};
        feedback.forEach(f => {
            actionDistribution[f.action] = (actionDistribution[f.action] || 0) + 1;
        });

        // Dismissal reasons
        const dismissalReasons: Record<string, number> = {};
        feedback.filter(f => f.dismissalReason).forEach(f => {
            dismissalReasons[f.dismissalReason!] = (dismissalReasons[f.dismissalReason!] || 0) + 1;
        });

        // Average ratings
        const relevanceRatings = feedback.filter(f => f.relevanceRating).map(f => f.relevanceRating!);
        const timingRatings = feedback.filter(f => f.timingRating).map(f => f.timingRating!);
        const qualityRatings = feedback.filter(f => f.qualityRating).map(f => f.qualityRating!);

        const averageRatings = {
            relevance: relevanceRatings.length > 0 ? relevanceRatings.reduce((a, b) => a + b, 0) / relevanceRatings.length : 0,
            timing: timingRatings.length > 0 ? timingRatings.reduce((a, b) => a + b, 0) / timingRatings.length : 0,
            quality: qualityRatings.length > 0 ? qualityRatings.reduce((a, b) => a + b, 0) / qualityRatings.length : 0
        };

        // Engagement metrics
        const timeToActions = feedback.filter(f => f.timeToAction > 0).map(f => f.timeToAction);
        const hoverDurations = feedback.filter(f => f.hoverDuration).map(f => f.hoverDuration!);
        const clickThroughs = feedback.filter(f => f.action === 'clicked').length;
        const dismissals = feedback.filter(f => f.action === 'dismissed').length;

        const engagementMetrics = {
            averageTimeToAction: timeToActions.length > 0 ? timeToActions.reduce((a, b) => a + b, 0) / timeToActions.length : 0,
            averageHoverDuration: hoverDurations.length > 0 ? hoverDurations.reduce((a, b) => a + b, 0) / hoverDurations.length : 0,
            clickThroughRate: feedback.length > 0 ? clickThroughs / feedback.length : 0,
            dismissalRate: feedback.length > 0 ? dismissals / feedback.length : 0
        };

        // Contextual insights
        const timePerformance: Record<number, { total: number; engaged: number }> = {};
        const dayPerformance: Record<number, { total: number; engaged: number }> = {};
        const devicePerformance: Record<string, { total: number; engaged: number }> = {};
        const positionPerformance: Record<number, { total: number; engaged: number }> = {};

        feedback.forEach(f => {
            const hour = f.context.timeOfDay;
            const day = f.context.dayOfWeek;
            const device = f.context.deviceType;
            const position = f.context.suggestionPosition;
            const engaged = ['clicked', 'viewed', 'saved', 'shared'].includes(f.action);

            // Time performance
            if (!timePerformance[hour]) timePerformance[hour] = { total: 0, engaged: 0 };
            timePerformance[hour].total++;
            if (engaged) timePerformance[hour].engaged++;

            // Day performance
            if (!dayPerformance[day]) dayPerformance[day] = { total: 0, engaged: 0 };
            dayPerformance[day].total++;
            if (engaged) dayPerformance[day].engaged++;

            // Device performance
            if (!devicePerformance[device]) devicePerformance[device] = { total: 0, engaged: 0 };
            devicePerformance[device].total++;
            if (engaged) devicePerformance[device].engaged++;

            // Position performance
            if (!positionPerformance[position]) positionPerformance[position] = { total: 0, engaged: 0 };
            positionPerformance[position].total++;
            if (engaged) positionPerformance[position].engaged++;
        });

        const bestPerformingTimes = Object.entries(timePerformance)
            .filter(([, stats]) => stats.total >= 5) // Minimum sample size
            .sort(([, a], [, b]) => (b.engaged / b.total) - (a.engaged / a.total))
            .slice(0, 5)
            .map(([hour]) => parseInt(hour));

        const bestPerformingDays = Object.entries(dayPerformance)
            .filter(([, stats]) => stats.total >= 3)
            .sort(([, a], [, b]) => (b.engaged / b.total) - (a.engaged / a.total))
            .slice(0, 3)
            .map(([day]) => parseInt(day));

        const devicePerformanceRates: Record<string, number> = {};
        Object.entries(devicePerformance).forEach(([device, stats]) => {
            devicePerformanceRates[device] = stats.total > 0 ? stats.engaged / stats.total : 0;
        });

        const positionEffectiveness: Record<number, number> = {};
        Object.entries(positionPerformance).forEach(([position, stats]) => {
            positionEffectiveness[parseInt(position)] = stats.total > 0 ? stats.engaged / stats.total : 0;
        });

        // Quality trends
        const recentFeedback = feedback.filter(f => {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return f.timestamp >= weekAgo;
        });

        const recentEngagementRate = recentFeedback.length > 0
            ? recentFeedback.filter(f => ['clicked', 'viewed', 'saved', 'shared'].includes(f.action)).length / recentFeedback.length
            : 0;

        const overallEngagementRate = engagementMetrics.clickThroughRate;
        const improvementRate = overallEngagementRate > 0
            ? ((recentEngagementRate - overallEngagementRate) / overallEngagementRate) * 100
            : 0;

        let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
        if (improvementRate > 5) recentTrend = 'improving';
        else if (improvementRate < -5) recentTrend = 'declining';

        // Problem areas
        const problemAreas: string[] = [];
        if (engagementMetrics.dismissalRate > 0.6) problemAreas.push('high_dismissal_rate');
        if (averageRatings.relevance < 3) problemAreas.push('low_relevance_ratings');
        if (averageRatings.timing < 3) problemAreas.push('poor_timing');
        if (engagementMetrics.averageTimeToAction > 10000) problemAreas.push('slow_user_response');

        this.analytics = {
            totalFeedback: feedback.length,
            actionDistribution,
            dismissalReasons,
            averageRatings,
            engagementMetrics,
            contextualInsights: {
                bestPerformingTimes,
                bestPerformingDays,
                devicePerformance: devicePerformanceRates,
                positionEffectiveness
            },
            qualityTrends: {
                improvementRate,
                recentTrend,
                problemAreas
            }
        };

        // Notify analytics callbacks
        this.analyticsCallbacks.forEach(callback => {
            try {
                callback(this.analytics!);
            } catch (error) {
                console.error('Error in analytics callback:', error);
            }
        });
    }

    /**
     * Checks if feedback prompts should be shown based on recent feedback
     */
    private checkForFeedbackPrompts(feedback: FeedbackData): void {
        // Show dismissal reason prompt after dismissal
        if (feedback.action === 'dismissed' && !feedback.dismissalReason) {
            const prompt: FeedbackPrompt = {
                id: `dismissal-${Date.now()}`,
                type: 'dismissal_reason',
                trigger: 'after_dismissal',
                content: {
                    title: 'Help us improve',
                    message: 'Why did you dismiss this suggestion?',
                    options: [
                        { value: 'not_relevant', label: 'Not relevant to what I\'m doing' },
                        { value: 'bad_timing', label: 'Bad timing' },
                        { value: 'already_seen', label: 'I\'ve already seen this' },
                        { value: 'too_frequent', label: 'Too many suggestions' },
                        { value: 'poor_quality', label: 'Poor quality content' },
                        { value: 'other', label: 'Other reason' }
                    ],
                    allowComment: true
                },
                timing: {
                    showAfter: 1000, // 1 second delay
                    autoHide: 15000 // 15 seconds
                }
            };

            this.showFeedbackPrompt(prompt);
        }

        // Show quality check prompt after engagement
        if (['clicked', 'viewed'].includes(feedback.action) && Math.random() < 0.1) { // 10% chance
            const prompt: FeedbackPrompt = {
                id: `quality-${Date.now()}`,
                type: 'quick_rating',
                trigger: 'after_engagement',
                content: {
                    title: 'Quick feedback',
                    message: 'How relevant was this suggestion?'
                },
                timing: {
                    showAfter: 5000, // 5 seconds delay
                    autoHide: 10000 // 10 seconds
                }
            };

            this.showFeedbackPrompt(prompt);
        }
    }

    /**
     * Displays a feedback prompt to the user
     */
    private displayPrompt(prompt: FeedbackPrompt): void {
        // This would integrate with the UI system to show the prompt
        // For now, we'll dispatch a custom event
        const event = new CustomEvent('mindscribe-feedback-prompt', {
            detail: { prompt }
        });

        window.dispatchEvent(event);

        // Auto-hide if specified
        if (prompt.timing.autoHide > 0) {
            setTimeout(() => {
                this.hidePrompt(prompt.id);
            }, prompt.timing.autoHide);
        }
    }

    /**
     * Hides a feedback prompt
     */
    private hidePrompt(promptId: string): void {
        const event = new CustomEvent('mindscribe-hide-feedback-prompt', {
            detail: { promptId }
        });

        window.dispatchEvent(event);
    }

    /**
     * Gets current browsing context
     */
    private getCurrentContext(): FeedbackData['context'] {
        return {
            currentUrl: window.location.href,
            timeOnPage: 0, // Would be calculated based on page load time
            suggestionPosition: 1,
            totalSuggestions: 1,
            deviceType: this.detectDeviceType(),
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay()
        };
    }

    /**
     * Detects device type based on user agent and screen size
     */
    private detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
        const userAgent = navigator.userAgent.toLowerCase();
        const screenWidth = window.screen.width;

        if (/mobile|android|iphone/.test(userAgent) || screenWidth < 768) {
            return 'mobile';
        } else if (/tablet|ipad/.test(userAgent) || (screenWidth >= 768 && screenWidth < 1024)) {
            return 'tablet';
        } else {
            return 'desktop';
        }
    }

    /**
     * Gets empty analytics structure
     */
    private getEmptyAnalytics(): FeedbackAnalytics {
        return {
            totalFeedback: 0,
            actionDistribution: {},
            dismissalReasons: {},
            averageRatings: {
                relevance: 0,
                timing: 0,
                quality: 0
            },
            engagementMetrics: {
                averageTimeToAction: 0,
                averageHoverDuration: 0,
                clickThroughRate: 0,
                dismissalRate: 0
            },
            contextualInsights: {
                bestPerformingTimes: [],
                bestPerformingDays: [],
                devicePerformance: {},
                positionEffectiveness: {}
            },
            qualityTrends: {
                improvementRate: 0,
                recentTrend: 'stable',
                problemAreas: []
            }
        };
    }
}

// Export singleton instance
export const feedbackCollector = new FeedbackCollector();