// Relationship storage operations using IndexedDB

import { getDatabase } from './database';
import { ContentRelationship, StorageOperationResult, BulkOperationResult } from '../types/storage';

export class RelationshipStore {
    private static instance: RelationshipStore | null = null;

    static getInstance(): RelationshipStore {
        if (!RelationshipStore.instance) {
            RelationshipStore.instance = new RelationshipStore();
        }
        return RelationshipStore.instance;
    }

    async create(relationship: ContentRelationship): Promise<StorageOperationResult<ContentRelationship>> {
        const startTime = performance.now();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['relationships'], 'readwrite');
                const store = transaction.objectStore('relationships');
                const request = store.add(relationship);

                request.onsuccess = () => {
                    resolve({
                        success: true,
                        data: relationship,
                        operationTime: performance.now() - startTime
                    });
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to store relationship: ${request.error?.message}`,
                        operationTime: performance.now() - startTime
                    });
                };
            });
        } catch (error) {
            return {
                success: false,
                error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                operationTime: performance.now() - startTime
            };
        }
    }

    async read(id: string): Promise<StorageOperationResult<ContentRelationship>> {
        const startTime = performance.now();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['relationships'], 'readonly');
                const store = transaction.objectStore('relationships');
                const request = store.get(id);

                request.onsuccess = () => {
                    if (request.result) {
                        resolve({
                            success: true,
                            data: request.result,
                            operationTime: performance.now() - startTime
                        });
                    } else {
                        resolve({
                            success: false,
                            error: 'Relationship not found',
                            operationTime: performance.now() - startTime
                        });
                    }
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to read relationship: ${request.error?.message}`,
                        operationTime: performance.now() - startTime
                    });
                };
            });
        } catch (error) {
            return {
                success: false,
                error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                operationTime: performance.now() - startTime
            };
        }
    }

    async update(id: string, updates: Partial<ContentRelationship>): Promise<StorageOperationResult<ContentRelationship>> {
        const startTime = performance.now();

        try {
            // First read the existing relationship
            const existingResult = await this.read(id);
            if (!existingResult.success || !existingResult.data) {
                return {
                    success: false,
                    error: 'Relationship not found for update',
                    operationTime: performance.now() - startTime
                };
            }

            // Merge updates
            const updatedRelationship: ContentRelationship = {
                ...existingResult.data,
                ...updates,
                lastUpdated: new Date()
            };

            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['relationships'], 'readwrite');
                const store = transaction.objectStore('relationships');
                const request = store.put(updatedRelationship);

                request.onsuccess = () => {
                    resolve({
                        success: true,
                        data: updatedRelationship,
                        operationTime: performance.now() - startTime
                    });
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to update relationship: ${request.error?.message}`,
                        operationTime: performance.now() - startTime
                    });
                };
            });
        } catch (error) {
            return {
                success: false,
                error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                operationTime: performance.now() - startTime
            };
        }
    }

    async delete(id: string): Promise<StorageOperationResult<void>> {
        const startTime = performance.now();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['relationships'], 'readwrite');
                const store = transaction.objectStore('relationships');
                const request = store.delete(id);

                request.onsuccess = () => {
                    resolve({
                        success: true,
                        operationTime: performance.now() - startTime
                    });
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to delete relationship: ${request.error?.message}`,
                        operationTime: performance.now() - startTime
                    });
                };
            });
        } catch (error) {
            return {
                success: false,
                error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                operationTime: performance.now() - startTime
            };
        }
    }

    async findBySourceId(sourceId: string): Promise<StorageOperationResult<ContentRelationship[]>> {
        const startTime = performance.now();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['relationships'], 'readonly');
                const store = transaction.objectStore('relationships');
                const index = store.index('sourceId');
                const request = index.getAll(sourceId);

                request.onsuccess = () => {
                    resolve({
                        success: true,
                        data: request.result || [],
                        operationTime: performance.now() - startTime
                    });
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to find relationships by source: ${request.error?.message}`,
                        operationTime: performance.now() - startTime
                    });
                };
            });
        } catch (error) {
            return {
                success: false,
                error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                operationTime: performance.now() - startTime
            };
        }
    }

    async findByTargetId(targetId: string): Promise<StorageOperationResult<ContentRelationship[]>> {
        const startTime = performance.now();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['relationships'], 'readonly');
                const store = transaction.objectStore('relationships');
                const index = store.index('targetId');
                const request = index.getAll(targetId);

                request.onsuccess = () => {
                    resolve({
                        success: true,
                        data: request.result || [],
                        operationTime: performance.now() - startTime
                    });
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to find relationships by target: ${request.error?.message}`,
                        operationTime: performance.now() - startTime
                    });
                };
            });
        } catch (error) {
            return {
                success: false,
                error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                operationTime: performance.now() - startTime
            };
        }
    }

    async findByContentId(contentId: string): Promise<StorageOperationResult<ContentRelationship[]>> {
        const startTime = performance.now();

        try {
            // Get relationships where content is either source or target
            const sourceResult = await this.findBySourceId(contentId);
            const targetResult = await this.findByTargetId(contentId);

            if (!sourceResult.success || !targetResult.success) {
                return {
                    success: false,
                    error: 'Failed to find relationships for content',
                    operationTime: performance.now() - startTime
                };
            }

            // Combine and deduplicate results
            const allRelationships = [...(sourceResult.data || []), ...(targetResult.data || [])];
            const uniqueRelationships = allRelationships.filter((rel, index, arr) =>
                arr.findIndex(r => r.id === rel.id) === index
            );

            return {
                success: true,
                data: uniqueRelationships,
                operationTime: performance.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                operationTime: performance.now() - startTime
            };
        }
    }

    async findByType(type: ContentRelationship['type']): Promise<StorageOperationResult<ContentRelationship[]>> {
        const startTime = performance.now();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['relationships'], 'readonly');
                const store = transaction.objectStore('relationships');
                const index = store.index('type');
                const request = index.getAll(type);

                request.onsuccess = () => {
                    resolve({
                        success: true,
                        data: request.result || [],
                        operationTime: performance.now() - startTime
                    });
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to find relationships by type: ${request.error?.message}`,
                        operationTime: performance.now() - startTime
                    });
                };
            });
        } catch (error) {
            return {
                success: false,
                error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                operationTime: performance.now() - startTime
            };
        }
    }

    async deleteByContentId(contentId: string): Promise<StorageOperationResult<number>> {
        const startTime = performance.now();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['relationships'], 'readwrite');
                const store = transaction.objectStore('relationships');
                let deletedCount = 0;

                // Delete relationships where content is the source
                const sourceIndex = store.index('sourceId');
                const sourceRange = IDBKeyRange.only(contentId);
                const sourceRequest = sourceIndex.openCursor(sourceRange);

                sourceRequest.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result;
                    if (cursor) {
                        cursor.delete();
                        deletedCount++;
                        cursor.continue();
                    } else {
                        // Now delete relationships where content is the target
                        const targetIndex = store.index('targetId');
                        const targetRange = IDBKeyRange.only(contentId);
                        const targetRequest = targetIndex.openCursor(targetRange);

                        targetRequest.onsuccess = (event) => {
                            const cursor = (event.target as IDBRequest).result;
                            if (cursor) {
                                cursor.delete();
                                deletedCount++;
                                cursor.continue();
                            }
                        };
                    }
                };

                transaction.oncomplete = () => {
                    resolve({
                        success: true,
                        data: deletedCount,
                        operationTime: performance.now() - startTime
                    });
                };

                transaction.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to delete relationships: ${transaction.error?.message}`,
                        operationTime: performance.now() - startTime
                    });
                };
            });
        } catch (error) {
            return {
                success: false,
                error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                operationTime: performance.now() - startTime
            };
        }
    }

    async list(options?: RelationshipListOptions): Promise<StorageOperationResult<ContentRelationship[]>> {
        const startTime = performance.now();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['relationships'], 'readonly');
                const store = transaction.objectStore('relationships');
                const request = store.getAll();

                request.onsuccess = () => {
                    let results: ContentRelationship[] = request.result || [];

                    // Apply filters
                    if (options?.minStrength !== undefined) {
                        results = results.filter(r => r.strength >= options.minStrength!);
                    }

                    if (options?.minConfidence !== undefined) {
                        results = results.filter(r => r.confidence >= options.minConfidence!);
                    }

                    if (options?.type) {
                        results = results.filter(r => r.type === options.type);
                    }

                    if (options?.sourceId) {
                        results = results.filter(r => r.sourceId === options.sourceId);
                    }

                    if (options?.targetId) {
                        results = results.filter(r => r.targetId === options.targetId);
                    }

                    // Apply sorting
                    if (options?.sortBy) {
                        results.sort((a, b) => {
                            const aVal = (a as any)[options.sortBy!];
                            const bVal = (b as any)[options.sortBy!];

                            if (options.sortDirection === 'desc') {
                                return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
                            } else {
                                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                            }
                        });
                    }

                    // Apply pagination
                    if (options?.limit || options?.offset) {
                        const start = options.offset || 0;
                        const end = options.limit ? start + options.limit : undefined;
                        results = results.slice(start, end);
                    }

                    resolve({
                        success: true,
                        data: results,
                        operationTime: performance.now() - startTime
                    });
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to list relationships: ${request.error?.message}`,
                        operationTime: performance.now() - startTime
                    });
                };
            });
        } catch (error) {
            return {
                success: false,
                error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                operationTime: performance.now() - startTime
            };
        }
    }

    async bulkCreate(relationships: ContentRelationship[]): Promise<BulkOperationResult<ContentRelationship>> {
        const startTime = performance.now();
        const results: StorageOperationResult<ContentRelationship>[] = [];

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['relationships'], 'readwrite');
                const store = transaction.objectStore('relationships');
                let completed = 0;

                for (const relationship of relationships) {
                    const request = store.add(relationship);

                    request.onsuccess = () => {
                        results.push({
                            success: true,
                            data: relationship,
                            operationTime: 0 // Individual timing not tracked in bulk
                        });
                        completed++;

                        if (completed === relationships.length) {
                            const successCount = results.filter(r => r.success).length;
                            const failureCount = results.length - successCount;

                            resolve({
                                success: failureCount === 0,
                                successCount,
                                failureCount,
                                results,
                                totalTime: performance.now() - startTime
                            });
                        }
                    };

                    request.onerror = () => {
                        results.push({
                            success: false,
                            error: `Failed to store relationship: ${request.error?.message}`,
                            operationTime: 0
                        });
                        completed++;

                        if (completed === relationships.length) {
                            const successCount = results.filter(r => r.success).length;
                            const failureCount = results.length - successCount;

                            resolve({
                                success: failureCount === 0,
                                successCount,
                                failureCount,
                                results,
                                totalTime: performance.now() - startTime
                            });
                        }
                    };
                }
            });
        } catch (error) {
            return {
                success: false,
                successCount: 0,
                failureCount: relationships.length,
                results: relationships.map(() => ({
                    success: false,
                    error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    operationTime: 0
                })),
                totalTime: performance.now() - startTime
            };
        }
    }

    async clear(): Promise<StorageOperationResult<void>> {
        const startTime = performance.now();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['relationships'], 'readwrite');
                const store = transaction.objectStore('relationships');
                const request = store.clear();

                request.onsuccess = () => {
                    resolve({
                        success: true,
                        operationTime: performance.now() - startTime
                    });
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to clear relationships: ${request.error?.message}`,
                        operationTime: performance.now() - startTime
                    });
                };
            });
        } catch (error) {
            return {
                success: false,
                error: `Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                operationTime: performance.now() - startTime
            };
        }
    }
}

export interface RelationshipListOptions {
    minStrength?: number;
    minConfidence?: number;
    type?: ContentRelationship['type'];
    sourceId?: string;
    targetId?: string;
    sortBy?: keyof ContentRelationship;
    sortDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}