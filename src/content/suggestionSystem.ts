// Complete suggestion system integration for content resurfacing

import { contextIntegration, ContextualSuggestion, ContextAnalysisSession } from './contextIntegration.js';
import { notificationSystem, NotificationOptions, NotificationInteraction } from './notificationSystem.js';
import { suggestionRanker, RankingCriteria, FilterCriteria, SuggestionContext } from './suggestionRanker.js';
import { feedbackCollector, FeedbackData } from './feedbackCollector.js';
import { preferenceManager } from './preferenceManager.js';
import { resurfacingTimer } from './resurfacingTimer.js';

export interface SuggestionSystemOptions {
    // Context analysis options
    enableRealTimeAnalysis: boolean;
    contextAnalysisInterval: number; // seconds
    minContextConfidence: number;

    // Ranking and filtering
    rankingCriteria: Partial<RankingCriteria>;
    filterCriteria: Partial<FilterCriteria>;

    // Notification options
    notificationOptions: Partial<NotificationOptions>;

    // System behavior
    maxActiveSuggestions: number;
    suggestionCooldownMinutes: number;
    enableLearning: boolean;
    enableFeedbackCollection: boolean;
}

export interface SuggestionSystemState {
    isActive: boolean;
    currentSession: ContextAnalysisSession | null;
    activeSuggestions: Array<{
        id: string;
        suggestion: ContextualSuggestion;
        notificationId: string;
        showTime: Date;
        status: 'pending' | 'shown' | 'interacted' | 'dismissed' | 'expired';
    }>;
    lastAnalysisTime: Date | null;
    systemMetrics: {
        totalSuggestions: number;
        totalInteractions: number;
        engagementRate: number;
        averageRelevanceScore: number;
    };
}

export class SuggestionSystem {
    private options: SuggestionSystemOptions;
    private state: SuggestionSystemState;
    private analysisTimer: number | null = null;
    private cooldownTimer: number | null = null;
    private isInCooldown = false;

    private readonly defaultOptions: SuggestionSystemOptions = {
        enableRealTimeAnalysis: true,
        contextAnalysisInterval: 30, // 30 seconds
        minContextConfidence: 0.3,
        rankingCriteria: {},
        filterCriteria: {},
        notificationOptions: {
            position: 'top-right',
            duration: 8000,
            style: 'contextual',
            enableSound: false,
            enableAnimation: true,
            maxConcurrentNotifications: 2
        },
        maxActiveSuggestions: 3,
        suggestionCooldownMinutes: 5,
        enableLearning: true,
        enableFeedbackCollection: true
    };

    constructor(options: Partial<SuggestionSystemOptions> = {}) {
        this.options = { ...this.defaultOptions, ...options };
        this.state = this.getInitialState();
        this.initialize();
    }

    /**
     * Starts the suggestion system
     */
    async start(): Promise<void> {
        if (this.state.isActive) return;

        this.state.isActive = true;

        // Start real-time analysis if enabled
        if (this.options.enableRealTimeAnalysis) {
            this.startRealTimeAnalysis();
        }

        // Perform initial analysis
        await this.performContextAnalysis();
    }

    /**
     * Stops the suggestion system
     */
    stop(): void {
        this.state.isActive = false;

        // Clear timers
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }

        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
            this.cooldownTimer = null;
        }

        // Dismiss all active notifications
        notificationSystem.dismissAllNotifications('user_request');

        // Clear active suggestions
        this.state.activeSuggestions = [];
    }

    /**
     * Performs context analysis and shows relevant suggestions
     */
    async performContextAnalysis(): Promise<void> {
        if (!this.state.isActive || this.isInCooldown) return;

        try {
            // Analyze current context
            const session = await contextIntegration.analyzeCurrentContext({
                enableRealTimeAnalysis: this.options.enableRealTimeAnalysis,
                enablePreferenceAdjustment: this.options.enableLearning,
                enableTimingOptimization: true,
                maxSuggestionsPerSession: this.options.maxActiveSuggestions,
                minContextConfidence: this.options.minContextConfidence
            });

            this.state.currentSession = session;
            this.state.lastAnalysisTime = new Date();

            if (session.suggestions.length === 0) {
                return; // No relevant suggestions found
            }

            // Rank and filter suggestions
            const rankedResult = suggestionRanker.rankSuggestions(
                session.suggestions,
                this.getCurrentSuggestionContext(),
                preferenceManager.getPreferences(),
                preferenceManager.getLearningMetrics(),
                this.options.rankingCriteria,
                this.options.filterCriteria
            );

            // Show top suggestions
            await this.showSuggestions(rankedResult.rankedSuggestions);

        } catch (error) {
            console.error('Context analysis failed:', error);
        }
    }

    /**
     * Shows suggestions to the user
     */
    private async showSuggestions(suggestions: ContextualSuggestion[]): Promise<void> {
        const maxToShow = Math.min(
            suggestions.length,
            this.options.maxActiveSuggestions,
            this.options.notificationOptions.maxConcurrentNotifications || 2
        );

        for (let i = 0; i < maxToShow; i++) {
            const suggestion = suggestions[i];

            // Check if we should show this suggestion based on timing
            const now = new Date();
            const suggestedTime = suggestion.suggestedTiming.suggestedTime;

            if (suggestedTime > now) {
                // Schedule for later
                const delay = suggestedTime.getTime() - now.getTime();
                setTimeout(() => {
                    this.showSingleSuggestion(suggestion);
                }, delay);
            } else {
                // Show immediately
                this.showSingleSuggestion(suggestion);
            }
        }

        // Start cooldown period
        this.startCooldownPeriod();
    }

    /**
     * Shows a single suggestion notification
     */
    private showSingleSuggestion(suggestion: ContextualSuggestion): void {
        if (!this.state.isActive) return;

        // Show notification
        const notificationId = notificationSystem.showSuggestion(
            suggestion,
            this.options.notificationOptions
        );

        // Track active suggestion
        const activeSuggestion = {
            id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            suggestion,
            notificationId,
            showTime: new Date(),
            status: 'shown' as const
        };

        this.state.activeSuggestions.push(activeSuggestion);

        // Update metrics
        this.state.systemMetrics.totalSuggestions++;
        this.updateAverageRelevanceScore(suggestion.relevanceScore);

        // Record with timing system
        resurfacingTimer.recordSuggestion(suggestion.contentId);
    }

    /**
     * Handles user interaction with suggestions
     */
    handleSuggestionInteraction(
        notificationId: string,
        interaction: NotificationInteraction
    ): void {
        const activeSuggestion = this.state.activeSuggestions.find(
            s => s.notificationId === notificationId
        );

        if (!activeSuggestion) return;

        // Update suggestion status
        if (['clicked', 'viewed', 'saved', 'shared'].includes(interaction.action)) {
            activeSuggestion.status = 'interacted';
            this.state.systemMetrics.totalInteractions++;
        } else if (interaction.action === 'dismissed') {
            activeSuggestion.status = 'dismissed';
        }

        // Record with context integration
        contextIntegration.recordInteraction(
            activeSuggestion.id,
            interaction.action as any,
            interaction.dismissalReason,
            interaction.timeVisible
        );

        // Collect feedback if enabled
        if (this.options.enableFeedbackCollection) {
            this.collectFeedback(activeSuggestion, interaction);
        }

        // Update engagement rate
        this.updateEngagementRate();
    }

    /**
     * Collects feedback for suggestion interactions
     */
    private collectFeedback(
        activeSuggestion: SuggestionSystemState['activeSuggestions'][0],
        interaction: NotificationInteraction
    ): void {
        const feedbackData: Omit<FeedbackData, 'timestamp'> = {
            suggestionId: activeSuggestion.id,
            contentId: activeSuggestion.suggestion.contentId,
            sessionId: this.state.currentSession?.sessionId || 'unknown',
            action: interaction.action as any,
            dismissalReason: interaction.dismissalReason as any,
            context: {
                currentUrl: window.location.href,
                timeOnPage: interaction.timeVisible / 1000,
                suggestionPosition: this.state.activeSuggestions.indexOf(activeSuggestion) + 1,
                totalSuggestions: this.state.activeSuggestions.length,
                deviceType: this.detectDeviceType(),
                timeOfDay: new Date().getHours(),
                dayOfWeek: new Date().getDay()
            },
            timeToAction: interaction.timeVisible,
            suggestionMetadata: {
                relevanceScore: activeSuggestion.suggestion.relevanceScore,
                priority: activeSuggestion.suggestion.priority,
                matchReasons: activeSuggestion.suggestion.matchReasons,
                suggestedTiming: activeSuggestion.suggestion.suggestedTiming.urgency
            }
        };

        feedbackCollector.recordFeedback(feedbackData);
    }

    /**
     * Gets current suggestion context
     */
    private getCurrentSuggestionContext(): SuggestionContext {
        const now = new Date();

        return {
            currentUrl: window.location.href,
            currentCategory: this.state.currentSession?.context.category || 'other',
            timeOfDay: now.getHours(),
            dayOfWeek: now.getDay(),
            userActivity: this.detectUserActivity(),
            sessionDuration: this.calculateSessionDuration()
        };
    }

    /**
     * Detects current user activity based on context
     */
    private detectUserActivity(): SuggestionContext['userActivity'] {
        const url = window.location.href.toLowerCase();
        const title = document.title.toLowerCase();

        // Simple heuristics for activity detection
        if (url.includes('docs') || url.includes('documentation') || title.includes('documentation')) {
            return 'researching';
        }

        if (url.includes('read') || title.includes('article') || title.includes('blog')) {
            return 'reading';
        }

        if (url.includes('work') || url.includes('dashboard') || url.includes('admin')) {
            return 'working';
        }

        return 'browsing';
    }

    /**
     * Calculates current session duration
     */
    private calculateSessionDuration(): number {
        if (!this.state.currentSession) return 0;

        const now = new Date();
        const sessionStart = this.state.currentSession.startTime;
        return Math.floor((now.getTime() - sessionStart.getTime()) / (1000 * 60)); // minutes
    }

    /**
     * Starts real-time context analysis
     */
    private startRealTimeAnalysis(): void {
        if (this.analysisTimer) return;

        this.analysisTimer = window.setInterval(() => {
            this.performContextAnalysis();
        }, this.options.contextAnalysisInterval * 1000);
    }

    /**
     * Starts cooldown period to prevent suggestion spam
     */
    private startCooldownPeriod(): void {
        this.isInCooldown = true;

        this.cooldownTimer = window.setTimeout(() => {
            this.isInCooldown = false;
            this.cooldownTimer = null;
        }, this.options.suggestionCooldownMinutes * 60 * 1000);
    }

    /**
     * Updates average relevance score metric
     */
    private updateAverageRelevanceScore(newScore: number): void {
        const current = this.state.systemMetrics.averageRelevanceScore;
        const total = this.state.systemMetrics.totalSuggestions;

        this.state.systemMetrics.averageRelevanceScore =
            (current * (total - 1) + newScore) / total;
    }

    /**
     * Updates engagement rate metric
     */
    private updateEngagementRate(): void {
        const total = this.state.systemMetrics.totalSuggestions;
        const interactions = this.state.systemMetrics.totalInteractions;

        this.state.systemMetrics.engagementRate = total > 0 ? interactions / total : 0;
    }

    /**
     * Detects device type
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
     * Initializes the suggestion system
     */
    private initialize(): void {
        // Set up notification interaction handler
        notificationSystem.onInteraction((interaction) => {
            this.handleSuggestionInteraction(interaction.notificationId, interaction);
        });

        // Set up feedback collection if enabled
        if (this.options.enableFeedbackCollection) {
            feedbackCollector.onFeedback((feedback) => {
                // Could implement additional feedback processing here
            });
        }

        // Set up page visibility handling
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });

        // Set up page unload handling
        window.addEventListener('beforeunload', () => {
            this.stop();
        });
    }

    /**
     * Handles page becoming hidden
     */
    private handlePageHidden(): void {
        // Pause real-time analysis
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
    }

    /**
     * Handles page becoming visible
     */
    private handlePageVisible(): void {
        // Resume real-time analysis if active
        if (this.state.isActive && this.options.enableRealTimeAnalysis) {
            this.startRealTimeAnalysis();
        }
    }

    /**
     * Gets initial system state
     */
    private getInitialState(): SuggestionSystemState {
        return {
            isActive: false,
            currentSession: null,
            activeSuggestions: [],
            lastAnalysisTime: null,
            systemMetrics: {
                totalSuggestions: 0,
                totalInteractions: 0,
                engagementRate: 0,
                averageRelevanceScore: 0
            }
        };
    }

    /**
     * Gets current system state
     */
    getState(): SuggestionSystemState {
        return { ...this.state };
    }

    /**
     * Updates system options
     */
    updateOptions(options: Partial<SuggestionSystemOptions>): void {
        this.options = { ...this.options, ...options };

        // Update notification system options if changed
        if (options.notificationOptions) {
            notificationSystem.updateOptions(options.notificationOptions);
        }

        // Restart real-time analysis if interval changed
        if (options.contextAnalysisInterval && this.state.isActive && this.options.enableRealTimeAnalysis) {
            if (this.analysisTimer) {
                clearInterval(this.analysisTimer);
            }
            this.startRealTimeAnalysis();
        }
    }

    /**
     * Gets system analytics
     */
    getAnalytics(): {
        systemMetrics: SuggestionSystemState['systemMetrics'];
        feedbackAnalytics: any;
        contextAnalytics: any;
    } {
        return {
            systemMetrics: this.state.systemMetrics,
            feedbackAnalytics: feedbackCollector.getAnalytics(),
            contextAnalytics: contextIntegration.getAnalytics()
        };
    }

    /**
     * Exports system data for backup
     */
    exportData(): any {
        return {
            state: this.getState(),
            options: this.options,
            feedbackData: feedbackCollector.exportData(),
            contextData: contextIntegration.exportData(),
            preferenceData: preferenceManager.exportData()
        };
    }

    /**
     * Imports system data from backup
     */
    importData(data: any): void {
        if (data.options) {
            this.updateOptions(data.options);
        }

        if (data.feedbackData) {
            feedbackCollector.importData(data.feedbackData);
        }

        if (data.contextData) {
            contextIntegration.importData(data.contextData);
        }

        if (data.preferenceData) {
            preferenceManager.importData(data.preferenceData);
        }
    }
}

// Export singleton instance
export const suggestionSystem = new SuggestionSystem();