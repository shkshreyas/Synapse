// Conversational query system for chat-like content interaction

import { NaturalLanguageSearch, SemanticMatch, QueryIntent } from './naturalLanguageSearch';
import { SearchRanking } from './searchRanking';
import { StoredContent } from '../types/storage';
import { getDatabase } from '../storage/database';

export interface ConversationMessage {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sources?: ContentSource[];
    queryIntent?: QueryIntent;
    relatedContent?: string[]; // Content IDs
}

export interface ContentSource {
    contentId: string;
    title: string;
    url: string;
    snippet: string;
    relevanceScore: number;
    citationIndex: number;
}

export interface ConversationContext {
    id: string;
    messages: ConversationMessage[];
    topic: string;
    keywords: string[];
    relatedContentIds: Set<string>;
    createdAt: Date;
    lastUpdated: Date;
}

export interface ConversationalResponse {
    message: ConversationMessage;
    sources: ContentSource[];
    suggestedFollowUps: string[];
    confidence: number;
}

export interface ConversationOptions {
    maxSources?: number;
    includeRelatedContent?: boolean;
    contextWindow?: number; // Number of previous messages to consider
    responseStyle?: 'concise' | 'detailed' | 'academic';
}

export class ConversationalQuery {
    private static instance: ConversationalQuery | null = null;
    private nlSearch: NaturalLanguageSearch;
    private ranking: SearchRanking;
    private conversations: Map<string, ConversationContext> = new Map();
    private responseTemplates: Map<string, string[]>;

    constructor() {
        this.nlSearch = NaturalLanguageSearch.getInstance();
        this.ranking = SearchRanking.getInstance();
        this.initializeResponseTemplates();
        this.loadConversations();
    }

    static getInstance(): ConversationalQuery {
        if (!ConversationalQuery.instance) {
            ConversationalQuery.instance = new ConversationalQuery();
        }
        return ConversationalQuery.instance;
    }

    async askQuestion(
        query: string,
        conversationId?: string,
        options?: ConversationOptions
    ): Promise<ConversationalResponse> {
        try {
            // Get or create conversation context
            const context = conversationId
                ? this.getConversation(conversationId)
                : this.createNewConversation();

            // Add user message to context
            const userMessage = this.createUserMessage(query);
            context.messages.push(userMessage);

            // Analyze query with conversation context
            const enhancedQuery = this.enhanceQueryWithContext(query, context, options);

            // Search for relevant content
            const searchResult = await this.nlSearch.search(enhancedQuery, {
                useSemanticSearch: true,
                maxResults: options?.maxSources || 10,
                minRelevanceScore: 0.3
            });

            if (!searchResult.success || !searchResult.semanticMatches) {
                throw new Error('Failed to search content');
            }

            // Generate conversational response
            const response = await this.generateResponse(
                query,
                searchResult.semanticMatches,
                context,
                searchResult.queryIntent,
                options
            );

            // Add assistant message to context
            context.messages.push(response.message);
            context.lastUpdated = new Date();

            // Update conversation context
            this.updateConversationContext(context, query, response.sources);

            // Save conversation
            await this.saveConversation(context);

            return response;

        } catch (error) {
            console.error('Conversational query failed:', error);

            // Return error response
            const errorMessage = this.createAssistantMessage(
                "I'm sorry, I couldn't find relevant information to answer your question. Could you try rephrasing it or asking about something more specific?",
                []
            );

            return {
                message: errorMessage,
                sources: [],
                suggestedFollowUps: [
                    "Can you be more specific?",
                    "What would you like to know about?",
                    "Try asking about a different topic"
                ],
                confidence: 0.1
            };
        }
    }

    private initializeResponseTemplates(): void {
        this.responseTemplates = new Map([
            ['definition', [
                "Based on your saved content, {concept} is {definition}. {sources}",
                "From what I found in your knowledge base, {concept} refers to {definition}. {sources}",
                "According to your saved materials, {concept} can be defined as {definition}. {sources}"
            ]],
            ['howto', [
                "Here's how to {action} based on your saved content: {steps} {sources}",
                "From your knowledge base, I found these steps to {action}: {steps} {sources}",
                "Based on the tutorials you've saved, here's the process to {action}: {steps} {sources}"
            ]],
            ['comparison', [
                "Comparing {item1} and {item2} from your saved content: {comparison} {sources}",
                "Based on your knowledge base, here are the key differences between {item1} and {item2}: {comparison} {sources}",
                "From what you've saved, {item1} and {item2} differ in these ways: {comparison} {sources}"
            ]],
            ['question', [
                "Based on your saved content, {answer} {sources}",
                "From your knowledge base, I can tell you that {answer} {sources}",
                "According to the materials you've collected, {answer} {sources}"
            ]],
            ['summary', [
                "Here's a summary of what you've saved about {topic}: {summary} {sources}",
                "From your knowledge base on {topic}: {summary} {sources}",
                "Based on your collected content about {topic}: {summary} {sources}"
            ]]
        ]);
    }

    private createNewConversation(): ConversationContext {
        const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const context: ConversationContext = {
            id,
            messages: [],
            topic: '',
            keywords: [],
            relatedContentIds: new Set(),
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        this.conversations.set(id, context);
        return context;
    }

    private getConversation(conversationId: string): ConversationContext {
        const context = this.conversations.get(conversationId);
        if (!context) {
            throw new Error(`Conversation ${conversationId} not found`);
        }
        return context;
    }

    private createUserMessage(content: string): ConversationMessage {
        return {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'user',
            content,
            timestamp: new Date()
        };
    }

    private createAssistantMessage(
        content: string,
        sources: ContentSource[],
        queryIntent?: QueryIntent,
        relatedContent?: string[]
    ): ConversationMessage {
        return {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'assistant',
            content,
            timestamp: new Date(),
            sources,
            queryIntent,
            relatedContent
        };
    }

    private enhanceQueryWithContext(
        query: string,
        context: ConversationContext,
        options?: ConversationOptions
    ): string {
        let enhancedQuery = query;

        // Add context from previous messages
        const contextWindow = options?.contextWindow || 3;
        const recentMessages = context.messages
            .filter(m => m.type === 'user')
            .slice(-contextWindow);

        if (recentMessages.length > 0) {
            const contextKeywords = recentMessages
                .flatMap(m => this.extractKeywords(m.content))
                .filter((keyword, index, arr) => arr.indexOf(keyword) === index);

            if (contextKeywords.length > 0) {
                enhancedQuery += ' ' + contextKeywords.join(' ');
            }
        }

        // Add topic context
        if (context.topic) {
            enhancedQuery += ' ' + context.topic;
        }

        return enhancedQuery;
    }

    private async generateResponse(
        query: string,
        searchResults: SemanticMatch[],
        context: ConversationContext,
        queryIntent?: QueryIntent,
        options?: ConversationOptions
    ): Promise<ConversationalResponse> {
        // Prepare sources
        const sources = await this.prepareSources(searchResults, options?.maxSources || 5);

        // Generate response content
        const responseContent = await this.generateResponseContent(
            query,
            sources,
            queryIntent,
            options?.responseStyle || 'detailed'
        );

        // Generate follow-up suggestions
        const suggestedFollowUps = this.generateFollowUpSuggestions(
            query,
            queryIntent,
            sources
        );

        // Calculate confidence
        const confidence = this.calculateResponseConfidence(sources, queryIntent);

        // Create assistant message
        const message = this.createAssistantMessage(
            responseContent,
            sources,
            queryIntent,
            sources.map(s => s.contentId)
        );

        return {
            message,
            sources,
            suggestedFollowUps,
            confidence
        };
    }

    private async prepareSources(
        searchResults: SemanticMatch[],
        maxSources: number
    ): Promise<ContentSource[]> {
        const sources: ContentSource[] = [];

        // Get full content details for top results
        const topResults = searchResults.slice(0, maxSources);

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            for (let i = 0; i < topResults.length; i++) {
                const result = topResults[i];

                // Get full content from database
                const content = await new Promise<StoredContent | null>((resolve) => {
                    const transaction = database.transaction(['content'], 'readonly');
                    const store = transaction.objectStore('content');
                    const request = store.get(result.contentId);

                    request.onsuccess = () => resolve(request.result || null);
                    request.onerror = () => resolve(null);
                });

                if (content) {
                    sources.push({
                        contentId: content.id,
                        title: content.title,
                        url: content.url,
                        snippet: result.snippet,
                        relevanceScore: result.combinedScore,
                        citationIndex: i + 1
                    });
                }
            }
        } catch (error) {
            console.error('Failed to prepare sources:', error);
        }

        return sources;
    }

    private async generateResponseContent(
        query: string,
        sources: ContentSource[],
        queryIntent?: QueryIntent,
        responseStyle: string = 'detailed'
    ): Promise<string> {
        if (sources.length === 0) {
            return "I couldn't find relevant information in your saved content to answer that question. You might want to save some content related to this topic first.";
        }

        // Get response template based on intent
        const intentType = queryIntent?.type || 'question';
        const templates = this.responseTemplates.get(intentType) || this.responseTemplates.get('question')!;
        const template = templates[Math.floor(Math.random() * templates.length)];

        // Extract key information from sources
        const keyInfo = this.extractKeyInformation(sources, queryIntent);

        // Generate citations
        const citations = this.generateCitations(sources);

        // Fill template
        let response = template
            .replace('{concept}', keyInfo.concept || 'the topic')
            .replace('{definition}', keyInfo.definition || 'the information found')
            .replace('{action}', keyInfo.action || 'accomplish this')
            .replace('{steps}', keyInfo.steps || 'the process described')
            .replace('{item1}', keyInfo.item1 || 'the first option')
            .replace('{item2}', keyInfo.item2 || 'the second option')
            .replace('{comparison}', keyInfo.comparison || 'the differences noted')
            .replace('{answer}', keyInfo.answer || 'the information available')
            .replace('{topic}', keyInfo.topic || 'this subject')
            .replace('{summary}', keyInfo.summary || 'the key points')
            .replace('{sources}', citations);

        // Adjust response style
        if (responseStyle === 'concise') {
            response = this.makeConcise(response);
        } else if (responseStyle === 'academic') {
            response = this.makeAcademic(response);
        }

        return response;
    }

    private extractKeyInformation(sources: ContentSource[], queryIntent?: QueryIntent): any {
        const keyInfo: any = {};

        // Extract based on intent type
        switch (queryIntent?.type) {
            case 'definition':
                keyInfo.concept = queryIntent.keywords[0] || 'the concept';
                keyInfo.definition = this.extractDefinition(sources);
                break;

            case 'howto':
                keyInfo.action = queryIntent.keywords.slice(1).join(' ') || 'this task';
                keyInfo.steps = this.extractSteps(sources);
                break;

            case 'comparison':
                const items = this.extractComparisonItems(queryIntent.keywords);
                keyInfo.item1 = items[0] || 'first item';
                keyInfo.item2 = items[1] || 'second item';
                keyInfo.comparison = this.extractComparison(sources);
                break;

            case 'summary':
                keyInfo.topic = queryIntent.keywords.join(' ') || 'the topic';
                keyInfo.summary = this.extractSummary(sources);
                break;

            default:
                keyInfo.answer = this.extractAnswer(sources, queryIntent?.keywords || []);
                break;
        }

        return keyInfo;
    }

    private extractDefinition(sources: ContentSource[]): string {
        // Look for definition patterns in source snippets
        const definitionPatterns = [
            /is\s+(?:a|an)\s+([^.]+)/i,
            /refers\s+to\s+([^.]+)/i,
            /means\s+([^.]+)/i,
            /defined\s+as\s+([^.]+)/i
        ];

        for (const source of sources) {
            for (const pattern of definitionPatterns) {
                const match = source.snippet.match(pattern);
                if (match) {
                    return match[1].trim();
                }
            }
        }

        // Fallback: use first sentence from highest-scoring source
        return sources[0]?.snippet.split('.')[0] || 'the information found in your content';
    }

    private extractSteps(sources: ContentSource[]): string {
        // Look for step patterns
        const stepPatterns = [
            /\d+\.\s*([^.]+)/g,
            /step\s+\d+[:\s]+([^.]+)/gi,
            /first[,\s]+([^.]+)/i,
            /then[,\s]+([^.]+)/i,
            /finally[,\s]+([^.]+)/i
        ];

        const steps: string[] = [];

        for (const source of sources) {
            for (const pattern of stepPatterns) {
                const matches = Array.from(source.snippet.matchAll(pattern));
                steps.push(...matches.map(m => m[1].trim()));
            }
        }

        if (steps.length > 0) {
            return steps.slice(0, 5).map((step, i) => `${i + 1}. ${step}`).join('; ');
        }

        return 'the process described in your saved content';
    }

    private extractComparisonItems(keywords: string[]): string[] {
        const vsIndex = keywords.findIndex(k => k.toLowerCase() === 'vs' || k.toLowerCase() === 'versus');
        if (vsIndex > 0 && vsIndex < keywords.length - 1) {
            return [
                keywords.slice(0, vsIndex).join(' '),
                keywords.slice(vsIndex + 1).join(' ')
            ];
        }

        // Look for "and" or "or" patterns
        const andIndex = keywords.findIndex(k => k.toLowerCase() === 'and' || k.toLowerCase() === 'or');
        if (andIndex > 0 && andIndex < keywords.length - 1) {
            return [
                keywords.slice(0, andIndex).join(' '),
                keywords.slice(andIndex + 1).join(' ')
            ];
        }

        return keywords.slice(0, 2);
    }

    private extractComparison(sources: ContentSource[]): string {
        // Look for comparison language
        const comparisonPatterns = [
            /(?:while|whereas|however|but|unlike|compared to|in contrast)/i,
            /(?:better|worse|faster|slower|more|less|different)/i,
            /(?:advantage|disadvantage|benefit|drawback)/i
        ];

        for (const source of sources) {
            for (const pattern of comparisonPatterns) {
                if (pattern.test(source.snippet)) {
                    const sentences = source.snippet.split('.');
                    const comparisonSentence = sentences.find(s => pattern.test(s));
                    if (comparisonSentence) {
                        return comparisonSentence.trim();
                    }
                }
            }
        }

        return 'the differences highlighted in your saved content';
    }

    private extractSummary(sources: ContentSource[]): string {
        // Combine key points from multiple sources
        const keyPoints: string[] = [];

        for (const source of sources.slice(0, 3)) {
            const sentences = source.snippet.split('.').filter(s => s.trim().length > 20);
            if (sentences.length > 0) {
                keyPoints.push(sentences[0].trim());
            }
        }

        return keyPoints.join('; ') || 'the key information from your saved content';
    }

    private extractAnswer(sources: ContentSource[], keywords: string[]): string {
        // Find the most relevant snippet
        let bestSnippet = sources[0]?.snippet || '';

        // Look for snippets that contain the most keywords
        let maxMatches = 0;
        for (const source of sources) {
            const matches = keywords.filter(keyword =>
                source.snippet.toLowerCase().includes(keyword.toLowerCase())
            ).length;

            if (matches > maxMatches) {
                maxMatches = matches;
                bestSnippet = source.snippet;
            }
        }

        return bestSnippet || 'the information available in your saved content';
    }

    private generateCitations(sources: ContentSource[]): string {
        if (sources.length === 0) return '';

        const citations = sources.map(source =>
            `[${source.citationIndex}] ${source.title}`
        ).join(', ');

        return `\n\nSources: ${citations}`;
    }

    private makeConcise(response: string): string {
        // Remove redundant phrases and shorten sentences
        return response
            .replace(/Based on your saved content,?\s*/gi, '')
            .replace(/From your knowledge base,?\s*/gi, '')
            .replace(/According to (?:your|the) (?:saved )?(?:materials|content),?\s*/gi, '')
            .split('.')[0] + '.';
    }

    private makeAcademic(response: string): string {
        // Add more formal language
        return response
            .replace(/Here's/g, 'The following represents')
            .replace(/I found/g, 'The analysis reveals')
            .replace(/you've saved/g, 'the documented materials indicate');
    }

    private generateFollowUpSuggestions(
        query: string,
        queryIntent?: QueryIntent,
        sources?: ContentSource[]
    ): string[] {
        const suggestions: string[] = [];

        // Intent-specific follow-ups
        switch (queryIntent?.type) {
            case 'definition':
                suggestions.push(
                    `How is ${queryIntent.keywords[0]} used in practice?`,
                    `What are examples of ${queryIntent.keywords[0]}?`,
                    `What are the benefits of ${queryIntent.keywords[0]}?`
                );
                break;

            case 'howto':
                suggestions.push(
                    'What are common mistakes to avoid?',
                    'Are there alternative approaches?',
                    'What tools or resources are needed?'
                );
                break;

            case 'comparison':
                suggestions.push(
                    'Which one should I choose?',
                    'What are the pros and cons of each?',
                    'Are there other alternatives to consider?'
                );
                break;

            case 'question':
                if (sources && sources.length > 0) {
                    suggestions.push(
                        'Can you explain this in more detail?',
                        'What are related topics I should know about?',
                        'Where can I learn more about this?'
                    );
                }
                break;

            default:
                suggestions.push(
                    'Can you be more specific?',
                    'What else would you like to know?',
                    'Are there related topics you\'re interested in?'
                );
        }

        return suggestions.slice(0, 3);
    }

    private calculateResponseConfidence(
        sources: ContentSource[],
        queryIntent?: QueryIntent
    ): number {
        if (sources.length === 0) return 0.1;

        // Base confidence on source quality and relevance
        const avgRelevance = sources.reduce((sum, s) => sum + s.relevanceScore, 0) / sources.length;
        let confidence = avgRelevance;

        // Boost confidence for high-quality sources
        if (sources.length >= 3) confidence += 0.1;
        if (avgRelevance > 0.7) confidence += 0.1;

        // Adjust based on query intent confidence
        if (queryIntent && queryIntent.confidence > 0.8) {
            confidence += 0.1;
        }

        return Math.min(confidence, 1.0);
    }

    private extractKeywords(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .slice(0, 5);
    }

    private updateConversationContext(
        context: ConversationContext,
        query: string,
        sources: ContentSource[]
    ): void {
        // Update keywords
        const newKeywords = this.extractKeywords(query);
        context.keywords = Array.from(new Set([...context.keywords, ...newKeywords])).slice(0, 20);

        // Update related content IDs
        sources.forEach(source => context.relatedContentIds.add(source.contentId));

        // Update topic if not set
        if (!context.topic && context.keywords.length > 0) {
            context.topic = context.keywords.slice(0, 3).join(' ');
        }
    }

    private async saveConversation(context: ConversationContext): Promise<void> {
        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            const transaction = database.transaction(['conversations'], 'readwrite');
            const store = transaction.objectStore('conversations');

            // Convert Set to Array for storage
            const contextToSave = {
                ...context,
                relatedContentIds: Array.from(context.relatedContentIds)
            };

            await new Promise<void>((resolve, reject) => {
                const request = store.put(contextToSave);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to save conversation:', error);
        }
    }

    private async loadConversations(): Promise<void> {
        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            const transaction = database.transaction(['conversations'], 'readonly');
            const store = transaction.objectStore('conversations');

            const conversations = await new Promise<any[]>((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });

            for (const conv of conversations) {
                // Convert Array back to Set
                conv.relatedContentIds = new Set(conv.relatedContentIds || []);
                this.conversations.set(conv.id, conv);
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
        }
    }

    // Public methods for conversation management
    async getConversationHistory(conversationId: string): Promise<ConversationMessage[]> {
        const context = this.conversations.get(conversationId);
        return context ? context.messages : [];
    }

    async getAllConversations(): Promise<ConversationContext[]> {
        return Array.from(this.conversations.values())
            .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
    }

    async deleteConversation(conversationId: string): Promise<void> {
        this.conversations.delete(conversationId);

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            const transaction = database.transaction(['conversations'], 'readwrite');
            const store = transaction.objectStore('conversations');

            await new Promise<void>((resolve, reject) => {
                const request = store.delete(conversationId);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to delete conversation:', error);
        }
    }

    async clearAllConversations(): Promise<void> {
        this.conversations.clear();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            const transaction = database.transaction(['conversations'], 'readwrite');
            const store = transaction.objectStore('conversations');

            await new Promise<void>((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to clear conversations:', error);
        }
    }
}