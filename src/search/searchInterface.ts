// Main search interface that combines natural language search with ranking

import { NaturalLanguageSearch, NaturalLanguageSearchOptions, SemanticSearchResult } from './naturalLanguageSearch';
import { SearchRanking } from './searchRanking';
import { SearchIndex } from '../storage/searchIndex';

export interface SearchInterfaceOptions extends NaturalLanguageSearchOptions {
    enableAutoComplete?: boolean;
    enableSearchHistory?: boolean;
    enablePersonalization?: boolean;
    maxSuggestions?: number;
}

export interface SearchSuggestion {
    text: string;
    type: 'history' | 'completion' | 'related' | 'correction';
    confidence: number;
}

export interface SearchInterfaceResult extends SemanticSearchResult {
    suggestions: SearchSuggestion[];
    correctedQuery?: string;
    searchTime: {
        parsing: number;
        searching: number;
        ranking: number;
        total: number;
    };
}

export class SearchInterface {
    private static instance: SearchInterface | null = null;
    private nlSearch: NaturalLanguageSearch;
    private ranking: SearchRanking;
    private searchIndex: SearchIndex;

    constructor() {
        this.nlSearch = NaturalLanguageSearch.getInstance();
        this.ranking = SearchRanking.getInstance();
        this.searchIndex = SearchIndex.getInstance();
    }

    static getInstance(): SearchInterface {
        if (!SearchInterface.instance) {
            SearchInterface.instance = new SearchInterface();
        }
        return SearchInterface.instance;
    }

    async search(query: string, options?: SearchInterfaceOptions): Promise<SearchInterfaceResult> {
        const startTime = performance.now();
        const timings = {
            parsing: 0,
            searching: 0,
            ranking: 0,
            total: 0
        };

        try {
            // Parse and analyze query
            const parseStart = performance.now();
            const correctedQuery = this.correctSpelling(query);
            const finalQuery = correctedQuery || query;
            timings.parsing = performance.now() - parseStart;

            // Perform natural language search
            const searchStart = performance.now();
            const searchResult = await this.nlSearch.search(finalQuery, {
                useSemanticSearch: options?.useSemanticSearch !== false,
                includeRelatedContent: options?.includeRelatedContent,
                maxResults: options?.maxResults || 50,
                minRelevanceScore: options?.minRelevanceScore || 0.1,
                ...options
            });
            timings.searching = performance.now() - searchStart;

            if (!searchResult.success) {
                timings.total = performance.now() - startTime;
                return {
                    ...searchResult,
                    suggestions: [],
                    searchTime: timings
                };
            }

            if (!searchResult.semanticMatches) {
                timings.total = performance.now() - startTime;
                return {
                    ...searchResult,
                    semanticMatches: [],
                    suggestions: [],
                    searchTime: timings
                };
            }

            // Apply advanced ranking
            const rankingStart = performance.now();
            const rankedResults = this.ranking.rankSearchResults(
                searchResult.semanticMatches,
                finalQuery,
                searchResult.queryIntent!,
                this.ranking.getAdaptiveWeights(searchResult.queryIntent!, searchResult.semanticMatches.length)
            );
            timings.ranking = performance.now() - rankingStart;

            // Generate enhanced suggestions
            const suggestions = await this.generateEnhancedSuggestions(
                finalQuery,
                searchResult,
                rankedResults,
                options
            );

            timings.total = performance.now() - startTime;

            return {
                ...searchResult,
                semanticMatches: rankedResults,
                suggestions,
                correctedQuery: correctedQuery || undefined,
                searchTime: timings
            };

        } catch (error) {
            timings.total = performance.now() - startTime;
            return {
                success: false,
                error: `Search interface error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                results: [],
                totalResults: 0,
                operationTime: timings.total,
                semanticMatches: [],
                suggestions: [],
                searchTime: timings
            };
        }
    }

    async getSearchSuggestions(partialQuery: string, options?: SearchInterfaceOptions): Promise<SearchSuggestion[]> {
        const suggestions: SearchSuggestion[] = [];

        try {
            // Get basic suggestions from natural language search
            const basicSuggestions = await this.nlSearch.getSearchSuggestions(partialQuery);
            if (basicSuggestions && Array.isArray(basicSuggestions)) {
                suggestions.push(...basicSuggestions.map(text => ({
                    text,
                    type: 'completion' as const,
                    confidence: 0.7
                })));
            }

            // Get search history suggestions if enabled
            if (options?.enableSearchHistory !== false) {
                const history = await this.nlSearch.getSearchHistory(10);
                const historySuggestions = history
                    .filter(entry => entry.query.toLowerCase().includes(partialQuery.toLowerCase()))
                    .slice(0, 5)
                    .map(entry => ({
                        text: entry.query,
                        type: 'history' as const,
                        confidence: 0.8
                    }));
                suggestions.push(...historySuggestions);
            }

            // Add spell correction suggestions
            const corrected = this.correctSpelling(partialQuery);
            if (corrected && corrected !== partialQuery) {
                suggestions.unshift({
                    text: corrected,
                    type: 'correction',
                    confidence: 0.9
                });
            }

            // Add related term suggestions
            const relatedSuggestions = await this.getRelatedTermSuggestions(partialQuery);
            suggestions.push(...relatedSuggestions);

            // Remove duplicates and sort by confidence
            const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
            uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);

            return uniqueSuggestions.slice(0, options?.maxSuggestions || 10);

        } catch (error) {
            console.error('Failed to get search suggestions:', error);
            return [];
        }
    }

    async recordSearchInteraction(
        query: string,
        clickedResultId: string,
        searchResult: SearchInterfaceResult
    ): Promise<void> {
        try {
            // Record click in natural language search
            if (searchResult.semanticMatches) {
                const clickedResult = searchResult.semanticMatches.find(r => r.contentId === clickedResultId);
                if (clickedResult && searchResult.queryIntent) {
                    this.ranking.updateUserPreferences(
                        query,
                        [clickedResult],
                        searchResult.queryIntent
                    );
                }
            }

            // Record in search history
            await this.nlSearch.recordSearchClick('', clickedResultId); // Would need search ID

        } catch (error) {
            console.error('Failed to record search interaction:', error);
        }
    }

    private correctSpelling(query: string): string | null {
        // Simple spell correction - in a real implementation, this could use a spell-check library
        const corrections: Record<string, string> = {
            'javascirpt': 'javascript',
            'javasript': 'javascript',
            'javscript': 'javascript',
            'pytohn': 'python',
            'pyhton': 'python',
            'reactjs': 'react',
            'nodejs': 'node.js',
            'typescirpt': 'typescript',
            'typesript': 'typescript',
            'databse': 'database',
            'databas': 'database',
            'algoritm': 'algorithm',
            'algorith': 'algorithm',
            'machien': 'machine',
            'learing': 'learning',
            'artifical': 'artificial',
            'inteligence': 'intelligence',
            'developement': 'development',
            'programing': 'programming',
            'progamming': 'programming',
            'fucntion': 'function',
            'funciton': 'function',
            'varaible': 'variable',
            'variabel': 'variable'
        };

        const words = query.toLowerCase().split(/\s+/);
        let corrected = false;
        const correctedWords = words.map(word => {
            const correction = corrections[word];
            if (correction) {
                corrected = true;
                return correction;
            }
            return word;
        });

        return corrected ? correctedWords.join(' ') : null;
    }

    private async getRelatedTermSuggestions(partialQuery: string): Promise<SearchSuggestion[]> {
        // Get related terms based on content analysis
        const relatedTerms: Record<string, string[]> = {
            'javascript': ['js', 'node', 'react', 'vue', 'angular', 'typescript'],
            'python': ['django', 'flask', 'pandas', 'numpy', 'machine learning'],
            'react': ['jsx', 'hooks', 'components', 'state', 'props'],
            'css': ['styling', 'flexbox', 'grid', 'responsive', 'sass'],
            'database': ['sql', 'mongodb', 'postgresql', 'mysql', 'nosql'],
            'api': ['rest', 'graphql', 'endpoint', 'json', 'http'],
            'machine learning': ['ai', 'neural network', 'deep learning', 'tensorflow', 'pytorch'],
            'web development': ['html', 'css', 'javascript', 'frontend', 'backend']
        };

        const suggestions: SearchSuggestion[] = [];
        const queryLower = partialQuery.toLowerCase();

        for (const [term, related] of Object.entries(relatedTerms)) {
            if (queryLower.includes(term) || term.includes(queryLower)) {
                suggestions.push(...related.map(relatedTerm => ({
                    text: `${partialQuery} ${relatedTerm}`,
                    type: 'related' as const,
                    confidence: 0.6
                })));
            }
        }

        return suggestions.slice(0, 5);
    }

    private async generateEnhancedSuggestions(
        query: string,
        searchResult: SemanticSearchResult,
        rankedResults: any[],
        options?: SearchInterfaceOptions
    ): Promise<SearchSuggestion[]> {
        const suggestions: SearchSuggestion[] = [];

        // Add original suggestions from natural language search
        if (searchResult.suggestions) {
            suggestions.push(...searchResult.suggestions.map(text => ({
                text,
                type: 'related' as const,
                confidence: 0.7
            })));
        }

        // Add refinement suggestions based on results
        if (rankedResults.length > 20) {
            // Too many results - suggest refinements
            const topConcepts = this.extractTopConcepts(rankedResults.slice(0, 10));
            suggestions.push(...topConcepts.slice(0, 3).map(concept => ({
                text: `${query} ${concept}`,
                type: 'related' as const,
                confidence: 0.8
            })));
        } else if (rankedResults.length === 0) {
            // No results - suggest alternatives
            const alternatives = this.generateAlternativeQueries(query);
            suggestions.push(...alternatives.map(alt => ({
                text: alt,
                type: 'related' as const,
                confidence: 0.6
            })));
        }

        // Add intent-specific suggestions
        if (searchResult.queryIntent) {
            const intentSuggestions = this.generateIntentSpecificSuggestions(query, searchResult.queryIntent);
            suggestions.push(...intentSuggestions);
        }

        return this.deduplicateSuggestions(suggestions).slice(0, 8);
    }

    private extractTopConcepts(results: any[]): string[] {
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
            .map(([concept]) => concept)
            .slice(0, 5);
    }

    private generateAlternativeQueries(query: string): string[] {
        const alternatives: string[] = [];
        const words = query.split(/\s+/);

        // Try removing one word at a time
        if (words.length > 1) {
            for (let i = 0; i < words.length; i++) {
                const alternative = words.filter((_, index) => index !== i).join(' ');
                alternatives.push(alternative);
            }
        }

        // Try synonyms for key words
        const synonymMap: Record<string, string[]> = {
            'learn': ['study', 'understand', 'tutorial'],
            'create': ['build', 'make', 'develop'],
            'fix': ['solve', 'repair', 'debug'],
            'use': ['implement', 'apply', 'utilize']
        };

        for (const [word, synonyms] of Object.entries(synonymMap)) {
            if (query.toLowerCase().includes(word)) {
                for (const synonym of synonyms) {
                    alternatives.push(query.replace(new RegExp(word, 'gi'), synonym));
                }
            }
        }

        return alternatives.slice(0, 3);
    }

    private generateIntentSpecificSuggestions(query: string, intent: any): SearchSuggestion[] {
        const suggestions: SearchSuggestion[] = [];

        switch (intent.type) {
            case 'question':
                suggestions.push({
                    text: `how to ${intent.keywords.join(' ')}`,
                    type: 'related',
                    confidence: 0.7
                });
                break;
            case 'search':
                suggestions.push({
                    text: `what is ${intent.keywords[0]}?`,
                    type: 'related',
                    confidence: 0.6
                });
                break;
            case 'howto':
                suggestions.push({
                    text: `${intent.keywords.join(' ')} tutorial`,
                    type: 'related',
                    confidence: 0.8
                });
                break;
        }

        return suggestions;
    }

    private deduplicateSuggestions(suggestions: SearchSuggestion[]): SearchSuggestion[] {
        const seen = new Set<string>();
        return suggestions.filter(suggestion => {
            const key = suggestion.text.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // Public utility methods
    async clearSearchHistory(): Promise<void> {
        // This would clear the search history in storage
        try {
            localStorage.removeItem('mindscribe_search_history');
        } catch (error) {
            console.error('Failed to clear search history:', error);
        }
    }

    async exportSearchHistory(): Promise<any[]> {
        try {
            const history = await this.nlSearch.getSearchHistory(1000);
            return history || [];
        } catch (error) {
            console.error('Failed to export search history:', error);
            return [];
        }
    }

    getSearchStats(): any {
        // Return search statistics
        return {
            // This would include various search metrics
            totalSearches: 0,
            averageResultCount: 0,
            topQueries: [],
            searchPatterns: []
        };
    }
}