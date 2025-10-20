// Knowledge graph data structure for content relationships

import { StoredContent, ContentRelationship } from '../types/storage';

export interface GraphNode {
    id: string;
    contentId: string;
    title: string;
    category?: string;
    concepts: string[];
    tags: string[];
    position: { x: number; y: number };
    size: number; // Based on importance/access frequency
    color: string; // Based on category
    importance: number; // 0-1 scale
    accessCount: number;
    lastAccessed: Date;
    createdAt: Date;
}

export interface GraphEdge {
    id: string;
    sourceId: string;
    targetId: string;
    relationshipId: string;
    type: ContentRelationship['type'];
    weight: number; // Relationship strength
    confidence: number;
    createdAt: Date;
    lastUpdated: Date;
}

export interface ContentCluster {
    id: string;
    name: string;
    description?: string;
    nodeIds: string[];
    centroid: { x: number; y: number };
    radius: number;
    color: string;
    category?: string;
    concepts: string[];
    createdAt: Date;
    lastUpdated: Date;
}

export interface GraphTraversalOptions {
    maxDepth: number;
    minWeight: number;
    includeTypes: ContentRelationship['type'][];
    excludeTypes: ContentRelationship['type'][];
    followStrongConnections: boolean;
}

export interface GraphQueryOptions {
    nodeFilters?: {
        categories?: string[];
        concepts?: string[];
        tags?: string[];
        minImportance?: number;
        minAccessCount?: number;
        dateRange?: { start: Date; end: Date };
    };
    edgeFilters?: {
        types?: ContentRelationship['type'][];
        minWeight?: number;
        minConfidence?: number;
    };
    limit?: number;
    sortBy?: 'importance' | 'accessCount' | 'createdAt' | 'weight';
    sortDirection?: 'asc' | 'desc';
}

export interface GraphStats {
    totalNodes: number;
    totalEdges: number;
    totalClusters: number;
    averageConnections: number;
    mostConnectedNodes: GraphNode[];
    strongestConnections: GraphEdge[];
    clusterDistribution: Record<string, number>;
    categoryDistribution: Record<string, number>;
    conceptFrequency: Record<string, number>;
}

export interface GraphLayout {
    algorithm: 'force-directed' | 'hierarchical' | 'circular' | 'grid';
    parameters: Record<string, any>;
    bounds: { width: number; height: number };
    center: { x: number; y: number };
}

export class KnowledgeGraph {
    private nodes: Map<string, GraphNode> = new Map();
    private edges: Map<string, GraphEdge> = new Map();
    private clusters: Map<string, ContentCluster> = new Map();
    private nodeIndex: Map<string, Set<string>> = new Map(); // contentId -> nodeIds
    private edgeIndex: Map<string, Set<string>> = new Map(); // nodeId -> edgeIds
    private layout: GraphLayout;

    constructor() {
        this.layout = {
            algorithm: 'force-directed',
            parameters: {
                repulsion: 100,
                attraction: 0.1,
                damping: 0.9,
                iterations: 1000
            },
            bounds: { width: 1000, height: 1000 },
            center: { x: 500, y: 500 }
        };
    }

    /**
     * Adds content to the knowledge graph
     */
    addContent(content: StoredContent): GraphNode {
        const nodeId = `node-${content.id}`;

        const node: GraphNode = {
            id: nodeId,
            contentId: content.id,
            title: content.title,
            category: content.category,
            concepts: content.concepts || [],
            tags: content.tags || [],
            position: this.generateInitialPosition(),
            size: this.calculateNodeSize(content),
            color: this.getNodeColor(content.category),
            importance: content.importance || 0.5,
            accessCount: content.timesAccessed,
            lastAccessed: content.lastAccessed,
            createdAt: content.timestamp
        };

        this.nodes.set(nodeId, node);

        // Index by content ID
        if (!this.nodeIndex.has(content.id)) {
            this.nodeIndex.set(content.id, new Set());
        }
        this.nodeIndex.get(content.id)!.add(nodeId);

        // Initialize edge index
        this.edgeIndex.set(nodeId, new Set());

        return node;
    }

    /**
     * Adds a relationship as an edge in the graph
     */
    addRelationship(relationship: ContentRelationship): GraphEdge | null {
        const sourceNodeId = this.getNodeIdByContentId(relationship.sourceId);
        const targetNodeId = this.getNodeIdByContentId(relationship.targetId);

        if (!sourceNodeId || !targetNodeId) {
            console.warn(`Cannot create edge: missing nodes for relationship ${relationship.id}`);
            return null;
        }

        const edgeId = `edge-${relationship.id}`;

        const edge: GraphEdge = {
            id: edgeId,
            sourceId: sourceNodeId,
            targetId: targetNodeId,
            relationshipId: relationship.id,
            type: relationship.type,
            weight: relationship.strength,
            confidence: relationship.confidence,
            createdAt: relationship.createdAt,
            lastUpdated: relationship.lastUpdated
        };

        this.edges.set(edgeId, edge);

        // Update edge indexes
        this.edgeIndex.get(sourceNodeId)!.add(edgeId);
        this.edgeIndex.get(targetNodeId)!.add(edgeId);

        return edge;
    }

    /**
     * Removes content and its associated edges from the graph
     */
    removeContent(contentId: string): boolean {
        const nodeIds = this.nodeIndex.get(contentId);
        if (!nodeIds || nodeIds.size === 0) {
            return false;
        }

        for (const nodeId of nodeIds) {
            // Remove all edges connected to this node
            const edgeIds = this.edgeIndex.get(nodeId) || new Set();
            for (const edgeId of edgeIds) {
                this.removeEdge(edgeId);
            }

            // Remove the node
            this.nodes.delete(nodeId);
            this.edgeIndex.delete(nodeId);
        }

        // Remove from content index
        this.nodeIndex.delete(contentId);

        return true;
    }

    /**
     * Removes a relationship edge from the graph
     */
    removeRelationship(relationshipId: string): boolean {
        const edgeId = `edge-${relationshipId}`;
        return this.removeEdge(edgeId);
    }

    /**
     * Removes an edge by ID
     */
    private removeEdge(edgeId: string): boolean {
        const edge = this.edges.get(edgeId);
        if (!edge) {
            return false;
        }

        // Remove from edge indexes
        this.edgeIndex.get(edge.sourceId)?.delete(edgeId);
        this.edgeIndex.get(edge.targetId)?.delete(edgeId);

        // Remove the edge
        this.edges.delete(edgeId);

        return true;
    }

    /**
     * Finds related content using graph traversal
     */
    findRelated(
        contentId: string,
        maxResults: number = 10,
        options: Partial<GraphTraversalOptions> = {}
    ): GraphNode[] {
        const nodeId = this.getNodeIdByContentId(contentId);
        if (!nodeId) {
            return [];
        }

        const traversalOptions: GraphTraversalOptions = {
            maxDepth: 2,
            minWeight: 0.3,
            includeTypes: ['similar', 'builds_on', 'related', 'references'],
            excludeTypes: [],
            followStrongConnections: true,
            ...options
        };

        const visited = new Set<string>();
        const results: { node: GraphNode; distance: number; weight: number }[] = [];

        this.traverseGraph(nodeId, 0, traversalOptions, visited, results);

        // Sort by weight and distance, then limit results
        return results
            .sort((a, b) => {
                if (a.distance !== b.distance) {
                    return a.distance - b.distance; // Closer nodes first
                }
                return b.weight - a.weight; // Higher weight first
            })
            .slice(0, maxResults)
            .map(r => r.node);
    }

    /**
     * Recursive graph traversal
     */
    private traverseGraph(
        nodeId: string,
        depth: number,
        options: GraphTraversalOptions,
        visited: Set<string>,
        results: { node: GraphNode; distance: number; weight: number }[]
    ): void {
        if (depth >= options.maxDepth || visited.has(nodeId)) {
            return;
        }

        visited.add(nodeId);
        const node = this.nodes.get(nodeId);
        if (!node) {
            return;
        }

        // Add current node to results (except for the starting node)
        if (depth > 0) {
            const maxWeight = Math.max(...Array.from(this.edgeIndex.get(nodeId) || [])
                .map(edgeId => this.edges.get(edgeId)?.weight || 0));

            results.push({
                node,
                distance: depth,
                weight: maxWeight
            });
        }

        // Traverse connected nodes
        const edgeIds = this.edgeIndex.get(nodeId) || new Set();
        for (const edgeId of edgeIds) {
            const edge = this.edges.get(edgeId);
            if (!edge) continue;

            // Apply filters
            if (edge.weight < options.minWeight) continue;
            if (options.excludeTypes.includes(edge.type)) continue;
            if (options.includeTypes.length > 0 && !options.includeTypes.includes(edge.type)) continue;

            // Get the other node
            const otherNodeId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;

            // Continue traversal
            this.traverseGraph(otherNodeId, depth + 1, options, visited, results);
        }
    }

    /**
     * Gets content cluster for a specific content item
     */
    getCluster(contentId: string): ContentCluster | null {
        const nodeId = this.getNodeIdByContentId(contentId);
        if (!nodeId) {
            return null;
        }

        // Find cluster containing this node
        for (const cluster of this.clusters.values()) {
            if (cluster.nodeIds.includes(nodeId)) {
                return cluster;
            }
        }

        return null;
    }

    /**
     * Creates content clusters using community detection algorithms
     */
    createClusters(): ContentCluster[] {
        // Simple clustering based on shared concepts and strong connections
        const clusters: ContentCluster[] = [];
        const clusteredNodes = new Set<string>();

        // Group nodes by dominant concepts
        const conceptGroups = new Map<string, Set<string>>();

        for (const node of this.nodes.values()) {
            if (clusteredNodes.has(node.id)) continue;

            // Find dominant concept (most frequent)
            const conceptCounts = new Map<string, number>();
            for (const concept of node.concepts) {
                conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
            }

            const dominantConcept = Array.from(conceptCounts.entries())
                .sort((a, b) => b[1] - a[1])[0]?.[0];

            if (dominantConcept) {
                if (!conceptGroups.has(dominantConcept)) {
                    conceptGroups.set(dominantConcept, new Set());
                }
                conceptGroups.get(dominantConcept)!.add(node.id);
            }
        }

        // Create clusters from concept groups
        let clusterIndex = 0;
        for (const [concept, nodeIds] of conceptGroups.entries()) {
            if (nodeIds.size < 2) continue; // Skip single-node clusters

            const clusterId = `cluster-${clusterIndex++}`;
            const clusterNodes = Array.from(nodeIds).map(id => this.nodes.get(id)!);

            const cluster: ContentCluster = {
                id: clusterId,
                name: `${concept.charAt(0).toUpperCase() + concept.slice(1)} Cluster`,
                description: `Content related to ${concept}`,
                nodeIds: Array.from(nodeIds),
                centroid: this.calculateCentroid(clusterNodes),
                radius: this.calculateClusterRadius(clusterNodes),
                color: this.getClusterColor(concept),
                category: this.inferClusterCategory(clusterNodes),
                concepts: [concept],
                createdAt: new Date(),
                lastUpdated: new Date()
            };

            clusters.push(cluster);
            this.clusters.set(clusterId, cluster);

            // Mark nodes as clustered
            for (const nodeId of nodeIds) {
                clusteredNodes.add(nodeId);
            }
        }

        return clusters;
    }

    /**
     * Queries the graph with filters
     */
    queryGraph(options: GraphQueryOptions = {}): { nodes: GraphNode[]; edges: GraphEdge[] } {
        let nodes = Array.from(this.nodes.values());
        let edges = Array.from(this.edges.values());

        // Apply node filters
        if (options.nodeFilters) {
            const filters = options.nodeFilters;

            if (filters.categories) {
                nodes = nodes.filter(n => n.category && filters.categories!.includes(n.category));
            }

            if (filters.concepts) {
                nodes = nodes.filter(n =>
                    filters.concepts!.some(concept => n.concepts.includes(concept))
                );
            }

            if (filters.tags) {
                nodes = nodes.filter(n =>
                    filters.tags!.some(tag => n.tags.includes(tag))
                );
            }

            if (filters.minImportance !== undefined) {
                nodes = nodes.filter(n => n.importance >= filters.minImportance!);
            }

            if (filters.minAccessCount !== undefined) {
                nodes = nodes.filter(n => n.accessCount >= filters.minAccessCount!);
            }

            if (filters.dateRange) {
                nodes = nodes.filter(n =>
                    n.createdAt >= filters.dateRange!.start &&
                    n.createdAt <= filters.dateRange!.end
                );
            }
        }

        // Apply edge filters
        if (options.edgeFilters) {
            const filters = options.edgeFilters;

            if (filters.types) {
                edges = edges.filter(e => filters.types!.includes(e.type));
            }

            if (filters.minWeight !== undefined) {
                edges = edges.filter(e => e.weight >= filters.minWeight!);
            }

            if (filters.minConfidence !== undefined) {
                edges = edges.filter(e => e.confidence >= filters.minConfidence!);
            }
        }

        // Filter edges to only include those between remaining nodes
        const nodeIds = new Set(nodes.map(n => n.id));
        edges = edges.filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));

        // Apply sorting
        if (options.sortBy) {
            nodes.sort((a, b) => {
                const aVal = (a as any)[options.sortBy!];
                const bVal = (b as any)[options.sortBy!];

                if (options.sortDirection === 'desc') {
                    return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
                } else {
                    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                }
            });
        }

        // Apply limit
        if (options.limit) {
            nodes = nodes.slice(0, options.limit);
            // Re-filter edges for limited nodes
            const limitedNodeIds = new Set(nodes.map(n => n.id));
            edges = edges.filter(e => limitedNodeIds.has(e.sourceId) && limitedNodeIds.has(e.targetId));
        }

        return { nodes, edges };
    }

    /**
     * Gets graph statistics
     */
    getStats(): GraphStats {
        const nodes = Array.from(this.nodes.values());
        const edges = Array.from(this.edges.values());

        // Calculate average connections
        const connectionCounts = new Map<string, number>();
        for (const edge of edges) {
            connectionCounts.set(edge.sourceId, (connectionCounts.get(edge.sourceId) || 0) + 1);
            connectionCounts.set(edge.targetId, (connectionCounts.get(edge.targetId) || 0) + 1);
        }

        const averageConnections = connectionCounts.size > 0
            ? Array.from(connectionCounts.values()).reduce((a, b) => a + b, 0) / connectionCounts.size
            : 0;

        // Most connected nodes
        const mostConnectedNodes = nodes
            .map(node => ({ node, connections: connectionCounts.get(node.id) || 0 }))
            .sort((a, b) => b.connections - a.connections)
            .slice(0, 10)
            .map(item => item.node);

        // Strongest connections
        const strongestConnections = edges
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 10);

        // Distribution calculations
        const clusterDistribution: Record<string, number> = {};
        for (const cluster of this.clusters.values()) {
            clusterDistribution[cluster.name] = cluster.nodeIds.length;
        }

        const categoryDistribution: Record<string, number> = {};
        for (const node of nodes) {
            if (node.category) {
                categoryDistribution[node.category] = (categoryDistribution[node.category] || 0) + 1;
            }
        }

        const conceptFrequency: Record<string, number> = {};
        for (const node of nodes) {
            for (const concept of node.concepts) {
                conceptFrequency[concept] = (conceptFrequency[concept] || 0) + 1;
            }
        }

        return {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            totalClusters: this.clusters.size,
            averageConnections,
            mostConnectedNodes,
            strongestConnections,
            clusterDistribution,
            categoryDistribution,
            conceptFrequency
        };
    }

    /**
     * Updates graph layout using force-directed algorithm
     */
    updateLayout(iterations: number = 100): void {
        if (this.layout.algorithm !== 'force-directed') {
            return;
        }

        const nodes = Array.from(this.nodes.values());
        const edges = Array.from(this.edges.values());

        const { repulsion, attraction, damping } = this.layout.parameters;

        for (let i = 0; i < iterations; i++) {
            // Calculate forces
            const forces = new Map<string, { x: number; y: number }>();

            // Initialize forces
            for (const node of nodes) {
                forces.set(node.id, { x: 0, y: 0 });
            }

            // Repulsion forces (nodes push each other away)
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const node1 = nodes[i];
                    const node2 = nodes[j];

                    const dx = node2.position.x - node1.position.x;
                    const dy = node2.position.y - node1.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                    const force = repulsion / (distance * distance);
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;

                    const force1 = forces.get(node1.id)!;
                    const force2 = forces.get(node2.id)!;

                    force1.x -= fx;
                    force1.y -= fy;
                    force2.x += fx;
                    force2.y += fy;
                }
            }

            // Attraction forces (connected nodes pull each other)
            for (const edge of edges) {
                const node1 = this.nodes.get(edge.sourceId);
                const node2 = this.nodes.get(edge.targetId);

                if (!node1 || !node2) continue;

                const dx = node2.position.x - node1.position.x;
                const dy = node2.position.y - node1.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;

                const force = attraction * distance * edge.weight;
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;

                const force1 = forces.get(node1.id)!;
                const force2 = forces.get(node2.id)!;

                force1.x += fx;
                force1.y += fy;
                force2.x -= fx;
                force2.y -= fy;
            }

            // Apply forces with damping
            for (const node of nodes) {
                const force = forces.get(node.id)!;
                node.position.x += force.x * damping;
                node.position.y += force.y * damping;

                // Keep nodes within bounds
                node.position.x = Math.max(0, Math.min(this.layout.bounds.width, node.position.x));
                node.position.y = Math.max(0, Math.min(this.layout.bounds.height, node.position.y));
            }
        }
    }

    /**
     * Exports graph data for persistence
     */
    exportGraph(): {
        nodes: GraphNode[];
        edges: GraphEdge[];
        clusters: ContentCluster[];
        layout: GraphLayout;
    } {
        return {
            nodes: Array.from(this.nodes.values()),
            edges: Array.from(this.edges.values()),
            clusters: Array.from(this.clusters.values()),
            layout: this.layout
        };
    }

    /**
     * Imports graph data from persistence
     */
    importGraph(data: {
        nodes: GraphNode[];
        edges: GraphEdge[];
        clusters: ContentCluster[];
        layout: GraphLayout;
    }): void {
        // Clear existing data
        this.nodes.clear();
        this.edges.clear();
        this.clusters.clear();
        this.nodeIndex.clear();
        this.edgeIndex.clear();

        // Import nodes
        for (const node of data.nodes) {
            this.nodes.set(node.id, node);

            // Rebuild content index
            if (!this.nodeIndex.has(node.contentId)) {
                this.nodeIndex.set(node.contentId, new Set());
            }
            this.nodeIndex.get(node.contentId)!.add(node.id);

            // Initialize edge index
            this.edgeIndex.set(node.id, new Set());
        }

        // Import edges
        for (const edge of data.edges) {
            this.edges.set(edge.id, edge);

            // Rebuild edge index
            this.edgeIndex.get(edge.sourceId)?.add(edge.id);
            this.edgeIndex.get(edge.targetId)?.add(edge.id);
        }

        // Import clusters
        for (const cluster of data.clusters) {
            this.clusters.set(cluster.id, cluster);
        }

        // Import layout
        this.layout = data.layout;
    }

    /**
     * Clears all graph data
     */
    clear(): void {
        this.nodes.clear();
        this.edges.clear();
        this.clusters.clear();
        this.nodeIndex.clear();
        this.edgeIndex.clear();
    }

    // Helper methods

    private getNodeIdByContentId(contentId: string): string | null {
        const nodeIds = this.nodeIndex.get(contentId);
        return nodeIds && nodeIds.size > 0 ? Array.from(nodeIds)[0] : null;
    }

    private generateInitialPosition(): { x: number; y: number } {
        return {
            x: Math.random() * this.layout.bounds.width,
            y: Math.random() * this.layout.bounds.height
        };
    }

    private calculateNodeSize(content: StoredContent): number {
        // Base size on importance and access count
        const importance = content.importance || 0.5;
        const accessWeight = Math.min(content.timesAccessed / 10, 1); // Normalize to 0-1
        return 10 + (importance * 20) + (accessWeight * 10); // Size between 10-40
    }

    private getNodeColor(category?: string): string {
        const colors: Record<string, string> = {
            'tutorial': '#4CAF50',
            'article': '#2196F3',
            'documentation': '#FF9800',
            'video': '#E91E63',
            'research': '#9C27B0',
            'news': '#F44336',
            'reference': '#607D8B',
            'tool': '#795548',
            'design': '#E91E63',
            'lifestyle': '#8BC34A'
        };
        return colors[category || 'other'] || '#9E9E9E';
    }

    private calculateCentroid(nodes: GraphNode[]): { x: number; y: number } {
        if (nodes.length === 0) {
            return { x: 0, y: 0 };
        }

        const sum = nodes.reduce(
            (acc, node) => ({
                x: acc.x + node.position.x,
                y: acc.y + node.position.y
            }),
            { x: 0, y: 0 }
        );

        return {
            x: sum.x / nodes.length,
            y: sum.y / nodes.length
        };
    }

    private calculateClusterRadius(nodes: GraphNode[]): number {
        if (nodes.length === 0) {
            return 0;
        }

        const centroid = this.calculateCentroid(nodes);
        const maxDistance = Math.max(
            ...nodes.map(node => {
                const dx = node.position.x - centroid.x;
                const dy = node.position.y - centroid.y;
                return Math.sqrt(dx * dx + dy * dy);
            })
        );

        return maxDistance + 50; // Add padding
    }

    private getClusterColor(concept: string): string {
        // Generate consistent color based on concept hash
        let hash = 0;
        for (let i = 0; i < concept.length; i++) {
            hash = concept.charCodeAt(i) + ((hash << 5) - hash);
        }

        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 60%)`;
    }

    private inferClusterCategory(nodes: GraphNode[]): string | undefined {
        const categoryCounts = new Map<string, number>();

        for (const node of nodes) {
            if (node.category) {
                categoryCounts.set(node.category, (categoryCounts.get(node.category) || 0) + 1);
            }
        }

        if (categoryCounts.size === 0) {
            return undefined;
        }

        // Return most common category
        return Array.from(categoryCounts.entries())
            .sort((a, b) => b[1] - a[1])[0][0];
    }

    // Getters for external access
    getAllNodes(): GraphNode[] {
        return Array.from(this.nodes.values());
    }

    getAllEdges(): GraphEdge[] {
        return Array.from(this.edges.values());
    }

    getAllClusters(): ContentCluster[] {
        return Array.from(this.clusters.values());
    }

    getNode(nodeId: string): GraphNode | undefined {
        return this.nodes.get(nodeId);
    }

    getEdge(edgeId: string): GraphEdge | undefined {
        return this.edges.get(edgeId);
    }

    getClusterById(clusterId: string): ContentCluster | undefined {
        return this.clusters.get(clusterId);
    }

    getLayout(): GraphLayout {
        return { ...this.layout };
    }

    setLayout(layout: Partial<GraphLayout>): void {
        this.layout = { ...this.layout, ...layout };
    }
}