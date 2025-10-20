// Context management for conversational queries

import { ConversationContext, ConversationMessage, QueryIntent } from './conversationalQuery';
import { StoredContent } from '../types/storage';

export interface ContextualInsight {
    type: 'pattern' | 'gap' | 'connection' | 'trend';
    description: string;
    confidence: number;
    relatedContent: string[];
}

export interface ConversationAnalytics {
    totalConversations: number;
    averageLength: number;
    topTopics: Array<{ topic: string; count: number }>;
    commonQuestions: Array<{ question: string; frequency: number }>;
    knowledgeGaps: string[];
    insights: ContextualInsight[];
}

export class ContextManager {
    private static instance: ContextManager | null = null;
    private contextCache: Map<string, ConversationContext> = new Map();
    private topicPatterns: Map<string, number> = new Map();
    private questionPatterns: Map<string, number> = new Map();

    static getInstance(): ContextManager {
        if (!ContextManager.instance) {
            ContextManager.instance = new ContextManager();
        }
        return ContextManager.instance;
    }

    analyzeConversationContext(context: ConversationContext): ContextualInsight[] {
        const insights: ContextualInsight[] = [];

        // Analyze conversation patterns
        insights.push(...this.analyzeQuestionPatterns(context));
        insights.push(...this.analyzeTopicProgression(context));
        insights.push(...this.identifyKnowledgeGaps(context));
        insights.push(...this.findContentConnections(context));

        return insights.sort((a, b) => b.confidence - a.confidence);
    }

    private analyzeQuestionPatterns(context: ConversationContext): ContextualInsight[] {
        const insights: ContextualInsight[] = [];
        const userMessages = context.messages.filter(m => m.type === 'user');

        if (userMessages.length < 2) return insights;

        // Detect question type patterns
        const questionTypes = userMessages.map(m => this.classifyQuestionType(m.content));
        const typeFrequency = new Map<string, number>();

        questionTypes.forEach(type => {
            typeFrequency.set(type, (typeFrequency.get(type) || 0) + 1);
        });

        // Find dominant pattern
        const dominantType = Array.from(typeFrequency.entries())
            .sort((a, b) => b[1] - a[1])[0];

        if (dominantType && dominantType[1] > 1) {
            insights.push({
                type: 'pattern',
                description: `User frequently asks ${dominantType[0]} questions in this conversation`,
                confidence: Math.min(dominantType[1] / userMessages.length, 1.0),
                relatedContent: Array.from(context.relatedContentIds)
            });
        }

        return insights;
    }

    private analyzeTopicProgression(context: ConversationContext): ContextualInsight[] {
        const insights: ContextualInsight[] = [];
        const userMessages = context.messages.filter(m => m.type === 'user');

        if (userMessages.length < 3) return insights;

        // Extract topics from each message
        const messageTopics = userMessages.map(m => this.extractTopics(m.content));

        // Check for topic drift or focus
        const allTopics = messageTopics.flat();
        const uniqueTopics = new Set(allTopics);
        const topicDiversity = uniqueTopics.size / allTopics.length;

        if (topicDiversity < 0.3) {
            // Focused conversation
            insights.push({
                type: 'pattern',
                description: `Conversation is highly focused on ${Array.from(uniqueTopics).slice(0, 2).join(' and ')}`,
                confidence: 1 - topicDiversity,
                relatedContent: Array.from(context.relatedContentIds)
            });
        } else if (topicDiversity > 0.7) {
            // Scattered conversation
            insights.push({
                type: 'pattern',
                description: 'Conversation covers many different topics - consider focusing on specific areas',
                confidence: topicDiversity,
                relatedContent: Array.from(context.relatedContentIds)
            });
        }

        return insights;
    }

    private identifyKnowledgeGaps(context: ConversationContext): ContextualInsight[] {
        const insights: ContextualInsight[] = [];
        const assistantMessages = context.messages.filter(m => m.type === 'assistant');

        // Look for low-confidence responses or "I don't know" patterns
        const lowConfidenceResponses = assistantMessages.filter(m =>
            m.content.includes("couldn't find") ||
            m.content.includes("don't have") ||
            m.content.includes("not sure") ||
            (m.sources && m.sources.length === 0)
        );

        if (lowConfidenceResponses.length > 0) {
            const gapTopics = lowConfidenceResponses
                .map(m => this.extractTopics(m.content))
                .flat();

            insights.push({
                type: 'gap',
                description: `Knowledge gaps identified in: ${gapTopics.slice(0, 3).join(', ')}`,
                confidence: lowConfidenceResponses.length / assistantMessages.length,
                relatedContent: []
            });
        }

        return insights;
    }

    private findContentConnections(context: ConversationContext): ContextualInsight[] {
        const insights: ContextualInsight[] = [];

        if (context.relatedContentIds.size < 2) return insights;

        // Analyze connections between referenced content
        const contentIds = Array.from(context.relatedContentIds);

        // This would typically involve analyzing the actual content relationships
        // For now, we'll provide a basic insight
        if (contentIds.length >= 3) {
            insights.push({
                type: 'connection',
                description: `Found connections between ${contentIds.length} pieces of content in this conversation`,
                confidence: Math.min(contentIds.length / 10, 1.0),
                relatedContent: contentIds
            });
        }

        return insights;
    }

    private classifyQuestionType(question: string): string {
        const lowerQuestion = question.toLowerCase();

        if (lowerQuestion.startsWith('what')) return 'definition';
        if (lowerQuestion.startsWith('how')) return 'procedure';
        if (lowerQuestion.startsWith('why')) return 'explanation';
        if (lowerQuestion.startsWith('when')) return 'temporal';
        if (lowerQuestion.startsWith('where')) return 'location';
        if (lowerQuestion.startsWith('who')) return 'person';
        if (lowerQuestion.includes(' vs ') || lowerQuestion.includes(' versus ')) return 'comparison';
        if (lowerQuestion.includes('should') || lowerQuestion.includes('recommend')) return 'recommendation';

        return 'general';
    }

    private extractTopics(text: string): string[] {
        // Simple topic extraction - in a real implementation, this could use NLP
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);

        // Remove common question words and stop words
        const stopWords = new Set([
            'what', 'how', 'why', 'when', 'where', 'who', 'which', 'that', 'this',
            'about', 'with', 'from', 'they', 'them', 'their', 'there', 'then',
            'would', 'could', 'should', 'might', 'will', 'can', 'does', 'did'
        ]);

        return words.filter(word => !stopWords.has(word)).slice(0, 5);
    }

    generateContextualSuggestions(context: ConversationContext): string[] {
        const suggestions: string[] = [];
        const insights = this.analyzeConversationContext(context);

        // Generate suggestions based on insights
        for (const insight of insights.slice(0, 3)) {
            switch (insight.type) {
                case 'gap':
                    suggestions.push(`Would you like me to help you find content about ${insight.description.split(':')[1]?.trim()}?`);
                    break;
                case 'connection':
                    suggestions.push('Would you like to explore the connections between these topics?');
                    break;
                case 'pattern':
                    if (insight.description.includes('focused')) {
                        suggestions.push('Would you like to dive deeper into this topic?');
                    } else if (insight.description.includes('different topics')) {
                        suggestions.push('Would you like to focus on one specific area?');
                    }
                    break;
            }
        }

        // Add topic-based suggestions
        if (context.keywords.length > 0) {
            const mainTopic = context.keywords[0];
            suggestions.push(
                `What else would you like to know about ${mainTopic}?`,
                `Are there related topics to ${mainTopic} you're interested in?`
            );
        }

        // Add general suggestions if none generated
        if (suggestions.length === 0) {
            suggestions.push(
                'What would you like to explore next?',
                'Is there anything specific you\'d like to learn more about?',
                'Would you like me to suggest related topics?'
            );
        }

        return suggestions.slice(0, 3);
    }

    async generateConversationAnalytics(conversations: ConversationContext[]): Promise<ConversationAnalytics> {
        const analytics: ConversationAnalytics = {
            totalConversations: conversations.length,
            averageLength: 0,
            topTopics: [],
            commonQuestions: [],
            knowledgeGaps: [],
            insights: []
        };

        if (conversations.length === 0) return analytics;

        // Calculate average conversation length
        const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
        analytics.averageLength = totalMessages / conversations.length;

        // Analyze topics
        const topicCounts = new Map<string, number>();
        conversations.forEach(conv => {
            conv.keywords.forEach(keyword => {
                topicCounts.set(keyword, (topicCounts.get(keyword) || 0) + 1);
            });
        });

        analytics.topTopics = Array.from(topicCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([topic, count]) => ({ topic, count }));

        // Analyze common questions
        const questionCounts = new Map<string, number>();
        conversations.forEach(conv => {
            conv.messages
                .filter(m => m.type === 'user')
                .forEach(m => {
                    const questionType = this.classifyQuestionType(m.content);
                    questionCounts.set(questionType, (questionCounts.get(questionType) || 0) + 1);
                });
        });

        analytics.commonQuestions = Array.from(questionCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([question, frequency]) => ({ question, frequency }));

        // Identify knowledge gaps
        const gapTopics = new Set<string>();
        conversations.forEach(conv => {
            const insights = this.analyzeConversationContext(conv);
            insights
                .filter(insight => insight.type === 'gap')
                .forEach(insight => {
                    const topics = this.extractTopics(insight.description);
                    topics.forEach(topic => gapTopics.add(topic));
                });
        });

        analytics.knowledgeGaps = Array.from(gapTopics).slice(0, 10);

        // Generate overall insights
        analytics.insights = this.generateOverallInsights(conversations);

        return analytics;
    }

    private generateOverallInsights(conversations: ConversationContext[]): ContextualInsight[] {
        const insights: ContextualInsight[] = [];

        if (conversations.length === 0) return insights;

        // Analyze conversation frequency trends
        const now = new Date();
        const recentConversations = conversations.filter(conv =>
            (now.getTime() - conv.lastUpdated.getTime()) < (7 * 24 * 60 * 60 * 1000) // Last 7 days
        );

        if (recentConversations.length > conversations.length * 0.5) {
            insights.push({
                type: 'trend',
                description: 'High conversation activity in recent days - actively engaging with content',
                confidence: recentConversations.length / conversations.length,
                relatedContent: []
            });
        }

        // Analyze topic diversity
        const allTopics = conversations.flatMap(conv => conv.keywords);
        const uniqueTopics = new Set(allTopics);
        const topicDiversity = uniqueTopics.size / Math.max(allTopics.length, 1);

        if (topicDiversity > 0.7) {
            insights.push({
                type: 'pattern',
                description: 'Exploring diverse range of topics - broad learning approach',
                confidence: topicDiversity,
                relatedContent: []
            });
        } else if (topicDiversity < 0.3) {
            insights.push({
                type: 'pattern',
                description: 'Focused on specific topic areas - deep learning approach',
                confidence: 1 - topicDiversity,
                relatedContent: []
            });
        }

        return insights;
    }

    // Cache management
    cacheContext(context: ConversationContext): void {
        this.contextCache.set(context.id, context);

        // Limit cache size
        if (this.contextCache.size > 100) {
            const oldestKey = this.contextCache.keys().next().value;
            this.contextCache.delete(oldestKey);
        }
    }

    getCachedContext(contextId: string): ConversationContext | null {
        return this.contextCache.get(contextId) || null;
    }

    clearCache(): void {
        this.contextCache.clear();
    }
}