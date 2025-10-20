// Integration layer for relationship detection with content processing pipeline

import { RelationshipService, RelationshipServiceOptions } from './relationshipService';
import { StoredContent } from '../types/storage';
import { ContentStore } from '../storage/contentStore';

export interface RelationshipIntegrationOptions extends RelationshipServiceOptions {
    autoInitialize: boolean;
}

export class RelationshipIntegration {
    private static instance: RelationshipIntegration | null = null;
    private relationshipService: RelationshipService;
    private contentStore: ContentStore;
    private initialized: boolean = false;

    private readonly defaultOptions: RelationshipIntegrationOptions = {
        autoInitialize: true,
        enableAutoProcessing: true,
        processingDelay: 1000, // 1 second delay for better UX
        batchProcessingInterval: 30000, // 30 seconds
        maxRelationshipsPerContent: 15
    };

    constructor(options: Partial<RelationshipIntegrationOptions> = {}) {
        const config = { ...this.defaultOptions, ...options };

        this.relationshipService = new RelationshipService(config);
        this.contentStore = ContentStore.getInstance();

        if (config.autoInitialize) {
            this.initialize().catch(error => {
                console.error('Failed to auto-initialize relationship integration:', error);
            });
        }
    }

    static getInstance(options?: Partial<RelationshipIntegrationOptions>): RelationshipIntegration {
        if (!RelationshipIntegration.instance) {
            RelationshipIntegration.instance = new RelationshipIntegration(options);
        }
        return RelationshipIntegration.instance;
    }

    /**
     * Initializes the relationship integration
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            await this.relationshipService.initialize();
            this.initialized = true;
            console.log('Relationship integration initialized successfully');
        } catch (error) {
            console.error('Failed to initialize relationship integration:', error);
            throw error;
        }
    }

    /**
     * Processes relationships for newly captured content
     */
    async processNewContent(content: StoredContent): Promise<void> {
        if (!this.initialized) {
            console.warn('Relationship integration not initialized, skipping relationship processing');
            return;
        }

        try {
            await this.relationshipService.onContentCreated(content);
        } catch (error) {
            console.error(`Failed to process relationships for new content ${content.id}:`, error);
        }
    }

    /**
     * Updates relationships for modified content
     */
    async processUpdatedContent(content: StoredContent): Promise<void> {
        if (!this.initialized) {
            console.warn('Relationship integration not initialized, skipping relationship processing');
            return;
        }

        try {
            await this.relationshipService.onContentUpdated(content);
        } catch (error) {
            console.error(`Failed to process relationships for updated content ${content.id}:`, error);
        }
    }

    /**
     * Handles content deletion by removing relationships
     */
    async processDeletedContent(contentId: string): Promise<void> {
        if (!this.initialized) {
            return;
        }

        try {
            await this.relationshipService.onContentDeleted(contentId);
        } catch (error) {
            console.error(`Failed to process relationships for deleted content ${contentId}:`, error);
        }
    }

    /**
     * Gets related content for a specific item
     */
    async getRelatedContent(contentId: string, limit: number = 10) {
        if (!this.initialized) {
            return [];
        }

        try {
            return this.relationshipService.getRelatedContent(contentId, limit);
        } catch (error) {
            console.error(`Failed to get related content for ${contentId}:`, error);
            return [];
        }
    }

    /**
     * Searches for relationships with specific criteria
     */
    async queryRelationships(query: Parameters<typeof this.relationshipService.queryRelationships>[0]) {
        if (!this.initialized) {
            return [];
        }

        try {
            return this.relationshipService.queryRelationships(query);
        } catch (error) {
            console.error('Failed to query relationships:', error);
            return [];
        }
    }

    /**
     * Gets relationship statistics
     */
    getRelationshipStats() {
        if (!this.initialized) {
            return {
                totalRelationships: 0,
                relationshipsByType: {},
                averageStrength: 0,
                averageConfidence: 0,
                mostConnectedContent: []
            };
        }

        return this.relationshipService.getRelationshipStats();
    }

    /**
     * Gets service statistics
     */
    getServiceStats() {
        if (!this.initialized) {
            return {
                totalProcessed: 0,
                totalRelationships: 0,
                averageProcessingTime: 0,
                lastProcessingTime: new Date(),
                pendingUpdates: 0
            };
        }

        return this.relationshipService.getServiceStats();
    }

    /**
     * Manually triggers relationship processing for specific content
     */
    async triggerRelationshipProcessing(contentId: string): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            await this.relationshipService.processContentRelationships(contentId);
        } catch (error) {
            console.error(`Failed to trigger relationship processing for ${contentId}:`, error);
            throw error;
        }
    }

    /**
     * Rebuilds all relationships from scratch
     */
    async rebuildAllRelationships(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            await this.relationshipService.rebuildAllRelationships();
        } catch (error) {
            console.error('Failed to rebuild all relationships:', error);
            throw error;
        }
    }

    /**
     * Performs maintenance tasks
     */
    async performMaintenance(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        try {
            await this.relationshipService.performMaintenance();
        } catch (error) {
            console.error('Failed to perform relationship maintenance:', error);
        }
    }

    /**
     * Processes pending relationship updates
     */
    async processPendingUpdates(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        try {
            await this.relationshipService.processPendingUpdates();
        } catch (error) {
            console.error('Failed to process pending relationship updates:', error);
        }
    }

    /**
     * Checks if the integration is initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Destroys the integration and cleans up resources
     */
    destroy(): void {
        if (this.relationshipService) {
            this.relationshipService.destroy();
        }
        this.initialized = false;
        RelationshipIntegration.instance = null;
    }
}

// Export a default instance for easy use
export const relationshipIntegration = RelationshipIntegration.getInstance();

// Hook functions for integration with content processing pipeline
export const relationshipHooks = {
    /**
     * Hook to be called after content is successfully captured and stored
     */
    onContentCaptured: async (content: StoredContent): Promise<void> => {
        await relationshipIntegration.processNewContent(content);
    },

    /**
     * Hook to be called after content is updated
     */
    onContentUpdated: async (content: StoredContent): Promise<void> => {
        await relationshipIntegration.processUpdatedContent(content);
    },

    /**
     * Hook to be called before content is deleted
     */
    onContentDeleted: async (contentId: string): Promise<void> => {
        await relationshipIntegration.processDeletedContent(contentId);
    },

    /**
     * Hook to be called during AI processing to include relationship context
     */
    onAIProcessing: async (content: StoredContent): Promise<StoredContent[]> => {
        try {
            const related = await relationshipIntegration.getRelatedContent(content.id, 5);
            const relatedContent: StoredContent[] = [];

            // Check if related is an array before iterating
            if (Array.isArray(related)) {
                // Fetch the actual content for related items
                const contentStore = ContentStore.getInstance();
                for (const relationship of related) {
                    const result = await contentStore.read(relationship.targetId);
                    if (result.success && result.data) {
                        relatedContent.push(result.data);
                    }
                }
            }

            return relatedContent;
        } catch (error) {
            console.error('Error in onAIProcessing hook:', error);
            return [];
        }
    }
};