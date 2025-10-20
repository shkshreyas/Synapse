// Main storage module exports

export { MindScribeDatabase, getDatabase, type DatabaseConfig, type StoreConfig, type IndexConfig, type StorageUsage } from './database';
export { ContentStore, type ListOptions } from './contentStore';
export { RelationshipStore, type RelationshipListOptions } from './relationshipStore';
export { QuotaManager, type CleanupResult, type OptimizationResult } from './quotaManager';
export { validateContent, validateSearchQuery } from './validators';
export { SearchIndex, type SearchOptions, type SearchFilters, type SearchResult, type ScoredSearchResult, type IndexingResult, type RebuildResult } from './searchIndex';
export { QueryParser, type ParsedQuery, type QueryFilters, type DateRange, type NumberRange, type QueryOperator } from './queryParser';
export { SearchRanking, type RankingFactors, type RankingWeights, type UserFeedback } from './searchRanking';

// Re-export storage types
export type {
    StoredContent,
    ContentSummaries,
    SearchIndexEntry,
    SearchableMetadata,
    ContentRelationship,
    StorageSettings,
    StorageQuotaInfo,
    CleanupCriteria,
    StorageStats,
    ValidationResult,
    ValidationError,
    ValidationWarning,
    StorageOperationResult,
    BulkOperationResult
} from '../types/storage';

// Storage initialization utility
export async function initializeStorage(): Promise<void> {
    try {
        // Initialize database
        await getDatabase();

        // Initialize content store
        ContentStore.getInstance();

        // Initialize relationship store
        RelationshipStore.getInstance();

        // Initialize quota manager
        QuotaManager.getInstance();

        // Initialize search components
        SearchIndex.getInstance();
        QueryParser.getInstance();
        SearchRanking.getInstance();

        console.log('MindScribe storage initialized successfully');
    } catch (error) {
        console.error('Failed to initialize storage:', error);
        throw error;
    }
}

// Storage health check utility
export async function checkStorageHealth(): Promise<StorageHealthReport> {
    try {
        const db = await getDatabase();
        const contentStore = ContentStore.getInstance();
        const quotaManager = QuotaManager.getInstance();

        // Test database connection
        const testContent = {
            id: 'health-check-test',
            url: 'https://example.com/health-check',
            title: 'Health Check Test',
            content: 'This is a test content for health check',
            metadata: {
                readingTime: 1,
                pageType: 'other' as const,
                language: 'en',
                wordCount: 10,
                imageCount: 0,
                linkCount: 0
            },
            captureMethod: 'manual' as const,
            timestamp: new Date()
        };

        // Test create operation
        const createResult = await contentStore.create(testContent);
        if (!createResult.success) {
            throw new Error(`Create test failed: ${createResult.error}`);
        }

        // Test read operation
        const readResult = await contentStore.read('health-check-test');
        if (!readResult.success) {
            throw new Error(`Read test failed: ${readResult.error}`);
        }

        // Test delete operation
        const deleteResult = await contentStore.delete('health-check-test');
        if (!deleteResult.success) {
            throw new Error(`Delete test failed: ${deleteResult.error}`);
        }

        // Get storage info
        const storageInfo = await quotaManager.getStorageInfo();
        const storageStats = await quotaManager.getStorageStats();

        return {
            healthy: true,
            databaseConnected: true,
            crudOperationsWorking: true,
            storageInfo,
            storageStats,
            lastChecked: new Date()
        };
    } catch (error) {
        return {
            healthy: false,
            databaseConnected: false,
            crudOperationsWorking: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            lastChecked: new Date()
        };
    }
}

export interface StorageHealthReport {
    healthy: boolean;
    databaseConnected: boolean;
    crudOperationsWorking: boolean;
    storageInfo?: StorageQuotaInfo;
    storageStats?: StorageStats;
    error?: string;
    lastChecked: Date;
}

// Utility functions for common storage operations
export async function getContentById(id: string): Promise<StoredContent | null> {
    const contentStore = ContentStore.getInstance();
    const result = await contentStore.read(id);
    return result.success ? result.data || null : null;
}

export async function getAllContent(): Promise<StoredContent[]> {
    const contentStore = ContentStore.getInstance();
    const result = await contentStore.list();
    return result.success ? result.data || [] : [];
}

export async function getContentByUrl(url: string): Promise<StoredContent | null> {
    const contentStore = ContentStore.getInstance();
    const result = await contentStore.list({
        filter: (content) => content.url === url,
        limit: 1
    });

    if (result.success && result.data && result.data.length > 0) {
        return result.data[0];
    }

    return null;
}

export async function getRecentContent(limit: number = 10): Promise<StoredContent[]> {
    const contentStore = ContentStore.getInstance();
    const result = await contentStore.list({
        sortBy: 'timestamp',
        sortDirection: 'desc',
        limit
    });

    return result.success ? result.data || [] : [];
}

export async function getMostAccessedContent(limit: number = 10): Promise<StoredContent[]> {
    const contentStore = ContentStore.getInstance();
    const result = await contentStore.list({
        sortBy: 'timesAccessed',
        sortDirection: 'desc',
        limit
    });

    return result.success ? result.data || [] : [];
}

// Search utility functions
export async function searchContent(query: string, options?: SearchOptions): Promise<ScoredSearchResult[]> {
    const searchIndex = SearchIndex.getInstance();
    const result = await searchIndex.search(query, options);
    return result.success ? result.results : [];
}

export async function indexContent(content: StoredContent): Promise<boolean> {
    const searchIndex = SearchIndex.getInstance();
    const result = await searchIndex.indexContent(content);
    return result.success;
}

export async function removeContentFromIndex(contentId: string): Promise<boolean> {
    const searchIndex = SearchIndex.getInstance();
    const result = await searchIndex.removeFromIndex(contentId);
    return result.success;
}

export async function rebuildSearchIndex(): Promise<RebuildResult> {
    const searchIndex = SearchIndex.getInstance();
    return await searchIndex.rebuildIndex();
}

export async function parseSearchQuery(query: string): Promise<ParsedQuery> {
    const queryParser = QueryParser.getInstance();
    return queryParser.parseQuery(query);
}

export async function getSearchSuggestions(partialQuery: string): Promise<string[]> {
    const queryParser = QueryParser.getInstance();
    return queryParser.getQuerySuggestions(partialQuery);
}