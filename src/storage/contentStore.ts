// Content storage operations using IndexedDB

import { getDatabase } from './database';
import { StoredContent, StorageOperationResult, BulkOperationResult, ValidationResult } from '../types/storage';
import { CapturedContent } from '../types/content';
import { validateContent } from './validators';

export class ContentStore {
    private static instance: ContentStore | null = null;

    static getInstance(): ContentStore {
        if (!ContentStore.instance) {
            ContentStore.instance = new ContentStore();
        }
        return ContentStore.instance;
    }

    async create(content: CapturedContent): Promise<StorageOperationResult<StoredContent>> {
        const startTime = performance.now();

        try {
            // Validate content
            const validation = validateContent(content);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
                    operationTime: performance.now() - startTime
                };
            }

            // Convert to StoredContent
            const storedContent: StoredContent = {
                ...content,
                timesAccessed: 0,
                lastAccessed: new Date(),
                syncedToCloud: false,
                cloudAnalysisComplete: false,
                lastModified: new Date(),
                storageSize: this.calculateContentSize(content),
                version: 1
            };

            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['content'], 'readwrite');
                const store = transaction.objectStore('content');
                const request = store.add(storedContent);

                request.onsuccess = () => {
                    resolve({
                        success: true,
                        data: storedContent,
                        operationTime: performance.now() - startTime
                    });
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to store content: ${request.error?.message}`,
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

    async read(id: string): Promise<StorageOperationResult<StoredContent>> {
        const startTime = performance.now();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['content'], 'readonly');
                const store = transaction.objectStore('content');
                const request = store.get(id);

                request.onsuccess = () => {
                    if (request.result) {
                        // Update access tracking
                        this.updateAccessTracking(id);

                        resolve({
                            success: true,
                            data: request.result,
                            operationTime: performance.now() - startTime
                        });
                    } else {
                        resolve({
                            success: false,
                            error: 'Content not found',
                            operationTime: performance.now() - startTime
                        });
                    }
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to read content: ${request.error?.message}`,
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

    async update(id: string, updates: Partial<StoredContent>): Promise<StorageOperationResult<StoredContent>> {
        const startTime = performance.now();

        try {
            // First read the existing content
            const existingResult = await this.read(id);
            if (!existingResult.success || !existingResult.data) {
                return {
                    success: false,
                    error: 'Content not found for update',
                    operationTime: performance.now() - startTime
                };
            }

            // Merge updates
            const updatedContent: StoredContent = {
                ...existingResult.data,
                ...updates,
                lastModified: new Date(),
                version: existingResult.data.version + 1
            };

            // Recalculate storage size if content changed
            if (updates.content || updates.screenshot) {
                updatedContent.storageSize = this.calculateContentSize(updatedContent);
            }

            // Validate updated content
            const validation = validateContent(updatedContent);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
                    operationTime: performance.now() - startTime
                };
            }

            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['content'], 'readwrite');
                const store = transaction.objectStore('content');
                const request = store.put(updatedContent);

                request.onsuccess = () => {
                    resolve({
                        success: true,
                        data: updatedContent,
                        operationTime: performance.now() - startTime
                    });
                };

                request.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to update content: ${request.error?.message}`,
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
                const transaction = database.transaction(['content', 'searchIndex', 'relationships'], 'readwrite');

                // Delete from content store
                const contentStore = transaction.objectStore('content');
                const contentRequest = contentStore.delete(id);

                // Delete from search index
                const searchStore = transaction.objectStore('searchIndex');
                const searchIndex = searchStore.index('contentId');
                const searchRequest = searchIndex.getKey(id);

                searchRequest.onsuccess = () => {
                    if (searchRequest.result) {
                        searchStore.delete(searchRequest.result);
                    }
                };

                // Delete relationships
                const relationshipStore = transaction.objectStore('relationships');
                const sourceIndex = relationshipStore.index('sourceId');
                const targetIndex = relationshipStore.index('targetId');

                // Delete relationships where this content is the source
                const sourceRange = IDBKeyRange.only(id);
                sourceIndex.openCursor(sourceRange).onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    }
                };

                // Delete relationships where this content is the target
                const targetRange = IDBKeyRange.only(id);
                targetIndex.openCursor(targetRange).onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    }
                };

                transaction.oncomplete = () => {
                    resolve({
                        success: true,
                        operationTime: performance.now() - startTime
                    });
                };

                transaction.onerror = () => {
                    resolve({
                        success: false,
                        error: `Failed to delete content: ${transaction.error?.message}`,
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

    async list(options?: ListOptions): Promise<StorageOperationResult<StoredContent[]>> {
        const startTime = performance.now();

        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            return new Promise((resolve) => {
                const transaction = database.transaction(['content'], 'readonly');
                const store = transaction.objectStore('content');

                let request: IDBRequest;

                if (options?.sortBy) {
                    // Use index for sorting
                    const index = store.index(options.sortBy);
                    request = index.getAll();
                } else {
                    request = store.getAll();
                }

                request.onsuccess = () => {
                    let results: StoredContent[] = request.result || [];

                    // Apply filters
                    if (options?.filter) {
                        results = results.filter(options.filter);
                    }

                    // Apply sorting if not using index
                    if (options?.sortBy && options?.sortDirection) {
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
                        error: `Failed to list content: ${request.error?.message}`,
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

    async bulkCreate(contents: CapturedContent[]): Promise<BulkOperationResult<StoredContent>> {
        const startTime = performance.now();
        const results: StorageOperationResult<StoredContent>[] = [];

        for (const content of contents) {
            const result = await this.create(content);
            results.push(result);
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        return {
            success: failureCount === 0,
            successCount,
            failureCount,
            results,
            totalTime: performance.now() - startTime
        };
    }

    private async updateAccessTracking(id: string): Promise<void> {
        try {
            const db = await getDatabase();
            const database = db.getDatabase();

            const transaction = database.transaction(['content'], 'readwrite');
            const store = transaction.objectStore('content');
            const request = store.get(id);

            request.onsuccess = () => {
                if (request.result) {
                    const content = request.result as StoredContent;
                    content.timesAccessed += 1;
                    content.lastAccessed = new Date();
                    store.put(content);
                }
            };
        } catch (error) {
            // Silent fail for access tracking
            console.warn('Failed to update access tracking:', error);
        }
    }

    private calculateContentSize(content: CapturedContent | StoredContent): number {
        const jsonString = JSON.stringify(content);
        return new Blob([jsonString]).size;
    }
}

export interface ListOptions {
    filter?: (content: StoredContent) => boolean;
    sortBy?: keyof StoredContent;
    sortDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}