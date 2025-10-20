// Tests for RelationshipManager

import { RelationshipManager, RelationshipManagerOptions } from '../relationshipManager';
import { StoredContent, ContentRelationship } from '../../types/storage';

describe('RelationshipManager', () => {
    let manager: RelationshipManager;
    let mockContent: StoredContent[];

    beforeEach(() => {
        const options: Partial<RelationshipManagerOptions> = {
            maxRelationshipsPerContent: 5,
            autoUpdateRelationships: true
        };
        manager = new RelationshipManager(options);
        mockContent = createMockContent();
    });

    describe('processNewContent', () => {
        it('should process new content and create relationships', async () => {
            const newContent = createMockStoredContent({
                id: 'new-1',
                title: 'JavaScript Testing',
                concepts: ['javascript', 'testing'],
                tags: ['javascript', 'testing'],
                category: 'tutorial'
            });

            const result = await manager.processNewContent(newContent, mockContent);

            expect(result.success).toBe(true);
            expect(result.relationships.length).toBeGreaterThan(0);

            // Check that relationships are stored
            const relatedContent = manager.getRelatedContent(newContent.id);
            expect(relatedContent.length).toBeGreaterThan(0);
        });

        it('should create bidirectional relationships', async () => {
            const newContent = createMockStoredContent({
                id: 'new-1',
                title: 'JavaScript Testing',
                concepts: ['javascript', 'testing'],
                category: 'tutorial'
            });

            await manager.processNewContent(newContent, mockContent);

            // Check that bidirectional relationships exist
            const forwardRelationships = manager.getRelatedContent(newContent.id);
            expect(forwardRelationships.length).toBeGreaterThan(0);

            // Check reverse relationships
            const targetId = forwardRelationships[0].targetId;
            const reverseRelationships = manager.getRelatedContent(targetId);
            const hasReverseRelationship = reverseRelationships.some(r => r.targetId === newContent.id);
            expect(hasReverseRelationship).toBe(true);
        });

        it('should respect maxRelationshipsPerContent limit', async () => {
            const newContent = createMockStoredContent({
                id: 'new-1',
                title: 'Programming Guide',
                concepts: ['programming'],
                category: 'tutorial'
            });

            // Create many similar content items
            const manyContent = Array.from({ length: 20 }, (_, i) =>
                createMockStoredContent({
                    id: `similar-${i}`,
                    title: `Programming Topic ${i}`,
                    concepts: ['programming'],
                    category: 'tutorial'
                })
            );

            const result = await manager.processNewContent(newContent, manyContent);

            expect(result.success).toBe(true);
            expect(result.relationships.length).toBeLessThanOrEqual(5); // Respects limit
        });
    });

    describe('updateContentRelationships', () => {
        it('should update relationships for existing content', async () => {
            const existingContent = mockContent[0];
            const updatedContent = {
                ...existingContent,
                concepts: ['javascript', 'advanced', 'patterns'],
                tags: ['javascript', 'advanced'],
                lastModified: new Date()
            };

            const result = await manager.updateContentRelationships(
                updatedContent,
                mockContent
            );

            expect(result.success).toBe(true);
            expect(result.relationships.length).toBeGreaterThan(0);
        });

        it('should remove old relationships before creating new ones', async () => {
            const content = createMockStoredContent({
                id: 'test-content',
                concepts: ['javascript'],
                category: 'tutorial'
            });

            // First, create initial relationships
            await manager.processNewContent(content, mockContent);
            const initialRelationships = manager.getRelatedContent(content.id);
            expect(initialRelationships.length).toBeGreaterThan(0);

            // Update content with completely different concepts
            const updatedContent = {
                ...content,
                concepts: ['cooking', 'recipes'],
                category: 'lifestyle',
                lastModified: new Date()
            };

            await manager.updateContentRelationships(updatedContent, mockContent);
            const updatedRelationships = manager.getRelatedContent(content.id);

            // Relationships should be different (or fewer)
            expect(updatedRelationships).not.toEqual(initialRelationships);
        });
    });

    describe('removeContentRelationships', () => {
        it('should remove all relationships for a content item', async () => {
            const content = createMockStoredContent({
                id: 'test-content',
                concepts: ['javascript'],
                category: 'tutorial'
            });

            // Create relationships
            await manager.processNewContent(content, mockContent);
            expect(manager.getRelatedContent(content.id).length).toBeGreaterThan(0);

            // Remove relationships
            const removedCount = await manager.removeContentRelationships(content.id);
            expect(removedCount).toBeGreaterThan(0);
            expect(manager.getRelatedContent(content.id).length).toBe(0);
        });

        it('should clean up bidirectional relationships', async () => {
            const content = createMockStoredContent({
                id: 'test-content',
                concepts: ['javascript'],
                category: 'tutorial'
            });

            await manager.processNewContent(content, mockContent);
            const relationships = manager.getRelatedContent(content.id);
            const targetId = relationships[0].targetId;

            // Remove relationships for the content
            await manager.removeContentRelationships(content.id);

            // Check that reverse relationships are also removed
            const reverseRelationships = manager.getRelatedContent(targetId);
            const hasReverseRelationship = reverseRelationships.some(r => r.targetId === content.id);
            expect(hasReverseRelationship).toBe(false);
        });
    });

    describe('queryRelationships', () => {
        beforeEach(async () => {
            // Set up some test relationships
            const content1 = createMockStoredContent({
                id: 'content-1',
                concepts: ['javascript'],
                category: 'tutorial'
            });
            const content2 = createMockStoredContent({
                id: 'content-2',
                concepts: ['python'],
                category: 'tutorial'
            });

            await manager.processNewContent(content1, [content2]);
        });

        it('should filter by source ID', () => {
            const results = manager.queryRelationships({ sourceId: 'content-1' });
            expect(results.length).toBeGreaterThan(0);
            results.forEach(r => expect(r.sourceId).toBe('content-1'));
        });

        it('should filter by target ID', () => {
            const results = manager.queryRelationships({ targetId: 'content-2' });
            expect(results.length).toBeGreaterThan(0);
            results.forEach(r => expect(r.targetId).toBe('content-2'));
        });

        it('should filter by relationship type', () => {
            const results = manager.queryRelationships({ type: 'related' });
            results.forEach(r => expect(r.type).toBe('related'));
        });

        it('should filter by minimum strength', () => {
            const minStrength = 0.5;
            const results = manager.queryRelationships({ minStrength });
            results.forEach(r => expect(r.strength).toBeGreaterThanOrEqual(minStrength));
        });

        it('should limit results', () => {
            const limit = 2;
            const results = manager.queryRelationships({ limit });
            expect(results.length).toBeLessThanOrEqual(limit);
        });

        it('should sort by strength descending', () => {
            const results = manager.queryRelationships({});
            for (let i = 1; i < results.length; i++) {
                expect(results[i].strength).toBeLessThanOrEqual(results[i - 1].strength);
            }
        });
    });

    describe('getStrongestRelationships', () => {
        it('should return strongest relationships', async () => {
            // Create content with varying similarity
            const strongContent = createMockStoredContent({
                id: 'strong',
                concepts: ['javascript', 'testing'],
                tags: ['javascript', 'testing'],
                category: 'tutorial'
            });

            const weakContent = createMockStoredContent({
                id: 'weak',
                concepts: ['cooking'],
                category: 'lifestyle'
            });

            await manager.processNewContent(strongContent, mockContent);
            await manager.processNewContent(weakContent, mockContent);

            const strongest = manager.getStrongestRelationships(5);
            expect(strongest.length).toBeGreaterThan(0);

            // Should be sorted by strength
            for (let i = 1; i < strongest.length; i++) {
                expect(strongest[i].strength).toBeLessThanOrEqual(strongest[i - 1].strength);
            }
        });
    });

    describe('getRelationshipStats', () => {
        it('should return accurate statistics', async () => {
            const content = createMockStoredContent({
                id: 'test-content',
                concepts: ['javascript'],
                category: 'tutorial'
            });

            await manager.processNewContent(content, mockContent);

            const stats = manager.getRelationshipStats();
            expect(stats.totalRelationships).toBeGreaterThan(0);
            expect(stats.averageStrength).toBeGreaterThan(0);
            expect(stats.averageConfidence).toBeGreaterThan(0);
            expect(typeof stats.relationshipsByType).toBe('object');
            expect(Array.isArray(stats.mostConnectedContent)).toBe(true);
        });

        it('should handle empty relationships', () => {
            const stats = manager.getRelationshipStats();
            expect(stats.totalRelationships).toBe(0);
            expect(stats.averageStrength).toBe(0);
            expect(stats.averageConfidence).toBe(0);
            expect(Object.keys(stats.relationshipsByType).length).toBe(0);
            expect(stats.mostConnectedContent.length).toBe(0);
        });
    });

    describe('cleanupExpiredRelationships', () => {
        it('should not remove relationships when no TTL is set', async () => {
            const content = createMockStoredContent({
                id: 'test-content',
                concepts: ['javascript']
            });

            await manager.processNewContent(content, mockContent);
            const initialCount = manager.getAllRelationships().length;

            const removedCount = await manager.cleanupExpiredRelationships();
            expect(removedCount).toBe(0);
            expect(manager.getAllRelationships().length).toBe(initialCount);
        });
    });

    describe('loadRelationships and getAllRelationships', () => {
        it('should load and retrieve relationships', async () => {
            const mockRelationships: ContentRelationship[] = [
                {
                    id: 'rel-1',
                    sourceId: 'content-1',
                    targetId: 'content-2',
                    type: 'similar',
                    strength: 0.8,
                    confidence: 0.9,
                    createdAt: new Date(),
                    lastUpdated: new Date()
                }
            ];

            await manager.loadRelationships(mockRelationships);
            const loaded = manager.getAllRelationships();

            expect(loaded.length).toBe(1);
            expect(loaded[0].id).toBe('rel-1');
        });
    });

    describe('clearAllRelationships', () => {
        it('should clear all relationships', async () => {
            const content = createMockStoredContent({
                id: 'test-content',
                concepts: ['javascript']
            });

            await manager.processNewContent(content, mockContent);
            expect(manager.getAllRelationships().length).toBeGreaterThan(0);

            manager.clearAllRelationships();
            expect(manager.getAllRelationships().length).toBe(0);
            expect(manager.getRelatedContent('test-content').length).toBe(0);
        });
    });
});

// Helper functions
function createMockContent(): StoredContent[] {
    return [
        createMockStoredContent({
            id: 'content-1',
            title: 'JavaScript Fundamentals',
            concepts: ['javascript', 'programming'],
            tags: ['javascript', 'programming'],
            category: 'tutorial'
        }),
        createMockStoredContent({
            id: 'content-2',
            title: 'React Development',
            concepts: ['react', 'javascript'],
            tags: ['react', 'javascript'],
            category: 'tutorial'
        }),
        createMockStoredContent({
            id: 'content-3',
            title: 'Python Basics',
            concepts: ['python', 'programming'],
            tags: ['python', 'programming'],
            category: 'tutorial'
        })
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