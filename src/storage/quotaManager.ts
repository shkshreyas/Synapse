// Storage quota management and cleanup utilities

import { getDatabase } from './database';
import { ContentStore } from './contentStore';
import { StoredContent, StorageQuotaInfo, CleanupCriteria, StorageStats } from '../types/storage';

export class QuotaManager {
    private static instance: QuotaManager | null = null;
    private readonly contentStore: ContentStore;

    // Default thresholds
    private readonly DEFAULT_WARNING_THRESHOLD = 80; // 80%
    private readonly DEFAULT_CLEANUP_THRESHOLD = 90; // 90%
    private readonly DEFAULT_MAX_STORAGE_MB = 500; // 500MB

    constructor() {
        this.contentStore = ContentStore.getInstance();
    }

    static getInstance(): QuotaManager {
        if (!QuotaManager.instance) {
            QuotaManager.instance = new QuotaManager();
        }
        return QuotaManager.instance;
    }

    async getStorageInfo(): Promise<StorageQuotaInfo> {
        try {
            const db = await getDatabase();
            const usage = await db.getStorageUsage();

            return {
                used: usage.used,
                available: usage.available,
                percentage: usage.percentage,
                warningThreshold: this.DEFAULT_WARNING_THRESHOLD,
                cleanupThreshold: this.DEFAULT_CLEANUP_THRESHOLD
            };
        } catch (error) {
            // Fallback to estimated storage info
            const stats = await this.getStorageStats();
            const estimatedQuota = this.DEFAULT_MAX_STORAGE_MB * 1024 * 1024; // Convert to bytes

            return {
                used: stats.totalSize,
                available: estimatedQuota,
                percentage: (stats.totalSize / estimatedQuota) * 100,
                warningThreshold: this.DEFAULT_WARNING_THRESHOLD,
                cleanupThreshold: this.DEFAULT_CLEANUP_THRESHOLD
            };
        }
    }

    async getStorageStats(): Promise<StorageStats> {
        const listResult = await this.contentStore.list();

        if (!listResult.success || !listResult.data) {
            return {
                totalItems: 0,
                totalSize: 0,
                averageSize: 0,
                oldestItem: new Date(),
                newestItem: new Date(),
                mostAccessed: '',
                categories: {},
                languages: {}
            };
        }

        const contents = listResult.data;
        const totalItems = contents.length;
        const totalSize = contents.reduce((sum, content) => sum + content.storageSize, 0);
        const averageSize = totalItems > 0 ? totalSize / totalItems : 0;

        // Find oldest and newest items
        const timestamps = contents.map(c => c.timestamp.getTime());
        const oldestItem = new Date(Math.min(...timestamps));
        const newestItem = new Date(Math.max(...timestamps));

        // Find most accessed item
        const mostAccessedContent = contents.reduce((prev, current) =>
            (current.timesAccessed > prev.timesAccessed) ? current : prev
        );
        const mostAccessed = mostAccessedContent?.id || '';

        // Category distribution
        const categories: Record<string, number> = {};
        contents.forEach(content => {
            const category = content.category || 'uncategorized';
            categories[category] = (categories[category] || 0) + 1;
        });

        // Language distribution
        const languages: Record<string, number> = {};
        contents.forEach(content => {
            const language = content.metadata.language;
            languages[language] = (languages[language] || 0) + 1;
        });

        return {
            totalItems,
            totalSize,
            averageSize,
            oldestItem,
            newestItem,
            mostAccessed,
            categories,
            languages
        };
    }

    async shouldWarnUser(): Promise<boolean> {
        const storageInfo = await this.getStorageInfo();
        return storageInfo.percentage >= storageInfo.warningThreshold;
    }

    async shouldAutoCleanup(): Promise<boolean> {
        const storageInfo = await this.getStorageInfo();
        return storageInfo.percentage >= storageInfo.cleanupThreshold;
    }

    async performCleanup(criteria?: CleanupCriteria): Promise<CleanupResult> {
        const startTime = performance.now();
        const defaultCriteria: CleanupCriteria = {
            maxAge: 365, // 1 year
            minAccessCount: 0,
            minImportance: 1,
            excludeUserRated: true,
            excludeUserNotes: true,
            ...criteria
        };

        try {
            const listResult = await this.contentStore.list();
            if (!listResult.success || !listResult.data) {
                return {
                    success: false,
                    error: 'Failed to retrieve content for cleanup',
                    itemsDeleted: 0,
                    spaceFreed: 0,
                    operationTime: performance.now() - startTime
                };
            }

            const candidates = this.identifyCleanupCandidates(listResult.data, defaultCriteria);
            let itemsDeleted = 0;
            let spaceFreed = 0;
            const errors: string[] = [];

            for (const candidate of candidates) {
                const deleteResult = await this.contentStore.delete(candidate.id);
                if (deleteResult.success) {
                    itemsDeleted++;
                    spaceFreed += candidate.storageSize;
                } else {
                    errors.push(`Failed to delete ${candidate.id}: ${deleteResult.error}`);
                }
            }

            return {
                success: errors.length === 0,
                error: errors.length > 0 ? errors.join('; ') : undefined,
                itemsDeleted,
                spaceFreed,
                operationTime: performance.now() - startTime,
                candidatesFound: candidates.length
            };
        } catch (error) {
            return {
                success: false,
                error: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                itemsDeleted: 0,
                spaceFreed: 0,
                operationTime: performance.now() - startTime
            };
        }
    }

    private identifyCleanupCandidates(contents: StoredContent[], criteria: CleanupCriteria): StoredContent[] {
        const now = new Date();
        const maxAgeMs = (criteria.maxAge || 365) * 24 * 60 * 60 * 1000; // Convert days to milliseconds

        return contents.filter(content => {
            // Skip if user has rated the content
            if (criteria.excludeUserRated && content.userRating !== undefined) {
                return false;
            }

            // Skip if user has added notes
            if (criteria.excludeUserNotes && content.userNotes && content.userNotes.trim().length > 0) {
                return false;
            }

            // Check age
            if (criteria.maxAge !== undefined) {
                const age = now.getTime() - content.timestamp.getTime();
                if (age < maxAgeMs) {
                    return false;
                }
            }

            // Check access count
            if (criteria.minAccessCount !== undefined && content.timesAccessed >= criteria.minAccessCount) {
                return false;
            }

            // Check importance
            if (criteria.minImportance !== undefined &&
                content.importance !== undefined &&
                content.importance >= criteria.minImportance) {
                return false;
            }

            return true;
        }).sort((a, b) => {
            // Sort by least important first, then by oldest, then by least accessed
            const importanceA = a.importance || 0;
            const importanceB = b.importance || 0;

            if (importanceA !== importanceB) {
                return importanceA - importanceB;
            }

            if (a.timestamp.getTime() !== b.timestamp.getTime()) {
                return a.timestamp.getTime() - b.timestamp.getTime();
            }

            return a.timesAccessed - b.timesAccessed;
        });
    }

    async optimizeStorage(): Promise<OptimizationResult> {
        const startTime = performance.now();

        try {
            // Get current stats
            const beforeStats = await this.getStorageStats();

            // Perform various optimizations
            const results: string[] = [];
            let totalSpaceSaved = 0;

            // 1. Remove duplicate content (same URL)
            const duplicateResult = await this.removeDuplicates();
            if (duplicateResult.success) {
                results.push(`Removed ${duplicateResult.itemsDeleted} duplicates`);
                totalSpaceSaved += duplicateResult.spaceFreed;
            }

            // 2. Compress large screenshots (placeholder for future implementation)
            // This would involve image compression logic

            // 3. Clean up orphaned search index entries
            await this.cleanupSearchIndex();
            results.push('Cleaned up search index');

            // Get final stats
            const afterStats = await this.getStorageStats();
            const actualSpaceSaved = beforeStats.totalSize - afterStats.totalSize;

            return {
                success: true,
                optimizations: results,
                spaceSaved: actualSpaceSaved,
                itemsProcessed: beforeStats.totalItems,
                operationTime: performance.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                error: `Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                optimizations: [],
                spaceSaved: 0,
                itemsProcessed: 0,
                operationTime: performance.now() - startTime
            };
        }
    }

    private async removeDuplicates(): Promise<CleanupResult> {
        const startTime = performance.now();

        try {
            const listResult = await this.contentStore.list();
            if (!listResult.success || !listResult.data) {
                return {
                    success: false,
                    error: 'Failed to retrieve content',
                    itemsDeleted: 0,
                    spaceFreed: 0,
                    operationTime: performance.now() - startTime
                };
            }

            const urlMap = new Map<string, StoredContent[]>();

            // Group by URL
            for (const content of listResult.data) {
                if (!urlMap.has(content.url)) {
                    urlMap.set(content.url, []);
                }
                urlMap.get(content.url)!.push(content);
            }

            let itemsDeleted = 0;
            let spaceFreed = 0;

            // For each URL with duplicates, keep the most recent one
            for (const [url, contents] of urlMap) {
                if (contents.length > 1) {
                    // Sort by timestamp, keep the newest
                    contents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                    const toDelete = contents.slice(1); // Remove all but the first (newest)

                    for (const content of toDelete) {
                        const deleteResult = await this.contentStore.delete(content.id);
                        if (deleteResult.success) {
                            itemsDeleted++;
                            spaceFreed += content.storageSize;
                        }
                    }
                }
            }

            return {
                success: true,
                itemsDeleted,
                spaceFreed,
                operationTime: performance.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                error: `Duplicate removal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                itemsDeleted: 0,
                spaceFreed: 0,
                operationTime: performance.now() - startTime
            };
        }
    }

    private async cleanupSearchIndex(): Promise<void> {
        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            // Get all content IDs
            const contentTransaction = database.transaction(['content'], 'readonly');
            const contentStore = contentTransaction.objectStore('content');
            const contentIds = new Set<string>();

            await new Promise<void>((resolve, reject) => {
                const request = contentStore.openCursor();
                request.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result;
                    if (cursor) {
                        contentIds.add(cursor.value.id);
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                request.onerror = () => reject(request.error);
            });

            // Remove orphaned search index entries
            const searchTransaction = database.transaction(['searchIndex'], 'readwrite');
            const searchStore = searchTransaction.objectStore('searchIndex');

            await new Promise<void>((resolve, reject) => {
                const request = searchStore.openCursor();
                request.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result;
                    if (cursor) {
                        if (!contentIds.has(cursor.value.contentId)) {
                            cursor.delete();
                        }
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.warn('Failed to cleanup search index:', error);
        }
    }
}

export interface CleanupResult {
    success: boolean;
    error?: string;
    itemsDeleted: number;
    spaceFreed: number;
    operationTime: number;
    candidatesFound?: number;
}

export interface OptimizationResult {
    success: boolean;
    error?: string;
    optimizations: string[];
    spaceSaved: number;
    itemsProcessed: number;
    operationTime: number;
}