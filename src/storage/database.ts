// IndexedDB database setup and management for MindScribe

export interface DatabaseConfig {
    name: string;
    version: number;
    stores: StoreConfig[];
}

export interface StoreConfig {
    name: string;
    keyPath: string;
    autoIncrement?: boolean;
    indices?: IndexConfig[];
}

export interface IndexConfig {
    name: string;
    keyPath: string | string[];
    unique?: boolean;
    multiEntry?: boolean;
}

export class MindScribeDatabase {
    private db: IDBDatabase | null = null;
    private readonly config: DatabaseConfig;

    constructor() {
        this.config = {
            name: 'MindScribeDB',
            version: 1,
            stores: [
                {
                    name: 'content',
                    keyPath: 'id',
                    indices: [
                        { name: 'url', keyPath: 'url', unique: true },
                        { name: 'timestamp', keyPath: 'timestamp' },
                        { name: 'category', keyPath: 'category' },
                        { name: 'tags', keyPath: 'tags', multiEntry: true },
                        { name: 'lastAccessed', keyPath: 'lastAccessed' },
                        { name: 'importance', keyPath: 'importance' }
                    ]
                },
                {
                    name: 'searchIndex',
                    keyPath: 'id',
                    indices: [
                        { name: 'contentId', keyPath: 'contentId', unique: true },
                        { name: 'terms', keyPath: 'terms', multiEntry: true }
                    ]
                },
                {
                    name: 'relationships',
                    keyPath: 'id',
                    indices: [
                        { name: 'sourceId', keyPath: 'sourceId' },
                        { name: 'targetId', keyPath: 'targetId' },
                        { name: 'type', keyPath: 'type' }
                    ]
                },
                {
                    name: 'settings',
                    keyPath: 'key'
                },
                {
                    name: 'searchHistory',
                    keyPath: 'id',
                    indices: [
                        { name: 'timestamp', keyPath: 'timestamp' },
                        { name: 'query', keyPath: 'query' }
                    ]
                },
                {
                    name: 'conversations',
                    keyPath: 'id',
                    indices: [
                        { name: 'createdAt', keyPath: 'createdAt' },
                        { name: 'lastUpdated', keyPath: 'lastUpdated' },
                        { name: 'topic', keyPath: 'topic' }
                    ]
                }
            ]
        };
    }

    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.config.name, this.config.version);

            request.onerror = () => {
                reject(new Error(`Failed to open database: ${request.error?.message}`));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                this.createStores(db);
            };
        });
    }

    private createStores(db: IDBDatabase): void {
        for (const storeConfig of this.config.stores) {
            // Delete existing store if it exists
            if (db.objectStoreNames.contains(storeConfig.name)) {
                db.deleteObjectStore(storeConfig.name);
            }

            // Create new store
            const store = db.createObjectStore(storeConfig.name, {
                keyPath: storeConfig.keyPath,
                autoIncrement: storeConfig.autoIncrement || false
            });

            // Create indices
            if (storeConfig.indices) {
                for (const indexConfig of storeConfig.indices) {
                    store.createIndex(indexConfig.name, indexConfig.keyPath, {
                        unique: indexConfig.unique || false,
                        multiEntry: indexConfig.multiEntry || false
                    });
                }
            }
        }
    }

    getDatabase(): IDBDatabase {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }

    async close(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    async clearAllData(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const transaction = this.db.transaction(this.config.stores.map(s => s.name), 'readwrite');

        const promises = this.config.stores.map(store => {
            return new Promise<void>((resolve, reject) => {
                const objectStore = transaction.objectStore(store.name);
                const request = objectStore.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        });

        await Promise.all(promises);
    }

    async getStorageUsage(): Promise<StorageUsage> {
        if (!navigator.storage || !navigator.storage.estimate) {
            throw new Error('Storage API not supported');
        }

        const estimate = await navigator.storage.estimate();

        return {
            used: estimate.usage || 0,
            available: estimate.quota || 0,
            percentage: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0
        };
    }
}

export interface StorageUsage {
    used: number;
    available: number;
    percentage: number;
}

// Singleton instance
let databaseInstance: MindScribeDatabase | null = null;

export async function getDatabase(): Promise<MindScribeDatabase> {
    if (!databaseInstance) {
        databaseInstance = new MindScribeDatabase();
        await databaseInstance.initialize();
    }
    return databaseInstance;
}