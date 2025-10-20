// Search module exports

export { NaturalLanguageSearch } from './naturalLanguageSearch';
export type {
    NaturalLanguageSearchOptions,
    SemanticSearchResult,
    SemanticMatch,
    QueryIntent,
    SearchHistory
} from './naturalLanguageSearch';

export { SearchRanking } from './searchRanking';
export type {
    RankingFactors,
    RankingWeights,
    UserPreferences
} from './searchRanking';

export { SearchInterface } from './searchInterface';
export type {
    SearchInterfaceOptions,
    SearchSuggestion,
    SearchInterfaceResult
} from './searchInterface';

export { ConversationalQuery } from './conversationalQuery';
export type {
    ConversationMessage,
    ContentSource,
    ConversationContext,
    ConversationalResponse,
    ConversationOptions
} from './conversationalQuery';

export { ContextManager } from './contextManager';
export type {
    ContextualInsight,
    ConversationAnalytics
} from './contextManager';

// Re-export storage search types for convenience
export type {
    SearchOptions,
    SearchFilters,
    SearchResult,
    ScoredSearchResult
} from '../storage/searchIndex';

export type {
    ParsedQuery,
    QueryFilters,
    DateRange,
    NumberRange,
    QueryOperator
} from '../storage/queryParser';