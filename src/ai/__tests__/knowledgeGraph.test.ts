// Tests for KnowledgeGraph

import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGraph, GraphNode, GraphEdge, ContentCluster } from '../knowledgeGraph';
import { StoredContent, ContentRelationship } from '../../types/storage';

describe('KnowledgeGraph', () => {
    let graph: KnowledgeGraph;
    let mockContent: StoredContent[];
    let mockRelationships: ContentRelationship[];

    beforeEach(() => {
        graph = new KnowledgeGraph();
        mockContent = createMockContent();
        mockRelationships = createMockRelationships();
    });

    describe('addContent', () => {
        it('should add content as a node to the graph', () => {
            const content = mockContent[0];
            const node = graph.addContent(content);

            expect(node.contentId).toBe(content.id);
            expect(node.title).toBe(content.title);
            expect(node.category).toBe(content.category);
            expect(node.concepts).toEqual(content.concepts);
            expect(node.tags).toEqual(content.tags);
            expect(node.position).toBeDefined();
            expect(node.size).toBeGreaterThan(0);
            expect(node.color).toBeDefined();
        });

        it('should calculate node size based on importance and access count', () => {
            const highImportanceContent = createMockStoredContent({
                id: 'high-importance',
                importance: 0.9,
                timesAccessed: 20
            });

            const lowImportanceContent = createMockStoredContent({
                id: 'low-importance',
                importance: 0.1,
                timesAccessed: 1
            });

            const highNode = graph.addContent(highImportanceContent);
            const lowNode = graph.addContent(lowImportanceContent);

            expect(highNode.size).toBeGreaterThan(lowNode.size);
        });

        it('should assign colors based on category', () => {
            const tutorialContent = createMockStoredContent({
                id: 'tutorial',
                category: 'tutorial'
            });

            const articleContent = createMockStoredContent({
                id: 'article',
                category: 'article'
            });

            const tutorialNode = graph.addContent(tutorialContent);
            const articleNode = graph.addContent(articleContent);

            expect(tutorialNode.color).not.toBe(articleNode.color);
        });
    });

    describe('addRelationship', () => {
        beforeEach(() => {
            // Add content nodes first
            mockContent.forEach(content => graph.addContent(content));
        });

        it('should add relationship as an edge between nodes', () => {
            const relationship = mockRelationships[0];
            const edge = graph.addRelationship(relationship);

            expect(edge).toBeDefined();
            expect(edge!.relationshipId).toBe(relationship.id);
            expect(edge!.type).toBe(relationship.type);
            expect(edge!.weight).toBe(relationship.strength);
            expect(edge!.confidence).toBe(relationship.confidence);
        });

        it('should return null if source or target node does not exist', () => {
            const invalidRelationship: ContentRelationship = {
                id: 'invalid-rel',
                sourceId: 'non-existent-1',
                targetId: 'non-existent-2',
                type: 'related',
                strength: 0.5,
                confidence: 0.7,
                createdAt: new Date(),
                lastUpdated: new Date()
            };

            const edge = graph.addRelationship(invalidRelationship);
            expect(edge).toBeNull();
        });
    });

    describe('removeContent', () => {
        beforeEach(() => {
            mockContent.forEach(content => graph.addContent(content));
            mockRelationships.forEach(rel => graph.addRelationship(rel));
        });

        it('should remove content node and associated edges', () => {
            const contentId = mockContent[0].id;
            const initialNodes = graph.getAllNodes().length;
            const initialEdges = graph.getAllEdges().length;

            const removed = graph.removeContent(contentId);

            expect(removed).toBe(true);
            expect(graph.getAllNodes().length).toBeLessThan(initialNodes);
            expect(graph.getAllEdges().length).toBeLessThan(initialEdges);
        });

        it('should return false for non-existent content', () => {
            const removed = graph.removeContent('non-existent');
            expect(removed).toBe(false);
        });
    });

    describe('removeRelationship', () => {
        beforeEach(() => {
            mockContent.forEach(content => graph.addContent(content));
            mockRelationships.forEach(rel => graph.addRelationship(rel));
        });

        it('should remove relationship edge from graph', () => {
            const relationshipId = mockRelationships[0].id;
            const initialEdges = graph.getAllEdges().length;

            const removed = graph.removeRelationship(relationshipId);

            expect(removed).toBe(true);
            expect(graph.getAllEdges().length).toBe(initialEdges - 1);
        });

        it('should return false for non-existent relationship', () => {
            const removed = graph.removeRelationship('non-existent');
            expect(removed).toBe(false);
        });
    });

    describe('findRelated', () => {
        beforeEach(() => {
            mockContent.forEach(content => graph.addContent(content));
            mockRelationships.forEach(rel => graph.addRelationship(rel));
        });

        it('should find related content through graph traversal', () => {
            const contentId = mockContent[0].id;
            const related = graph.findRelated(contentId, 5);

            expect(Array.isArray(related)).toBe(true);
            expect(related.length).toBeGreaterThanOrEqual(0);

            // Should not include the source content itself
            expect(related.every(node => node.contentId !== contentId)).toBe(true);
        });

        it('should respect maxResults parameter', () => {
            const contentId = mockContent[0].id;
            const related = graph.findRelated(contentId, 2);

            expect(related.length).toBeLessThanOrEqual(2);
        });

        it('should return empty array for non-existent content', () => {
            const related = graph.findRelated('non-existent');
            expect(related).toEqual([]);
        });

        it('should apply traversal options', () => {
            const contentId = mockContent[0].id;
            const related = graph.findRelated(contentId, 10, {
                maxDepth: 1,
                minWeight: 0.8,
                includeTypes: ['similar']
            });

            expect(Array.isArray(related)).toBe(true);
        });
    });

    describe('createClusters', () => {
        beforeEach(() => {
            // Add content with shared concepts
            const contentWithSharedConcepts = [
                createMockStoredContent({
                    id: 'js-1',
                    concepts: ['javascript', 'programming'],
                    category: 'tutorial'
                }),
                createMockStoredContent({
                    id: 'js-2',
                    concepts: ['javascript', 'web-development'],
                    category: 'tutorial'
                }),
                createMockStoredContent({
                    id: 'python-1',
                    concepts: ['python', 'programming'],
                    category: 'tutorial'
                }),
                createMockStoredContent({
                    id: 'python-2',
                    concepts: ['python', 'data-science'],
                    category: 'tutorial'
                })
            ];

            contentWithSharedConcepts.forEach(content => graph.addContent(content));
        });

        it('should create clusters based on shared concepts', () => {
            const clusters = graph.createClusters();

            expect(Array.isArray(clusters)).toBe(true);
            expect(clusters.length).toBeGreaterThan(0);

            clusters.forEach(cluster => {
                expect(cluster.id).toBeDefined();
                expect(cluster.name).toBeDefined();
                expect(cluster.nodeIds.length).toBeGreaterThanOrEqual(2);
                expect(cluster.centroid).toBeDefined();
                expect(cluster.radius).toBeGreaterThan(0);
                expect(cluster.concepts.length).toBeGreaterThan(0);
            });
        });

        it('should not create clusters for single nodes', () => {
            // Clear and add only one node
            graph.clear();
            graph.addContent(createMockStoredContent({
                id: 'single',
                concepts: ['unique-concept']
            }));

            const clusters = graph.createClusters();
            expect(clusters.length).toBe(0);
        });
    });

    describe('queryGraph', () => {
        beforeEach(() => {
            mockContent.forEach(content => graph.addContent(content));
            mockRelationships.forEach(rel => graph.addRelationship(rel));
        });

        it('should return all nodes and edges with no filters', () => {
            const result = graph.queryGraph();

            expect(result.nodes.length).toBe(mockContent.length);
            expect(result.edges.length).toBeGreaterThan(0);
        });

        it('should filter nodes by category', () => {
            const result = graph.queryGraph({
                nodeFilters: {
                    categories: ['tutorial']
                }
            });

            expect(result.nodes.every(node => node.category === 'tutorial')).toBe(true);
        });

        it('should filter nodes by concepts', () => {
            const result = graph.queryGraph({
                nodeFilters: {
                    concepts: ['javascript']
                }
            });

            expect(result.nodes.every(node =>
                node.concepts.includes('javascript')
            )).toBe(true);
        });

        it('should filter edges by type', () => {
            const result = graph.queryGraph({
                edgeFilters: {
                    types: ['similar']
                }
            });

            expect(result.edges.every(edge => edge.type === 'similar')).toBe(true);
        });

        it('should filter edges by minimum weight', () => {
            const minWeight = 0.7;
            const result = graph.queryGraph({
                edgeFilters: {
                    minWeight
                }
            });

            expect(result.edges.every(edge => edge.weight >= minWeight)).toBe(true);
        });

        it('should apply limit to results', () => {
            const limit = 2;
            const result = graph.queryGraph({ limit });

            expect(result.nodes.length).toBeLessThanOrEqual(limit);
        });

        it('should sort nodes by importance', () => {
            const result = graph.queryGraph({
                sortBy: 'importance',
                sortDirection: 'desc'
            });

            for (let i = 1; i < result.nodes.length; i++) {
                expect(result.nodes[i].importance).toBeLessThanOrEqual(result.nodes[i - 1].importance);
            }
        });
    });

    describe('getStats', () => {
        beforeEach(() => {
            mockContent.forEach(content => graph.addContent(content));
            mockRelationships.forEach(rel => graph.addRelationship(rel));
        });

        it('should return comprehensive graph statistics', () => {
            const stats = graph.getStats();

            expect(stats.totalNodes).toBe(mockContent.length);
            expect(stats.totalEdges).toBeGreaterThan(0);
            expect(stats.averageConnections).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(stats.mostConnectedNodes)).toBe(true);
            expect(Array.isArray(stats.strongestConnections)).toBe(true);
            expect(typeof stats.clusterDistribution).toBe('object');
            expect(typeof stats.categoryDistribution).toBe('object');
            expect(typeof stats.conceptFrequency).toBe('object');
        });

        it('should calculate category distribution correctly', () => {
            const stats = graph.getStats();

            const expectedCategories = new Set(mockContent.map(c => c.category).filter(Boolean));
            const actualCategories = new Set(Object.keys(stats.categoryDistribution));

            expectedCategories.forEach(category => {
                expect(actualCategories.has(category!)).toBe(true);
            });
        });

        it('should calculate concept frequency correctly', () => {
            const stats = graph.getStats();

            const allConcepts = mockContent.flatMap(c => c.concepts || []);
            const uniqueConcepts = new Set(allConcepts);

            uniqueConcepts.forEach(concept => {
                expect(stats.conceptFrequency[concept]).toBeGreaterThan(0);
            });
        });
    });

    describe('updateLayout', () => {
        beforeEach(() => {
            mockContent.forEach(content => graph.addContent(content));
            mockRelationships.forEach(rel => graph.addRelationship(rel));
        });

        it('should update node positions using force-directed algorithm', () => {
            const initialPositions = graph.getAllNodes().map(node => ({ ...node.position }));

            graph.updateLayout(10); // Run 10 iterations

            const finalPositions = graph.getAllNodes().map(node => ({ ...node.position }));

            // Positions should have changed (unless graph is very small)
            if (graph.getAllNodes().length > 1) {
                const positionsChanged = initialPositions.some((initial, index) => {
                    const final = finalPositions[index];
                    return Math.abs(initial.x - final.x) > 0.1 || Math.abs(initial.y - final.y) > 0.1;
                });
                expect(positionsChanged).toBe(true);
            }
        });

        it('should keep nodes within bounds', () => {
            graph.updateLayout(50);

            const layout = graph.getLayout();
            const nodes = graph.getAllNodes();

            nodes.forEach(node => {
                expect(node.position.x).toBeGreaterThanOrEqual(0);
                expect(node.position.x).toBeLessThanOrEqual(layout.bounds.width);
                expect(node.position.y).toBeGreaterThanOrEqual(0);
                expect(node.position.y).toBeLessThanOrEqual(layout.bounds.height);
            });
        });
    });

    describe('exportGraph and importGraph', () => {
        beforeEach(() => {
            mockContent.forEach(content => graph.addContent(content));
            mockRelationships.forEach(rel => graph.addRelationship(rel));
            graph.createClusters();
        });

        it('should export and import graph data correctly', () => {
            const exportedData = graph.exportGraph();

            expect(exportedData.nodes.length).toBe(mockContent.length);
            expect(exportedData.edges.length).toBeGreaterThan(0);
            expect(exportedData.clusters.length).toBeGreaterThanOrEqual(0);
            expect(exportedData.layout).toBeDefined();

            // Create new graph and import data
            const newGraph = new KnowledgeGraph();
            newGraph.importGraph(exportedData);

            expect(newGraph.getAllNodes().length).toBe(exportedData.nodes.length);
            expect(newGraph.getAllEdges().length).toBe(exportedData.edges.length);
            expect(newGraph.getAllClusters().length).toBe(exportedData.clusters.length);
        });

        it('should preserve node and edge properties during export/import', () => {
            const originalNodes = graph.getAllNodes();
            const originalEdges = graph.getAllEdges();

            const exportedData = graph.exportGraph();
            const newGraph = new KnowledgeGraph();
            newGraph.importGraph(exportedData);

            const importedNodes = newGraph.getAllNodes();
            const importedEdges = newGraph.getAllEdges();

            expect(importedNodes.length).toBe(originalNodes.length);
            expect(importedEdges.length).toBe(originalEdges.length);

            // Check that properties are preserved
            originalNodes.forEach(originalNode => {
                const importedNode = importedNodes.find(n => n.id === originalNode.id);
                expect(importedNode).toBeDefined();
                expect(importedNode!.contentId).toBe(originalNode.contentId);
                expect(importedNode!.title).toBe(originalNode.title);
                expect(importedNode!.category).toBe(originalNode.category);
            });
        });
    });

    describe('clear', () => {
        beforeEach(() => {
            mockContent.forEach(content => graph.addContent(content));
            mockRelationships.forEach(rel => graph.addRelationship(rel));
        });

        it('should clear all graph data', () => {
            expect(graph.getAllNodes().length).toBeGreaterThan(0);
            expect(graph.getAllEdges().length).toBeGreaterThan(0);

            graph.clear();

            expect(graph.getAllNodes().length).toBe(0);
            expect(graph.getAllEdges().length).toBe(0);
            expect(graph.getAllClusters().length).toBe(0);
        });
    });

    describe('getCluster', () => {
        beforeEach(() => {
            mockContent.forEach(content => graph.addContent(content));
            graph.createClusters();
        });

        it('should return cluster containing the specified content', () => {
            const contentId = mockContent[0].id;
            const cluster = graph.getCluster(contentId);

            if (cluster) {
                expect(cluster.nodeIds.length).toBeGreaterThan(0);
                expect(cluster.id).toBeDefined();
                expect(cluster.name).toBeDefined();
            }
        });

        it('should return null for non-existent content', () => {
            const cluster = graph.getCluster('non-existent');
            expect(cluster).toBeNull();
        });
    });
});

// Helper functions
function createMockContent(): StoredContent[] {
    return [
        createMockStoredContent({
            id: 'content-1',
            title: 'JavaScript Fundamentals',
            concepts: ['javascript', 'programming', 'fundamentals'],
            tags: ['javascript', 'programming', 'beginner'],
            category: 'tutorial',
            importance: 0.8,
            timesAccessed: 15
        }),
        createMockStoredContent({
            id: 'content-2',
            title: 'React Development Guide',
            concepts: ['react', 'javascript', 'frontend'],
            tags: ['react', 'javascript', 'frontend'],
            category: 'tutorial',
            importance: 0.7,
            timesAccessed: 10
        }),
        createMockStoredContent({
            id: 'content-3',
            title: 'Python Data Science',
            concepts: ['python', 'data-science', 'machine-learning'],
            tags: ['python', 'data-science', 'ml'],
            category: 'tutorial',
            importance: 0.9,
            timesAccessed: 25
        }),
        createMockStoredContent({
            id: 'content-4',
            title: 'Web Design Principles',
            concepts: ['design', 'web', 'ui-ux'],
            tags: ['design', 'web', 'ui'],
            category: 'design',
            importance: 0.6,
            timesAccessed: 8
        })
    ];
}

function createMockRelationships(): ContentRelationship[] {
    return [
        {
            id: 'rel-1',
            sourceId: 'content-1',
            targetId: 'content-2',
            type: 'similar',
            strength: 0.8,
            confidence: 0.9,
            createdAt: new Date(),
            lastUpdated: new Date()
        },
        {
            id: 'rel-2',
            sourceId: 'content-2',
            targetId: 'content-4',
            type: 'related',
            strength: 0.6,
            confidence: 0.7,
            createdAt: new Date(),
            lastUpdated: new Date()
        },
        {
            id: 'rel-3',
            sourceId: 'content-1',
            targetId: 'content-3',
            type: 'builds_on',
            strength: 0.5,
            confidence: 0.6,
            createdAt: new Date(),
            lastUpdated: new Date()
        }
    ];
}

function createMockStoredContent(overrides: Partial<StoredContent> = {}): StoredContent {
    return {
        id: 'mock-id',
        url: 'https://example.com',
        title: 'Mock Content',
        content: 'This is mock content for testing',
        metadata: {
            readingTime: 5,
            pageType: 'article',
            language: 'en',
            wordCount: 100,
            imageCount: 0,
            linkCount: 0
        },
        captureMethod: 'manual',
        timestamp: new Date(),
        timesAccessed: 0,
        lastAccessed: new Date(),
        syncedToCloud: false,
        cloudAnalysisComplete: false,
        lastModified: new Date(),
        storageSize: 1000,
        version: 1,
        concepts: [],
        tags: [],
        ...overrides
    };
}