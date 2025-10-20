// Integration module for context analysis and content resurfacing

import { contextAnalyzer, ContextAnalysisResult, BrowsingContext, RelevanceMatch } from './contextAnalyzer.js';
import { resurfacingTimer, ResurfacingTiming } from './resurfacingTimer.js';
import { preferenceManager, InteractionEvent } from './preferenceManager.js';
import { StoredContent } from '../types/storage.js';
import { ContentStore } from '../storage/contentStore.js';

export interface ContextualSuggestion {
    contentId: string;
    content: StoredContent;
    relevanceScore: number;
    matchReasons: string[];
    suggestedTiming: ResurfacingTiming;
    priority: 'high' | 'medium' | 'low';
    confidence: number;
}

export interface ContextAnalysisSession {
    sessionId: string;
    startTime: Date;
    context: BrowsingContext;
    suggestions: ContextualSuggestion[];
    userInteractions: InteractionEvent[];
    status: 'active' | 'completed' | 'abandoned';
}

export interface ContextIntegrationOptions {
    enableRealTimeAnalysis: boolean;
    enablePreferenceAdjustment: boolean;
    enableTimingOptimization: boolean;
    maxSuggestionsPerSession: number;
    sessionTimeoutMinutes: number;
    minContextConfidence: number;
}

export class ContextIntegration {
    private contentStore: ContentStore;
    private currentSession: ContextAnalysisSession | null = null;
    private sessionHistory: ContextAnalysisSession[] = [];
    private readonly maxSessionHistory = 50;

    private readonly defaultOptions: ContextIntegrationOptions = {
        enableRealTimeAnalysis: true,
        enablePreferenceAdjustment: true,
        enableTimingOptimization: true,
        maxSuggestionsPerSession: 5,
        sessionTimeoutMinutes: 30,
        minContextConfidence: 0.3
    };

    constructor() {
        this.contentStore = ContentStore.getInstance();
        this.initializeEventListeners();
    }

    /**
     * Analyzes current browsing context and generates contextual suggestions
     */
    async analyzeCurrentContext(
        options: Partial<ContextIntegrationOptions> = {}
    ): Promise<ContextAnalysisSession> {
        const config = { ...this.defaultOptions, ...options };
        const sessionId = this.generateSessionId();

        try {
            // Get all stored content
            const contentResult = await this.contentStore.list();
            if (!contentResult.success || !contentResult.data) {
                throw new Error('Failed to retrieve stored content');
            }

            const storedContent = contentResult.data;

            // Analyze current context
            const analysisResult = await contextAnalyzer.analyzeCurrentContext(storedContent, {
                minRelevanceThreshold: 0.2, // Lower threshold for initial analysis
                maxSuggestions: config.maxSuggestionsPerSession * 2 // Get more candidates
            });

            if (!analysisResult.success) {
                throw new Error(analysisResult.error || 'Context analysis failed');
            }

            // Filter by context confidence
            if (analysisResult.context.confidence < config.minContextConfidence) {
                console.warn('Low context confidence, limiting suggestions');
            }

            // Apply preference adjustments
            let relevanceMatches = analysisResult.relevantContent;
            if (config.enablePreferenceAdjustment) {
                relevanceMatches = preferenceManager.adjustSuggestionQuality(
                    relevanceMatches,
                    storedContent
                );
            }

            // Generate timing suggestions and create contextual suggestions
            const suggestions: ContextualSuggestion[] = [];

            for (const match of relevanceMatches.slice(0, config.maxSuggestionsPerSession)) {
                const content = storedContent.find(c => c.id === match.contentId);
                if (!content) continue;

                // Calculate optimal timing
                let timing: ResurfacingTiming;
                if (config.enableTimingOptimization) {
                    timing = resurfacingTimer.calculateOptimalTiming(content, match);
                } else {
                    timing = {
                        contentId: content.id,
                        suggestedTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes default
                        confidence: 0.5,
                        reason: 'Default timing',
                        urgency: 'later'
                    };
                }

                suggestions.push({
                    contentId: content.id,
                    content,
                    relevanceScore: match.relevanceScore,
                    matchReasons: match.matchReasons,
                    suggestedTiming: timing,
                    priority: match.priority,
                    confidence: timing.confidence
                });
            }

            // Create session
            const session: ContextAnalysisSession = {
                sessionId,
                startTime: new Date(),
                context: analysisResult.context,
                suggestions,
                userInteractions: [],
                status: 'active'
            };

            // Set as current session
            this.currentSession = session;

            // Schedule suggestions based on timing
            this.scheduleSuggestions(session);

            return session;

        } catch (error) {
            // Create empty session on error
            const errorSession: ContextAnalysisSession = {
                sessionId,
                startTime: new Date(),
                context: {
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
                },
                suggestions: [],
                userInteractions: [],
                status: 'completed'
            };

            console.error('Context analysis failed:', error);
            return errorSession;
        }
    }

    /**
     * Records user interaction with a suggestion
     */
    recordInteraction(
        suggestionId: string,
        action: InteractionEvent['action'],
        dismissalReason?: InteractionEvent['dismissalReason'],
        engagementDuration?: number
    ): void {
        if (!this.currentSession) return;

        const suggestion = this.currentSession.suggestions.find(s =>
            `${s.contentId}-${this.currentSession!.sessionId}` === suggestionId
        );

        if (!suggestion) return;

        const interaction: InteractionEvent = {
            contentId: suggestion.contentId,
            suggestionId,
            timestamp: new Date(),
            action,
            context: {
                currentUrl: this.currentSession.context.url,
                timeOnPage: Math.floor((Date.now() - this.currentSession.startTime.getTime()) / 1000),
                relevanceScore: suggestion.relevanceScore,
                suggestedTiming: suggestion.suggestedTiming.urgency,
                priority: suggestion.priority
            },
            dismissalReason,
            engagementDuration
        };

        // Add to session
        this.currentSession.userInteractions.push(interaction);

        // Record with preference manager for learning
        preferenceManager.recordInteraction(interaction);

        // Record with timing system
        if (action !== 'ignored') {
            resurfacingTimer.recordSuggestion(suggestion.contentId);
        }

        // Update user behavior patterns
        const hour = new Date().getHours();
        const engaged = ['viewed', 'clicked', 'saved', 'shared'].includes(action);
        resurfacingTimer.updateUserBehavior(
            hour,
            engaged,
            suggestion.content.category,
            dismissalReason
        );
    }

    /**
     * Gets the current active session
     */
    getCurrentSession(): ContextAnalysisSession | null {
        return this.currentSession;
    }

    /**
     * Completes the current session
     */
    completeCurrentSession(): void {
        if (this.currentSession) {
            this.currentSession.status = 'completed';

            // Add to history
            this.sessionHistory.push(this.currentSession);

            // Maintain history size
            if (this.sessionHistory.length > this.maxSessionHistory) {
                this.sessionHistory = this.sessionHistory.slice(-this.maxSessionHistory);
            }

            this.currentSession = null;
        }
    }

    /**
     * Gets session history
     */
    getSessionHistory(limit?: number): ContextAnalysisSession[] {
        const history = [...this.sessionHistory];
        return limit ? history.slice(-limit) : history;
    }

    /**
     * Gets analytics about context analysis performance
     */
    getAnalytics(): {
        totalSessions: number;
        averageSuggestionsPerSession: number;
        overallEngagementRate: number;
        topPerformingCategories: Array<{ category: string; engagementRate: number }>;
        timingEffectiveness: Record<string, number>;
        recentTrends: {
            sessionsLast7Days: number;
            engagementTrendLast7Days: 'improving' | 'stable' | 'declining';
        };
    } {
        const allSessions = [...this.sessionHistory];
        if (this.currentSession) {
            allSessions.push(this.currentSession);
        }

        const totalSessions = allSessions.length;
        const totalSuggestions = allSessions.reduce((sum, s) => sum + s.suggestions.length, 0);
        const totalInteractions = allSessions.reduce((sum, s) => sum + s.userInteractions.length, 0);
        const engagedInteractions = allSessions.reduce((sum, s) =>
            sum + s.userInteractions.filter(i =>
                ['viewed', 'clicked', 'saved', 'shared'].includes(i.action)
            ).length, 0
        );

        // Category performance
        const categoryStats: Record<string, { suggestions: number; engagements: number }> = {};
        allSessions.forEach(session => {
            session.suggestions.forEach(suggestion => {
                const category = suggestion.content.category || 'other';
                if (!categoryStats[category]) {
                    categoryStats[category] = { suggestions: 0, engagements: 0 };
                }
                categoryStats[category].suggestions++;

                const wasEngaged = session.userInteractions.some(i =>
                    i.contentId === suggestion.contentId &&
                    ['viewed', 'clicked', 'saved', 'shared'].includes(i.action)
                );
                if (wasEngaged) {
                    categoryStats[category].engagements++;
                }
            });
        });

        const topPerformingCategories = Object.entries(categoryStats)
            .map(([category, stats]) => ({
                category,
                engagementRate: stats.suggestions > 0 ? stats.engagements / stats.suggestions : 0
            }))
            .sort((a, b) => b.engagementRate - a.engagementRate)
            .slice(0, 5);

        // Timing effectiveness
        const timingStats: Record<string, { suggestions: number; engagements: number }> = {};
        allSessions.forEach(session => {
            session.suggestions.forEach(suggestion => {
                const timing = suggestion.suggestedTiming.urgency;
                if (!timingStats[timing]) {
                    timingStats[timing] = { suggestions: 0, engagements: 0 };
                }
                timingStats[timing].suggestions++;

                const wasEngaged = session.userInteractions.some(i =>
                    i.contentId === suggestion.contentId &&
                    ['viewed', 'clicked', 'saved', 'shared'].includes(i.action)
                );
                if (wasEngaged) {
                    timingStats[timing].engagements++;
                }
            });
        });

        const timingEffectiveness: Record<string, number> = {};
        Object.entries(timingStats).forEach(([timing, stats]) => {
            timingEffectiveness[timing] = stats.suggestions > 0 ? stats.engagements / stats.suggestions : 0;
        });

        // Recent trends
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentSessions = allSessions.filter(s => s.startTime >= sevenDaysAgo);
        const recentEngagements = recentSessions.reduce((sum, s) =>
            sum + s.userInteractions.filter(i =>
                ['viewed', 'clicked', 'saved', 'shared'].includes(i.action)
            ).length, 0
        );
        const recentSuggestions = recentSessions.reduce((sum, s) => sum + s.suggestions.length, 0);
        const recentEngagementRate = recentSuggestions > 0 ? recentEngagements / recentSuggestions : 0;
        const overallEngagementRate = totalSuggestions > 0 ? engagedInteractions / totalSuggestions : 0;

        let engagementTrend: 'improving' | 'stable' | 'declining' = 'stable';
        if (recentEngagementRate > overallEngagementRate + 0.05) {
            engagementTrend = 'improving';
        } else if (recentEngagementRate < overallEngagementRate - 0.05) {
            engagementTrend = 'declining';
        }

        return {
            totalSessions,
            averageSuggestionsPerSession: totalSessions > 0 ? totalSuggestions / totalSessions : 0,
            overallEngagementRate,
            topPerformingCategories,
            timingEffectiveness,
            recentTrends: {
                sessionsLast7Days: recentSessions.length,
                engagementTrendLast7Days: engagementTrend
            }
        };
    }

    /**
     * Schedules suggestions based on their timing
     */
    private scheduleSuggestions(session: ContextAnalysisSession): void {
        session.suggestions.forEach(suggestion => {
            const delay = suggestion.suggestedTiming.suggestedTime.getTime() - Date.now();

            if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Within 24 hours
                setTimeout(() => {
                    this.triggerSuggestion(suggestion, session.sessionId);
                }, delay);
            }
        });
    }

    /**
     * Triggers a suggestion notification
     */
    private triggerSuggestion(suggestion: ContextualSuggestion, sessionId: string): void {
        // This would integrate with the notification system
        // For now, we'll just dispatch a custom event
        const event = new CustomEvent('mindscribe-suggestion', {
            detail: {
                suggestion,
                sessionId,
                suggestionId: `${suggestion.contentId}-${sessionId}`
            }
        });

        window.dispatchEvent(event);
    }

    /**
     * Initializes event listeners for page changes and user activity
     */
    private initializeEventListeners(): void {
        // Listen for page navigation
        let lastUrl = window.location.href;

        const checkUrlChange = () => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                this.handlePageChange();
            }
        };

        // Check for URL changes (for SPAs)
        setInterval(checkUrlChange, 1000);

        // Listen for page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });

        // Listen for beforeunload to complete session
        window.addEventListener('beforeunload', () => {
            this.completeCurrentSession();
        });
    }

    /**
     * Handles page changes
     */
    private handlePageChange(): void {
        // Complete current session and start new analysis
        this.completeCurrentSession();

        // Delay new analysis to allow page to load
        setTimeout(() => {
            if (this.defaultOptions.enableRealTimeAnalysis) {
                this.analyzeCurrentContext();
            }
        }, 2000);
    }

    /**
     * Handles page becoming hidden
     */
    private handlePageHidden(): void {
        // Pause current session but don't complete it
        if (this.currentSession && this.currentSession.status === 'active') {
            // Could implement session pausing logic here
        }
    }

    /**
     * Handles page becoming visible
     */
    private handlePageVisible(): void {
        // Resume current session or start new analysis
        if (!this.currentSession && this.defaultOptions.enableRealTimeAnalysis) {
            this.analyzeCurrentContext();
        }
    }

    /**
     * Generates a unique session ID
     */
    private generateSessionId(): string {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Exports all context analysis data
     */
    exportData(): {
        sessionHistory: ContextAnalysisSession[];
        preferences: any;
        analytics: any;
    } {
        return {
            sessionHistory: this.getSessionHistory(),
            preferences: preferenceManager.exportData(),
            analytics: this.getAnalytics()
        };
    }

    /**
     * Imports context analysis data
     */
    importData(data: {
        sessionHistory?: ContextAnalysisSession[];
        preferences?: any;
    }): void {
        if (data.sessionHistory) {
            this.sessionHistory = data.sessionHistory.slice(-this.maxSessionHistory);
        }

        if (data.preferences) {
            preferenceManager.importData(data.preferences);
        }
    }
}

// Export singleton instance
export const contextIntegration = new ContextIntegration();