// Service layer for relationship detection and management with storage integration

import { StoredContent, ContentRelationship } from '../types/storage';
import { RelationshipManager, RelationshipManagerOptions } from './relationshipManager';
import { RelationshipDetectionOptions } from './relationshipAnalyzer';
import { RelationshipStore } from '../storage/relationshipStore';
import { ContentStore } from '../storage/contentStore';

export interface RelationshipServiceOptions extends RelationshipManagerOptions {
    enableAutoProcessing: boolean;
    processingDelay: number; // Delay in ms before processing relationships
    batchProcessingInterval: number; // Interval for batch processing in ms
}

export interface RelationshipUpdateTrigger {
    contentId: string;
    action: 'create' | 'update' | 'delete';
    timestamp: Date;
}

export interface RelationshipServiceStats {
    totalProcessed: number;
    totalRelationships: number;
    averageProcessingTime: number;
    lastProcessingTime: Date;
    pendingUpdates: number;
}

export class RelationshipService {
    private manager: RelationshipManager;
    private relationshipStore: RelationshipStore;
    private contentStore: ContentStore;
    private pendingUpdates: Map<string, RelationshipUpdateTrigger> = new Map();
    private processingQueue: Set<string> = new Set();
    private batchProcessingTimer?: NodeJS.Timeout;
    private stats: RelationshipServiceStats = {
        totalProcessed: 0,
        totalRelationships: 0,
        averageProcessingTime: 0,
        lastProcessingTime: new Date(),
        pendingUpdates: 0
    };

    private readonly defaultOptions: RelationshipServiceOptions = {
        enableAutoProcessing: true,
        processingDelay: 2000, // 2 seconds delay
        batchProcessingInterval: 30000, // 30 seconds
        autoUpdateRelationships: true,
        batchSize: 50,
        maxRelationshipsPerContent: 20
    };

    constructor(
        private options: Partial<RelationshipServiceOptions> = {}
    ) {
        this.options = { ...this.defaultOptions, ...options };
        this.manager = new RelationshipManager(this.options);
        this.relationshipStore = RelationshipStore.getInstance();
        this.contentStore = ContentStore.getInstance();

        if (this.options.enableAutoProcessing) {
            this.startBatchProcessing();
        }
    }

    /**
     * Initializes the service by loading existing relationships
     */
    async initialize(): Promise<void> {
        try {
            const result = await this.relationshipStore.list();
            if (result.success && result.data) {
                await this.manager.loadRelationships(result.data);
                this.stats.totalRelationships = result.data.length;
            }
        } catch (error) {
            console.error('Failed to initialize relationship service:', error);
        }
    }

    /**
     * Triggers relationship analysis for new content
     */
    async onContentCreated(content: StoredContent): Promise<void> {
        if (!this.options.enableAutoProcessing) {
            return;
        }

        this.addUpdateTrigger(content.id, 'create');

        if (this.options.processingDelay > 0) {
            // Delay processing to allow for batch operations
            setTimeout(() => {
                this.processContentRelationships(content.id);
            }, this.options.processingDelay);
        } else {
            await this.processContentRelationships(content.id);
        }
    }

    /**
     * Triggers relationship update for modified content
     */
    async onContentUpdated(content: StoredContent): Promise<void> {
        if (!this.options.enableAutoProcessing) {
            return;
        }

        this.addUpdateTrigger(content.id, 'update');

        if (this.options.processingDelay > 0) {
            setTimeout(() => {
                this.processContentRelationships(content.id);
            }, this.options.processingDelay);
        } else {
            await this.processContentRelationships(content.id);
        }
    }

    /**
     * Handles content deletion by removing relationships
     */
    async onContentDeleted(contentId: string): Promise<void> {
        try {
            // Remove relationships from memory manager
            const removedCount = await this.manager.removeContentRelationships(contentId);

            // Remove relationships from database
            const deleteResult = await this.relationshipStore.deleteByContentId(contentId);

            if (deleteResult.success) {
                this.stats.totalRelationships -= deleteResult.data || 0;
            }

            // Remove from pending updates
            this.pendingUpdates.delete(contentId);
            this.processingQueue.delete(contentId);
        } catch (error) {
            console.error(`Failed to handle content deletion for ${contentId}:`, error);
        }
    }

    /**
     * Gets all stored content from the content store
     */
    private async getStoredContent(): Promise<StoredContent[]> {
        const result = await this.contentStore.list();
        if (result.success && result.data) {
            return result.data;
        }
        return [];
    }

    /**
     * Manually processes relationships for specific content
     */
    async processContentRelationships(
        contentId: string,
        options?: Partial<RelationshipDetectionOptions>
    ): Promise<void> {
        if (this.processingQueue.has(contentId)) {
            return; // Already processing
        }

        this.processingQueue.add(contentId);
        const startTime = Date.now();

        try {
            const allContent = await this.getStoredContent();
            const targetContent = allContent.find(c => c.id === contentId);

            if (!targetContent) {
                console.warn(`Content not found for relationship processing: ${contentId}`);
                return;
            }

            const otherContent = allContent.filter(c => c.id !== contentId);
            const trigger = this.pendingUpdates.get(contentId);

            let result;
            if (trigger?.action === 'create') {
                result = await this.manager.processNewContent(targetContent, otherContent, options);
            } else {
                result = await this.manager.updateContentRelationships(targetContent, allContent, options);
            }

            if (result.success) {
                // Save relationships to storage
                const allRelationships = this.manager.getAllRelationships();
                const storeResult = await this.relationshipStore.bulkCreate(allRelationships);

                if (storeResult.success) {
                    // Update stats
                    this.stats.totalProcessed++;
                    this.stats.totalRelationships = allRelationships.length;
                    this.stats.lastProcessingTime = new Date();

                    const processingTime = Date.now() - startTime;
                    this.stats.averageProcessingTime =
                        (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + processingTime) /
                        this.stats.totalProcessed;
                } else {
                    console.error('Failed to store relationships:', storeResult);
                }
            }

            // Remove from pending updates
            this.pendingUpdates.delete(contentId);
        } catch (error) {
            console.error(`Failed to process relationships for content ${contentId}:`, error);
        } finally {
            this.processingQueue.delete(contentId);
            this.updatePendingStats();
        }
    }

    /**
     * Processes all pending relationship updates in batch
     */
    async processPendingUpdates(): Promise<void> {
        const pendingIds = Array.from(this.pendingUpdates.keys());

        if (pendingIds.length === 0) {
            return;
        }

        console.log(`Processing ${pendingIds.length} pending relationship updates`);

        // Process in batches to avoid overwhelming the system
        const batchSize = this.options.batchSize || 10;
        for (let i = 0; i < pendingIds.length; i += batchSize) {
            const batch = pendingIds.slice(i, i + batchSize);

            await Promise.all(
                batch.map(contentId => this.processContentRelationships(contentId))
            );
        }
    }

    /**
     * Gets related content for a specific item
     */
    getRelatedContent(contentId: string, limit: number = 10): ContentRelationship[] {
        return this.manager.getRelatedContent(contentId, limit);
    }

    /**
     * Queries relationships with specific criteria
     */
    queryRelationships(query: Parameters<typeof this.manager.queryRelationships>[0]): ContentRelationship[] {
        return this.manager.queryRelationships(query);
    }

    /**
     * Gets service statistics
     */
    getServiceStats(): RelationshipServiceStats {
        return { ...this.stats };
    }

    /**
     * Gets relationship statistics
     */
    getRelationshipStats(): ReturnType<typeof this.manager.getRelationshipStats> {
        return this.manager.getRelationshipStats();
    }

    /**
     * Performs maintenance tasks like cleanup
     */
    async performMaintenance(): Promise<void> {
        try {
            // Clean up expired relationships
            const removedCount = await this.manager.cleanupExpiredRelationships();

            if (removedCount > 0) {
                console.log(`Cleaned up ${removedCount} expired relationships`);

                // Save updated relationships
                const allRelationships = this.manager.getAllRelationships();
                await this.saveRelationships(allRelationships);
                this.stats.totalRelationships = allRelationships.length;
            }
        } catch (error) {
            console.error('Failed to perform relationship maintenance:', error);
        }
    }

    /**
     * Rebuilds all relationships from scratch
     */
    async rebuildAllRelationships(): Promise<void> {
        console.log('Rebuilding all relationships...');

        try {
            // Clear existing relationships
            this.manager.clearAllRelationships();

            // Get all content
            const allContent = await this.getStoredContent();

            // Process each content item
            for (let i = 0; i < allContent.length; i++) {
                const content = allContent[i];
                const otherContent = allContent.filter(c => c.id !== content.id);

                await this.manager.processNewContent(content, otherContent);

                // Log progress
                if ((i + 1) % 10 === 0) {
                    console.log(`Processed ${i + 1}/${allContent.length} content items`);
                }
            }

            // Save all relationships
            const allRelationships = this.manager.getAllRelationships();
            const storeResult = await this.relationshipStore.bulkCreate(allRelationships);

            if (storeResult.success) {
                this.stats.totalRelationships = allRelationships.length;
                console.log(`Rebuild complete. Created ${allRelationships.length} relationships.`);
            } else {
                console.error('Failed to store rebuilt relationships:', storeResult);
                throw new Error('Failed to store rebuilt relationships');
            }
        } catch (error) {
            console.error('Failed to rebuild relationships:', error);
            throw error;
        }
    }

    /**
     * Starts batch processing timer
     */
    private startBatchProcessing(): void {
        if (this.batchProcessingTimer) {
            clearInterval(this.batchProcessingTimer);
        }

        this.batchProcessingTimer = setInterval(
            () => this.processPendingUpdates(),
            this.options.batchProcessingInterval
        );
    }

    /**
     * Stops batch processing timer
     */
    private stopBatchProcessing(): void {
        if (this.batchProcessingTimer) {
            clearInterval(this.batchProcessingTimer);
            this.batchProcessingTimer = undefined;
        }
    }

    /**
     * Adds an update trigger for content
     */
    private addUpdateTrigger(contentId: string, action: RelationshipUpdateTrigger['action']): void {
        this.pendingUpdates.set(contentId, {
            contentId,
            action,
            timestamp: new Date()
        });
        this.updatePendingStats();
    }

    /**
     * Updates pending statistics
     */
    private updatePendingStats(): void {
        this.stats.pendingUpdates = this.pendingUpdates.size;
    }

    /**
     * Cleanup when service is destroyed
     */
    destroy(): void {
        this.stopBatchProcessing();
        this.pendingUpdates.clear();
        this.processingQueue.clear();
    }
}