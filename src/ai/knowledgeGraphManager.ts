// Knowledge graph manager for integrating with relationship system

import { KnowledgeGraph, GraphNode, GraphEdge, ContentCluster, GraphQueryOptions, GraphStats } from './knowledgeGraph';
import { StoredContent, ContentRelationship } from '../types/storage';
import { RelationshipStore } from '../storage/relationshipStore';
import { ContentStore } from '../storage/contentStore';

export interface GraphPersistenceData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    clusters: ContentCluster[];
    layout: any;
    lastUpdated: Date;
    version: number;
}

export interface GraphManagerOptions {
    autoSave: boolean;
    saveInterval: number; // milliseconds
    maxNodes: number;
    enableClustering: boolean;
    layoutUpdateInterval: number; // milliseconds
}

export interface GraphUpdateResult {
    success: boolean;
    nodesAdded: number;
    edgesAdded: number;
    nodesRemoved: number;
    edgesRemoved: number;
    clustersCreated: number;
    processingTime: number;
    error?: string;
}

export class KnowledgeGraphManager {
    private static instance: KnowledgeGraphManager | null = null;
    private graph: KnowledgeGraph;
    private relationshipStore: RelationshipStore;
    private contentStore: ContentStore;
    private saveTimer?: NodeJS.Timeout;
    private layoutTimer?: NodeJS.Timeout;
    private lastSaveTime: Date = new Date();

    private readonly defaultOptions: GraphManagerOptions = {
        autoSave: true,
        saveInterval: 30000, // 30 seconds
        maxNodes: 1000,
        enableClustering: true,
        layoutUpdateInterval: 60000 // 1 minute
    };

    constructor(private options: Partial<GraphManagerOptions> = {}) {
        this.options = { ...this.defaultOptions, ...options };
        this.graph = new KnowledgeGraph();
        this.relationshipStore = RelationshipStore.getInstance();
        this.contentStore = ContentStore.getInstance();

        if (this.options.autoSave) {
            this.startAutoSave();
        }

        if (this.options.layoutUpdateInterval && this.options.layoutUpdateInterval > 0) {
            this.startLayoutUpdates();
        }
    }

    static getInstance(options?: Partial<GraphManagerOptions>): KnowledgeGraphManager {
        if (!KnowledgeGraphManager.instance) {
            KnowledgeGraphManager.instance = new KnowledgeGraphManager(options);
        }
        return KnowledgeGraphManager.instance;
    }

    /**
     * Initializes the graph by loading content and relationships
     */
    async initialize(): Promise<GraphUpdateResult> {
        const startTime = Date.now();

        try {
            // Load existing graph data if available
            await this.loadGraph();

            // If no existing graph, build from content and relationships
            if (this.graph.getAllNodes().length === 0) {
                await this.rebuildGraph();
            }

            return {
                success: true,
                nodesAdded: this.graph.getAllNodes().length,
                edgesAdded: this.graph.getAllEdges().length,
                nodesRemoved: 0,
                edgesRemoved: 0,
                clustersCreated: this.graph.getAllClusters().length,
                processingTime: Date.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                nodesAdded: 0,
                edgesAdded: 0,
                nodesRemoved: 0,
                edgesRemoved: 0,
                clustersCreated: 0,
                processingTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Adds content to the knowledge graph
     */
    async addContent(content: StoredContent): Promise<GraphNode> {
        const node = this.graph.addContent(content);

        // Add relationships for this content
        await this.addContentRelationships(content.id);

        // Update clusters if enabled
        if (this.options.enableClustering) {
            this.updateClusters();
        }

        return node;
    }

    /**
     * Updates content in the knowledge graph
     */
    async updateContent(content: StoredContent): Promise<GraphNode | null> {
        // Remove existing content and re-add with updated data
        this.graph.removeContent(content.id);
        return await this.addContent(content);
    }

    /**
     * Removes content from the knowledge graph
     */
    async removeContent(contentId: string): Promise<boolean> {
        return this.graph.removeContent(contentId);
    }

    /**
     * Adds a relationship to the knowledge graph
     */
    async addRelationship(relationship: ContentRelationship): Promise<GraphEdge | null> {
        return this.graph.addRelationship(relationship);
    }

    /**
     * Removes a relationship from the knowledge graph
     */
    async removeRelationship(relationshipId: string): Promise<boolean> {
        return this.graph.removeRelationship(relationshipId);
    }

    /**
     * Finds related content using graph traversal
     */
    findRelatedContent(contentId: string, maxResults: number = 10): GraphNode[] {
        return this.graph.findRelated(contentId, maxResults);
    }

    /**
     * Queries the graph with filters
     */
    queryGraph(options: GraphQueryOptions = {}): { nodes: GraphNode[]; edges: GraphEdge[] } {
        return this.graph.queryGraph(options);
    }

    /**
     * Gets graph statistics
     */
    getGraphStats(): GraphStats {
        return this.graph.getStats();
    }

    /**
     * Gets content cluster for a specific content item
     */
    getContentCluster(contentId: string): ContentCluster | null {
        return this.graph.getCluster(contentId);
    }

    /**
     * Gets all clusters
     */
    getAllClusters(): ContentCluster[] {
        return this.graph.getAllClusters();
    }

    /**
     * Updates the graph layout
     */
    updateLayout(iterations: number = 100): void {
        this.graph.updateLayout(iterations);
    }

    /**
     * Rebuilds the entire graph from stored content and relationships
     */
    async rebuildGraph(): Promise<GraphUpdateResult> {
        const startTime = Date.now();

        try {
            // Clear existing graph
            this.graph.clear();

            // Load all content
            const contentResult = await this.contentStore.list();
            if (!contentResult.success || !contentResult.data) {
                throw new Error('Failed to load content for graph rebuild');
            }

            const content = contentResult.data;
            let nodesAdded = 0;

            // Limit nodes if necessary
            const limitedContent = this.options.maxNodes
                ? content.slice(0, this.options.maxNodes)
                : content;

            // Add all content as nodes
            for (const item of limitedContent) {
                this.graph.addContent(item);
                nodesAdded++;
            }

            // Load all relationships
            const relationshipsResult = await this.relationshipStore.list();
            if (!relationshipsResult.success || !relationshipsResult.data) {
                throw new Error('Failed to load relationships for graph rebuild');
            }

            const relationships = relationshipsResult.data;
            let edgesAdded = 0;

            // Add all relationships as edges
            for (const relationship of relationships) {
                const edge = this.graph.addRelationship(relationship);
                if (edge) {
                    edgesAdded++;
                }
            }

            // Create clusters
            let clustersCreated = 0;
            if (this.options.enableClustering) {
                const clusters = this.graph.createClusters();
                clustersCreated = clusters.length;
            }

            // Update layout
            this.graph.updateLayout(200);

            return {
                success: true,
                nodesAdded,
                edgesAdded,
                nodesRemoved: 0,
                edgesRemoved: 0,
                clustersCreated,
                processingTime: Date.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                nodesAdded: 0,
                edgesAdded: 0,
                nodesRemoved: 0,
                edgesRemoved: 0,
                clustersCreated: 0,
                processingTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Adds relationships for a specific content item
     */
    private async addContentRelationships(contentId: string): Promise<void> {
        try {
            const result = await this.relationshipStore.findByContentId(contentId);
            if (result.success && result.data) {
                for (const relationship of result.data) {
                    this.graph.addRelationship(relationship);
                }
            }
        } catch (error) {
            console.error(`Failed to add relationships for content ${contentId}:`, error);
        }
    }

    /**
     * Updates clusters based on current graph state
     */
    private updateClusters(): void {
        try {
            this.graph.createClusters();
        } catch (error) {
            console.error('Failed to update clusters:', error);
        }
    }

    /**
     * Saves the graph to storage
     */
    async saveGraph(): Promise<boolean> {
        try {
            const graphData: GraphPersistenceData = {
                ...this.graph.exportGraph(),
                lastUpdated: new Date(),
                version: 1
            };

            // Save to localStorage or IndexedDB
            // For now, we'll use localStorage as a simple implementation
            localStorage.setItem('mindscribe-knowledge-graph', JSON.stringify(graphData));
            this.lastSaveTime = new Date();

            return true;
        } catch (error) {
            console.error('Failed to save knowledge graph:', error);
            return false;
        }
    }

    /**
     * Loads the graph from storage
     */
    async loadGraph(): Promise<boolean> {
        try {
            const savedData = localStorage.getItem('mindscribe-knowledge-graph');
            if (!savedData) {
                return false;
            }

            const graphData: GraphPersistenceData = JSON.parse(savedData);
            this.graph.importGraph(graphData);

            return true;
        } catch (error) {
            console.error('Failed to load knowledge graph:', error);
            return false;
        }
    }

    /**
     * Starts auto-save timer
     */
    private startAutoSave(): void {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
        }

        this.saveTimer = setInterval(
            () => this.saveGraph(),
            this.options.saveInterval
        );
    }

    /**
     * Starts layout update timer
     */
    private startLayoutUpdates(): void {
        if (this.layoutTimer) {
            clearInterval(this.layoutTimer);
        }

        this.layoutTimer = setInterval(
            () => this.updateLayout(50),
            this.options.layoutUpdateInterval
        );
    }

    /**
     * Stops all timers
     */
    private stopTimers(): void {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
            this.saveTimer = undefined;
        }

        if (this.layoutTimer) {
            clearInterval(this.layoutTimer);
            this.layoutTimer = undefined;
        }
    }

    /**
     * Gets the underlying knowledge graph instance
     */
    getGraph(): KnowledgeGraph {
        return this.graph;
    }

    /**
     * Gets the last save time
     */
    getLastSaveTime(): Date {
        return this.lastSaveTime;
    }

    /**
     * Forces a save of the graph
     */
    async forceSave(): Promise<boolean> {
        return await this.saveGraph();
    }

    /**
     * Clears the entire graph
     */
    clearGraph(): void {
        this.graph.clear();
    }

    /**
     * Destroys the manager and cleans up resources
     */
    destroy(): void {
        this.stopTimers();
        this.graph.clear();
        KnowledgeGraphManager.instance = null;
    }

    /**
     * Gets manager statistics
     */
    getManagerStats(): {
        graphStats: GraphStats;
        lastSaveTime: Date;
        autoSaveEnabled: boolean;
        maxNodes: number;
        clusteringEnabled: boolean;
    } {
        return {
            graphStats: this.getGraphStats(),
            lastSaveTime: this.lastSaveTime,
            autoSaveEnabled: this.options.autoSave || false,
            maxNodes: this.options.maxNodes || 1000,
            clusteringEnabled: this.options.enableClustering || false
        };
    }

    /**
     * Exports graph data for external use
     */
    exportGraphData(): GraphPersistenceData {
        return {
            ...this.graph.exportGraph(),
            lastUpdated: new Date(),
            version: 1
        };
    }

    /**
     * Imports graph data from external source
     */
    importGraphData(data: GraphPersistenceData): boolean {
        try {
            this.graph.importGraph(data);
            return true;
        } catch (error) {
            console.error('Failed to import graph data:', error);
            return false;
        }
    }
}