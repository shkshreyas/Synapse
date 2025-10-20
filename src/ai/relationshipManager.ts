// Relationship management for storing and retrieving content relationships

import { ContentRelationship, StoredContent } from '../types/storage';
import { RelationshipAnalyzer, RelationshipAnalysisResult, RelationshipDetectionOptions } from './relationshipAnalyzer';

export interface RelationshipManagerOptions {
    autoUpdateRelationships: boolean;
    batchSize: number; // For bulk operations
    maxRelationshipsPerContent: number;
    relationshipTTL?: number; // Time to live in days, undefined for no expiry
}

export interface RelationshipQuery {
    sourceId?: string;
    targetId?: string;
    type?: ContentRelationship['type'];
    minStrength?: number;
    minConfidence?: number;
    limit?: number;
}

export interface RelationshipStats {
    totalRelationships: number;
    relationshipsByType: Record<string, number>;
    averageStrength: number;
    averageConfidence: number;
    mostConnectedContent: string[];
}

export class RelationshipManager {
    private analyzer: RelationshipAnalyzer;
    private relationships: Map<string, ContentRelationship> = new Map();
    private contentIndex: Map<string, Set<string>> = new Map(); // contentId -> relationshipIds

    private readonly defaultOptions: RelationshipManagerOptions = {
        autoUpdateRelationships: true,
        batchSize: 50,
        maxRelationshipsPerContent: 20,
        relationshipTTL: undefined
    };

    constructor(
        private options: Partial<RelationshipManagerOptions> = {}
    ) {
        this.analyzer = new RelationshipAnalyzer();
        this.options = { ...this.defaultOptions, ...options };
    }

    /**
     * Processes a new content item and creates relationships
     */
    async processNewContent(
        newContent: StoredContent,
        existingContent: StoredContent[],
        analysisOptions?: Partial<RelationshipDetectionOptions>
    ): Promise<RelationshipAnalysisResult> {
        const result = await this.analyzer.analyzeRelationships(
            newContent,
            existingContent,
            {
                maxRelationshipsPerContent: this.options.maxRelationshipsPerContent,
                ...analysisOptions
            }
        );

        if (result.success) {
            // Store the new relationships
            for (const relationship of result.relationships) {
                await this.storeRelationship(relationship);
            }

            // Create bidirectional relationships
            await this.createBidirectionalRelationships(result.relationships);
        }

        return result;
    }

    /**
     * Updates relationships when content is modified
     */
    async updateContentRelationships(
        updatedContent: StoredContent,
        allContent: StoredContent[],
        analysisOptions?: Partial<RelationshipDetectionOptions>
    ): Promise<RelationshipAnalysisResult> {
        // Remove existing relationships for this content
        await this.removeContentRelationships(updatedContent.id);

        // Recalculate relationships
        const existingRelationships = Array.from(this.relationships.values());
        const result = await this.analyzer.updateRelationships(
            updatedContent,
            allContent,
            existingRelationships,
            {
                maxRelationshipsPerContent: this.options.maxRelationshipsPerContent,
                ...analysisOptions
            }
        );

        if (result.success) {
            // Store the updated relationships
            for (const relationship of result.relationships) {
                await this.storeRelationship(relationship);
            }

            // Create bidirectional relationships
            await this.createBidirectionalRelationships(result.relationships);
        }

        return result;
    }

    /**
     * Stores a relationship in memory and indexes it
     */
    async storeRelationship(relationship: ContentRelationship): Promise<void> {
        this.relationships.set(relationship.id, relationship);

        // Index by source content
        if (!this.contentIndex.has(relationship.sourceId)) {
            this.contentIndex.set(relationship.sourceId, new Set());
        }
        this.contentIndex.get(relationship.sourceId)!.add(relationship.id);

        // Index by target content
        if (!this.contentIndex.has(relationship.targetId)) {
            this.contentIndex.set(relationship.targetId, new Set());
        }
        this.contentIndex.get(relationship.targetId)!.add(relationship.id);
    }

    /**
     * Creates bidirectional relationships (if A relates to B, then B relates to A)
     */
    private async createBidirectionalRelationships(relationships: ContentRelationship[]): Promise<void> {
        for (const relationship of relationships) {
            // Check if reverse relationship already exists
            const reverseExists = Array.from(this.relationships.values()).some(r =>
                r.sourceId === relationship.targetId && r.targetId === relationship.sourceId
            );

            if (!reverseExists) {
                const reverseRelationship: ContentRelationship = {
                    id: `${relationship.targetId}-${relationship.sourceId}-${Date.now()}`,
                    sourceId: relationship.targetId,
                    targetId: relationship.sourceId,
                    type: relationship.type,
                    strength: relationship.strength,
                    confidence: relationship.confidence,
                    createdAt: relationship.createdAt,
                    lastUpdated: relationship.lastUpdated
                };

                await this.storeRelationship(reverseRelationship);
            }
        }
    }

    /**
     * Removes all relationships for a specific content item
     */
    async removeContentRelationships(contentId: string): Promise<number> {
        const relationshipIds = this.contentIndex.get(contentId) || new Set();
        let removedCount = 0;

        for (const relationshipId of relationshipIds) {
            if (this.relationships.has(relationshipId)) {
                const relationship = this.relationships.get(relationshipId)!;

                // Remove from relationships map
                this.relationships.delete(relationshipId);

                // Remove from content indexes
                this.contentIndex.get(relationship.sourceId)?.delete(relationshipId);
                this.contentIndex.get(relationship.targetId)?.delete(relationshipId);

                removedCount++;
            }
        }

        // Clear the content index for this content
        this.contentIndex.delete(contentId);

        return removedCount;
    }

    /**
     * Queries relationships based on criteria
     */
    queryRelationships(query: RelationshipQuery): ContentRelationship[] {
        let results = Array.from(this.relationships.values());

        // Filter by source ID
        if (query.sourceId) {
            results = results.filter(r => r.sourceId === query.sourceId);
        }

        // Filter by target ID
        if (query.targetId) {
            results = results.filter(r => r.targetId === query.targetId);
        }

        // Filter by type
        if (query.type) {
            results = results.filter(r => r.type === query.type);
        }

        // Filter by minimum strength
        if (query.minStrength !== undefined) {
            results = results.filter(r => r.strength >= query.minStrength);
        }

        // Filter by minimum confidence
        if (query.minConfidence !== undefined) {
            results = results.filter(r => r.confidence >= query.minConfidence);
        }

        // Sort by strength descending
        results.sort((a, b) => b.strength - a.strength);

        // Apply limit
        if (query.limit) {
            results = results.slice(0, query.limit);
        }

        return results;
    }

    /**
     * Gets related content for a specific content item
     */
    getRelatedContent(contentId: string, limit: number = 10): ContentRelationship[] {
        return this.queryRelationships({
            sourceId: contentId,
            limit,
            minStrength: 0.3 // Only return meaningful relationships
        });
    }

    /**
     * Gets the strongest relationships in the system
     */
    getStrongestRelationships(limit: number = 20): ContentRelationship[] {
        return Array.from(this.relationships.values())
            .sort((a, b) => b.strength - a.strength)
            .slice(0, limit);
    }

    /**
     * Cleans up expired relationships based on TTL
     */
    async cleanupExpiredRelationships(): Promise<number> {
        if (!this.options.relationshipTTL) {
            return 0; // No TTL configured
        }

        const ttlMs = this.options.relationshipTTL * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(Date.now() - ttlMs);
        let removedCount = 0;

        for (const [id, relationship] of this.relationships.entries()) {
            if (relationship.createdAt < cutoffDate) {
                // Remove from relationships map
                this.relationships.delete(id);

                // Remove from content indexes
                this.contentIndex.get(relationship.sourceId)?.delete(id);
                this.contentIndex.get(relationship.targetId)?.delete(id);

                removedCount++;
            }
        }

        return removedCount;
    }

    /**
     * Gets statistics about relationships
     */
    getRelationshipStats(): RelationshipStats {
        const relationships = Array.from(this.relationships.values());

        if (relationships.length === 0) {
            return {
                totalRelationships: 0,
                relationshipsByType: {},
                averageStrength: 0,
                averageConfidence: 0,
                mostConnectedContent: []
            };
        }

        // Count by type
        const relationshipsByType: Record<string, number> = {};
        let totalStrength = 0;
        let totalConfidence = 0;

        for (const relationship of relationships) {
            relationshipsByType[relationship.type] = (relationshipsByType[relationship.type] || 0) + 1;
            totalStrength += relationship.strength;
            totalConfidence += relationship.confidence;
        }

        // Find most connected content
        const connectionCounts = new Map<string, number>();
        for (const relationship of relationships) {
            connectionCounts.set(
                relationship.sourceId,
                (connectionCounts.get(relationship.sourceId) || 0) + 1
            );
        }

        const mostConnectedContent = Array.from(connectionCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([contentId]) => contentId);

        return {
            totalRelationships: relationships.length,
            relationshipsByType,
            averageStrength: totalStrength / relationships.length,
            averageConfidence: totalConfidence / relationships.length,
            mostConnectedContent
        };
    }

    /**
     * Loads relationships from storage (to be implemented with actual storage)
     */
    async loadRelationships(relationships: ContentRelationship[]): Promise<void> {
        this.relationships.clear();
        this.contentIndex.clear();

        for (const relationship of relationships) {
            await this.storeRelationship(relationship);
        }
    }

    /**
     * Gets all relationships for export or persistence
     */
    getAllRelationships(): ContentRelationship[] {
        return Array.from(this.relationships.values());
    }

    /**
     * Clears all relationships
     */
    clearAllRelationships(): void {
        this.relationships.clear();
        this.contentIndex.clear();
    }
}