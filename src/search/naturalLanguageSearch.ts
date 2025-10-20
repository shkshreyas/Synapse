// Natural language search interface for MindScribe

import { SearchIndex, SearchResult, SearchOptions } from '../storage/searchIndex';
import { QueryParser, ParsedQuery } from '../storage/queryParser';
import { StoredContent } from '../types/storage';
import { getDatabase } from '../storage/database';

export interface NaturalLanguageSearchOptions extends SearchOptions {
    useSemanticSearch?: boolean;
    includeRelatedContent?: boolean;
    maxResults?: number;
    minRelevanceScore?: number;
}

export interface SemanticSearchResult extends SearchResult {
    semanticMatches?: SemanticMatch[];
    queryIntent?: QueryIntent;
    suggestions?: string[];
}

export interface SemanticMatch {
    contentId: string;
    title: string;
    snippet: string;
    semanticScore: number;
    keywordScore: number;
    combinedScore: number;
    matchType: 'exact' | 'semantic' | 'conceptual' | 'related';
    matchedConcepts?: string[];
}

export interface QueryIntent {
    type: 'search' | 'question' | 'comparison' | 'definition' | 'howto' | 'summary';
    confidence: number;
    entities: string[];
    keywords: string[];
}

export interface SearchHistory {
    id: string;
    query: string;
    timestamp: Date;
    resultCount: number;
    clickedResults: string[];
    queryIntent?: QueryIntent;
}

export class NaturalLanguageSearch {
    private static instance: NaturalLanguageSearch | null = null;
    private searchIndex: SearchIndex;
    private queryParser: QueryParser;
    private searchHistory: SearchHistory[] = [];
    private queryIntentPatterns: Map<string, RegExp[]>;

    constructor() {
        this.searchIndex = SearchIndex.getInstance();
        this.queryParser = QueryParser.getInstance();
        this.initializeQueryIntentPatterns();
        this.loadSearchHistory();
    }

    static getInstance(): NaturalLanguageSearch {
        if (!NaturalLanguageSearch.instance) {
            NaturalLanguageSearch.instance = new NaturalLanguageSearch();
        }
        return NaturalLanguageSearch.instance;
    }

    async search(query: string, options?: NaturalLanguageSearchOptions): Promise<SemanticSearchResult> {
        const startTime = performance.now();

        try {
            // Analyze query intent
            const queryIntent = this.analyzeQueryIntent(query);

            // Parse the query
            const parsedQuery = this.queryParser.parseQuery(query);

            // Enhance query with natural language processing
            const enhancedQuery = await this.enhanceQuery(query, parsedQuery, queryIntent);

            // Perform traditional keyword search
            const keywordResults = await this.searchIndex.search(enhancedQuery, options);

            // Perform semantic search if enabled
            let semanticMatches: SemanticMatch[] = [];
            if (options?.useSemanticSearch !== false) {
                semanticMatches = await this.performSemanticSearch(query, queryIntent, options);
            }

            // Combine and rank results
            const combinedResults = this.combineSearchResults(
                keywordResults.results,
                semanticMatches,
                queryIntent
            );

            // Apply relevance filtering
            const filteredResults = this.filterByRelevance(
                combinedResults,
                options?.minRelevanceScore || 0.1
            );

            // Limit results
            const maxResults = options?.maxResults || 20;
            const limitedResults = filteredResults.slice(0, maxResults);

            // Generate suggestions
            const suggestions = await this.generateSearchSuggestions(query, queryIntent, limitedResults);

            // Save to search history
            await this.saveSearchHistory(query, queryIntent, limitedResults.length);

            const result: SemanticSearchResult = {
                success: true,
                results: keywordResults.results, // Keep original format for compatibility
                totalResults: limitedResults.length,
                operationTime: performance.now() - startTime,
                query,
                searchTerms: parsedQuery.terms,
                semanticMatches: limitedResults,
                queryIntent,
                suggestions
            };

            return result;

        } catch (error) {
            return {
                success: false,
                error: `Natural language search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                results: [],
                totalResults: 0,
                operationTime: performance.now() - startTime,
                semanticMatches: [],
                suggestions: []
            };
        }
    }

    private initializeQueryIntentPatterns(): void {
        this.queryIntentPatterns = new Map([
            ['question', [
                /^(what|how|why|when|where|who|which|can|could|should|would|is|are|do|does|did)\b/i,
                /\?$/,
                /\b(explain|tell me|show me|help me understand)\b/i
            ]],
            ['comparison', [
                /\b(vs|versus|compared to|difference between|better than|worse than)\b/i,
                /\b(compare|contrast|similar to|different from)\b/i
            ]],
            ['definition', [
                /\b(what is|what are|define|definition of|meaning of)\b/i,
                /\b(explain|describe)\s+\w+$/i
            ]],
            ['howto', [
                /\b(how to|how do|how can|steps to|guide to|tutorial)\b/i,
                /\b(learn|teach|show me how)\b/i
            ]],
            ['summary', [
                /\b(summary|summarize|overview|recap|key points)\b/i,
                /\b(tldr|tl;dr|brief|quick)\b/i
            ]],
            ['search', [
                /\b(find|search|look for|show me|get me)\b/i,
                /\b(about|regarding|related to|concerning)\b/i
            ]]
        ]);
    }

    private analyzeQueryIntent(query: string): QueryIntent {
        const entities: string[] = [];
        const keywords: string[] = [];
        let bestMatch: { type: string; confidence: number } = { type: 'search', confidence: 0.5 };

        // Extract potential entities (capitalized words, quoted phrases)
        const entityMatches = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
        if (entityMatches) {
            entities.push(...entityMatches);
        }

        const quotedMatches = query.match(/"([^"]+)"/g);
        if (quotedMatches) {
            entities.push(...quotedMatches.map(q => q.replace(/"/g, '')));
        }

        // Extract keywords (remove stop words)
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);

        keywords.push(...query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word))
        );

        // Analyze intent patterns
        for (const [intentType, patterns] of this.queryIntentPatterns) {
            for (const pattern of patterns) {
                if (pattern.test(query)) {
                    const confidence = this.calculateIntentConfidence(query, intentType, pattern);
                    if (confidence > bestMatch.confidence) {
                        bestMatch = { type: intentType, confidence };
                    }
                }
            }
        }

        return {
            type: bestMatch.type as QueryIntent['type'],
            confidence: bestMatch.confidence,
            entities,
            keywords
        };
    }

    private calculateIntentConfidence(query: string, intentType: string, pattern: RegExp): number {
        let confidence = 0.6; // Base confidence

        // Boost confidence based on pattern strength
        const match = query.match(pattern);
        if (match) {
            const matchLength = match[0].length;
            const queryLength = query.length;
            confidence += (matchLength / queryLength) * 0.3;
        }

        // Boost for specific intent indicators
        switch (intentType) {
            case 'question':
                if (query.includes('?')) confidence += 0.2;
                if (query.startsWith('what') || query.startsWith('how')) confidence += 0.1;
                break;
            case 'comparison':
                if (query.includes(' vs ') || query.includes(' versus ')) confidence += 0.2;
                break;
            case 'definition':
                if (query.startsWith('what is') || query.startsWith('define')) confidence += 0.2;
                break;
            case 'howto':
                if (query.startsWith('how to')) confidence += 0.2;
                break;
        }

        return Math.min(confidence, 1.0);
    }

    private async enhanceQuery(query: string, parsedQuery: ParsedQuery, intent: QueryIntent): Promise<string> {
        let enhancedQuery = query;

        // Add synonyms and related terms
        const synonyms = await this.findSynonyms(intent.keywords);
        if (synonyms.length > 0) {
            enhancedQuery += ' ' + synonyms.join(' ');
        }

        // Expand abbreviations and acronyms
        enhancedQuery = this.expandAbbreviations(enhancedQuery);

        // Add intent-specific enhancements
        switch (intent.type) {
            case 'question':
                // For questions, focus on content that might contain answers
                enhancedQuery += ' answer explanation solution';
                break;
            case 'howto':
                // For how-to queries, prioritize tutorial and guide content
                enhancedQuery += ' tutorial guide steps instructions';
                break;
            case 'definition':
                // For definitions, look for explanatory content
                enhancedQuery += ' definition meaning explanation concept';
                break;
        }

        return enhancedQuery;
    }

    private async findSynonyms(keywords: string[]): Promise<string[]> {
        // Simple synonym mapping - in a real implementation, this could use a thesaurus API
        const synonymMap: Record<string, string[]> = {
            'learn': ['study', 'understand', 'master', 'grasp'],
            'tutorial': ['guide', 'howto', 'instructions', 'walkthrough'],
            'code': ['programming', 'development', 'coding', 'script'],
            'javascript': ['js', 'ecmascript', 'node'],
            'python': ['py', 'django', 'flask'],
            'web': ['website', 'internet', 'online', 'browser'],
            'api': ['interface', 'endpoint', 'service', 'rest'],
            'database': ['db', 'storage', 'data', 'sql'],
            'error': ['bug', 'issue', 'problem', 'exception'],
            'fix': ['solve', 'repair', 'resolve', 'debug']
        };

        const synonyms: string[] = [];
        for (const keyword of keywords) {
            const keywordSynonyms = synonymMap[keyword.toLowerCase()];
            if (keywordSynonyms) {
                synonyms.push(...keywordSynonyms);
            }
        }

        return synonyms;
    }

    private expandAbbreviations(query: string): string {
        const abbreviations: Record<string, string> = {
            'js': 'javascript',
            'ts': 'typescript',
            'css': 'cascading style sheets',
            'html': 'hypertext markup language',
            'api': 'application programming interface',
            'ui': 'user interface',
            'ux': 'user experience',
            'db': 'database',
            'sql': 'structured query language',
            'http': 'hypertext transfer protocol',
            'url': 'uniform resource locator',
            'json': 'javascript object notation',
            'xml': 'extensible markup language',
            'ai': 'artificial intelligence',
            'ml': 'machine learning'
        };

        let expandedQuery = query;
        for (const [abbrev, expansion] of Object.entries(abbreviations)) {
            const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
            expandedQuery = expandedQuery.replace(regex, `${abbrev} ${expansion}`);
        }

        return expandedQuery;
    }

    private async performSemanticSearch(
        query: string,
        intent: QueryIntent,
        options?: NaturalLanguageSearchOptions
    ): Promise<SemanticMatch[]> {
        try {
            // Get all content for semantic analysis
            const db = await getDatabase();
            const database = db.getDatabase();

            const allContent = await new Promise<StoredContent[]>((resolve, reject) => {
                const transaction = database.transaction(['content'], 'readonly');
                const store = transaction.objectStore('content');
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });

            // Perform semantic matching
            const semanticMatches: SemanticMatch[] = [];

            for (const content of allContent) {
                const semanticScore = this.calculateSemanticSimilarity(query, content, intent);
                const keywordScore = this.calculateKeywordSimilarity(query, content);
                const combinedScore = (semanticScore * 0.6) + (keywordScore * 0.4);

                if (combinedScore > (options?.minRelevanceScore || 0.1)) {
                    const matchType = this.determineMatchType(semanticScore, keywordScore);
                    const matchedConcepts = this.findMatchedConcepts(intent.keywords, content);

                    semanticMatches.push({
                        contentId: content.id,
                        title: content.title,
                        snippet: this.generateSemanticSnippet(content, query, intent),
                        semanticScore,
                        keywordScore,
                        combinedScore,
                        matchType,
                        matchedConcepts
                    });
                }
            }

            // Sort by combined score
            semanticMatches.sort((a, b) => b.combinedScore - a.combinedScore);

            return semanticMatches;

        } catch (error) {
            console.error('Semantic search failed:', error);
            return [];
        }
    }

    private calculateSemanticSimilarity(query: string, content: StoredContent, intent: QueryIntent): number {
        let score = 0;

        // Concept matching
        if (content.concepts) {
            const queryKeywords = intent.keywords;
            const conceptMatches = content.concepts.filter(concept =>
                queryKeywords.some(keyword =>
                    concept.toLowerCase().includes(keyword.toLowerCase()) ||
                    keyword.toLowerCase().includes(concept.toLowerCase())
                )
            );
            score += (conceptMatches.length / Math.max(content.concepts.length, 1)) * 0.4;
        }

        // Tag matching
        if (content.tags) {
            const tagMatches = content.tags.filter(tag =>
                intent.keywords.some(keyword =>
                    tag.toLowerCase().includes(keyword.toLowerCase()) ||
                    keyword.toLowerCase().includes(tag.toLowerCase())
                )
            );
            score += (tagMatches.length / Math.max(content.tags.length, 1)) * 0.3;
        }

        // Category matching
        if (content.category) {
            const categoryMatch = intent.keywords.some(keyword =>
                content.category!.toLowerCase().includes(keyword.toLowerCase())
            );
            if (categoryMatch) score += 0.2;
        }

        // Content type matching based on intent
        const typeBoost = this.getTypeBoostForIntent(content.metadata.pageType, intent.type);
        score += typeBoost * 0.1;

        return Math.min(score, 1.0);
    }

    private calculateKeywordSimilarity(query: string, content: StoredContent): number {
        const queryWords = query.toLowerCase().split(/\s+/);
        const contentText = (content.title + ' ' + content.content).toLowerCase();

        let matches = 0;
        for (const word of queryWords) {
            if (word.length > 2 && contentText.includes(word)) {
                matches++;
            }
        }

        return matches / Math.max(queryWords.length, 1);
    }

    private determineMatchType(semanticScore: number, keywordScore: number): SemanticMatch['matchType'] {
        if (keywordScore > 0.7) return 'exact';
        if (semanticScore > 0.6) return 'semantic';
        if (semanticScore > 0.3) return 'conceptual';
        return 'related';
    }

    private findMatchedConcepts(queryKeywords: string[], content: StoredContent): string[] {
        if (!content.concepts) return [];

        return content.concepts.filter(concept =>
            queryKeywords.some(keyword =>
                concept.toLowerCase().includes(keyword.toLowerCase()) ||
                keyword.toLowerCase().includes(concept.toLowerCase())
            )
        );
    }

    private generateSemanticSnippet(content: StoredContent, query: string, intent: QueryIntent): string {
        const maxLength = 200;
        const queryWords = intent.keywords;

        // Find the best section of content that contains query terms
        const sentences = content.content.split(/[.!?]+/);
        let bestSentence = sentences[0] || '';
        let bestScore = 0;

        for (const sentence of sentences) {
            if (sentence.length < 20) continue;

            let score = 0;
            const sentenceLower = sentence.toLowerCase();

            for (const word of queryWords) {
                if (sentenceLower.includes(word.toLowerCase())) {
                    score++;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestSentence = sentence;
            }
        }

        // Truncate if too long
        let snippet = bestSentence.trim();
        if (snippet.length > maxLength) {
            snippet = snippet.substring(0, maxLength) + '...';
        }

        // Highlight query terms
        for (const word of queryWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            snippet = snippet.replace(regex, `<mark>${word}</mark>`);
        }

        return snippet;
    }

    private getTypeBoostForIntent(pageType: string, intentType: string): number {
        const typeIntentMap: Record<string, Record<string, number>> = {
            'howto': {
                'documentation': 0.8,
                'article': 0.6,
                'video': 0.4,
                'other': 0.2
            },
            'question': {
                'documentation': 0.7,
                'article': 0.8,
                'social': 0.5,
                'other': 0.3
            },
            'definition': {
                'documentation': 0.9,
                'article': 0.7,
                'other': 0.3
            },
            'search': {
                'article': 0.5,
                'documentation': 0.5,
                'video': 0.4,
                'social': 0.3,
                'other': 0.4
            }
        };

        return typeIntentMap[intentType]?.[pageType] || 0.3;
    }

    private combineSearchResults(
        keywordResults: any[],
        semanticMatches: SemanticMatch[],
        intent: QueryIntent
    ): SemanticMatch[] {
        const combinedMap = new Map<string, SemanticMatch>();

        // Add semantic matches
        for (const match of semanticMatches) {
            combinedMap.set(match.contentId, match);
        }

        // Enhance with keyword results
        for (const result of keywordResults) {
            const existing = combinedMap.get(result.contentId);
            if (existing) {
                // Boost score for items that appear in both results
                existing.combinedScore = Math.min(existing.combinedScore * 1.2, 1.0);
            } else {
                // Convert keyword result to semantic match format
                const semanticMatch: SemanticMatch = {
                    contentId: result.contentId,
                    title: result.title,
                    snippet: result.snippet,
                    semanticScore: 0.3, // Low semantic score for keyword-only matches
                    keywordScore: result.score / 10, // Normalize keyword score
                    combinedScore: result.score / 10,
                    matchType: 'exact',
                    matchedConcepts: []
                };
                combinedMap.set(result.contentId, semanticMatch);
            }
        }

        return Array.from(combinedMap.values());
    }

    private filterByRelevance(results: SemanticMatch[], minScore: number): SemanticMatch[] {
        return results.filter(result => result.combinedScore >= minScore);
    }

    private async generateSearchSuggestions(
        query: string,
        intent: QueryIntent,
        results: SemanticMatch[]
    ): Promise<string[]> {
        const suggestions: string[] = [];

        // Add query refinement suggestions
        if (results.length === 0) {
            suggestions.push(
                `Try searching for "${intent.keywords.join(' ')}"`,
                `Search for related terms like "${await this.findSynonyms(intent.keywords).then(s => s.slice(0, 3).join(', '))}"`
            );
        } else if (results.length > 50) {
            // Too many results, suggest refinement
            const topConcepts = this.extractTopConcepts(results);
            suggestions.push(
                ...topConcepts.slice(0, 3).map(concept => `${query} ${concept}`)
            );
        }

        // Add related search suggestions based on content
        const relatedTerms = this.extractRelatedTerms(results);
        suggestions.push(
            ...relatedTerms.slice(0, 3).map(term => `${intent.keywords[0]} ${term}`)
        );

        // Add intent-specific suggestions
        switch (intent.type) {
            case 'question':
                suggestions.push(`How to ${intent.keywords.join(' ')}`);
                break;
            case 'search':
                suggestions.push(`What is ${intent.keywords[0]}?`);
                break;
        }

        return suggestions.slice(0, 5);
    }

    private extractTopConcepts(results: SemanticMatch[]): string[] {
        const conceptCounts = new Map<string, number>();

        for (const result of results) {
            if (result.matchedConcepts) {
                for (const concept of result.matchedConcepts) {
                    conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
                }
            }
        }

        return Array.from(conceptCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([concept]) => concept);
    }

    private extractRelatedTerms(results: SemanticMatch[]): string[] {
        // Extract common terms from high-scoring results
        const termCounts = new Map<string, number>();
        const topResults = results.slice(0, 10);

        for (const result of topResults) {
            const words = result.title.toLowerCase().split(/\s+/);
            for (const word of words) {
                if (word.length > 3) {
                    termCounts.set(word, (termCounts.get(word) || 0) + 1);
                }
            }
        }

        return Array.from(termCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([term]) => term)
            .slice(0, 5);
    }

    private async saveSearchHistory(query: string, intent: QueryIntent, resultCount: number): Promise<void> {
        const historyEntry: SearchHistory = {
            id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            query,
            timestamp: new Date(),
            resultCount,
            clickedResults: [],
            queryIntent: intent
        };

        this.searchHistory.unshift(historyEntry);

        // Keep only last 100 searches
        if (this.searchHistory.length > 100) {
            this.searchHistory = this.searchHistory.slice(0, 100);
        }

        // Save to storage
        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            const transaction = database.transaction(['searchHistory'], 'readwrite');
            const store = transaction.objectStore('searchHistory');
            await store.put(historyEntry);
        } catch (error) {
            console.error('Failed to save search history:', error);
        }
    }

    private async loadSearchHistory(): Promise<void> {
        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            const transaction = database.transaction(['searchHistory'], 'readonly');
            const store = transaction.objectStore('searchHistory');
            const request = store.getAll();

            request.onsuccess = () => {
                this.searchHistory = (request.result || [])
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 100);
            };
        } catch (error) {
            console.error('Failed to load search history:', error);
        }
    }

    async getSearchHistory(limit: number = 20): Promise<SearchHistory[]> {
        return this.searchHistory.slice(0, limit);
    }

    async getSearchSuggestions(partialQuery: string): Promise<string[]> {
        const suggestions: string[] = [];

        try {
            // Add suggestions from search history
            const historySuggestions = this.searchHistory
                .filter(entry => entry.query.toLowerCase().includes(partialQuery.toLowerCase()))
                .map(entry => entry.query)
                .slice(0, 5);

            suggestions.push(...historySuggestions);

            // Add query parser suggestions
            const parserSuggestions = this.queryParser.getQuerySuggestions(partialQuery);
            if (parserSuggestions && Array.isArray(parserSuggestions)) {
                suggestions.push(...parserSuggestions);
            }

            // Remove duplicates and limit
            return Array.from(new Set(suggestions)).slice(0, 10);
        } catch (error) {
            console.error('Failed to get search suggestions:', error);
            return [];
        }
    }

    async recordSearchClick(searchId: string, contentId: string): Promise<void> {
        const historyEntry = this.searchHistory.find(entry => entry.id === searchId);
        if (historyEntry) {
            historyEntry.clickedResults.push(contentId);

            // Update in storage
            try {
                const db = await getDatabase();
                const database = db.getDatabase();

                const transaction = database.transaction(['searchHistory'], 'readwrite');
                const store = transaction.objectStore('searchHistory');
                await store.put(historyEntry);
            } catch (error) {
                console.error('Failed to update search history:', error);
            }
        }
    }
}