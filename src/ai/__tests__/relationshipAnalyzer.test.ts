// Tests for RelationshipAnalyzer

import { RelationshipAnalyzer, RelationshipDetectionOptions } from '../relationshipAnalyzer';
import { StoredContent } from '../../types/storage';

describe('RelationshipAnalyzer', () => {
    let analyzer: RelationshipAnalyzer;
    let mockContent: StoredContent[];

    beforeEach(() => {
        analyzer = new RelationshipAnalyzer();
        mockContent = createMockContent();
    });

    describe('analyzeRelationships', () => {
        it('should find relationships between similar content', async () => {
            const newContent = createMockStoredContent({
                id: 'new-1',
                title: 'JavaScript Testing Guide',
                content: 'Learn how to test JavaScript applications with Jest and other testing frameworks',
                concepts: ['javascript', 'testing', 'jest'],
                tags: ['programming', 'testing', 'javascript'],
                category: 'tutorial'
            });

            const result = await analyzer.analyzeRelationships(newContent, mockContent);

            expect(result.success).toBe(true);
            expect(result.relationships.length).toBeGreaterThan(0);
            expect(result.processingTime).toBeGreaterThan(0);

            // Should find relationship with similar JavaScript content
            const jsRelationship = result.relationships.find(r =>
                mockContent.find(c => c.id === r.targetId)?.concepts?.includes('javascript')
            );
            expect(jsRelationship).toBeDefined();
            expect(jsRelationship!.strength).toBeGreaterThan(0.3);
        });

        it('should respect similarity threshold', async () => {
            const newContent = createMockStoredContent({
                id: 'new-1',
                title: 'Cooking Recipes',
                content: 'Delicious recipes for home cooking',
                concepts: ['cooking', 'recipes'],
                tags: ['food', 'cooking'],
                category: 'lifestyle'
            });

            const options: Partial<RelationshipDetectionOptions> = {
                minSimilarityThreshold: 0.8 // Very high threshold
            };

            const result = await analyzer.analyzeRelationships(newContent, mockContent, options);

            expect(result.success).toBe(true);
            expect(result.relationships.length).toBe(0); // No relationships should meet high threshold
        });

        it('should limit number of relationships', async () => {
            const newContent = createMockStoredContent({
                id: 'new-1',
                title: 'Programming Guide',
                content: 'General programming concepts and best practices',
                concepts: ['programming', 'development'],
                tags: ['programming', 'development'],
                category: 'tutorial'
            });

            const options: Partial<RelationshipDetectionOptions> = {
                maxRelationshipsPerContent: 2
            };

            const result = await analyzer.analyzeRelationships(newContent, mockContent, options);

            expect(result.success).toBe(true);
            expect(result.relationships.length).toBeLessThanOrEqual(2);
        });

        it('should handle content with no concepts or tags', async () => {
            const newContent = createMockStoredContent({
                id: 'new-1',
                title: 'Simple Article',
                content: 'This is a simple article with no special metadata',
                concepts: [],
                tags: [],
                category: undefined
            });

            const result = await analyzer.analyzeRelationships(newContent, mockContent);

            expect(result.success).toBe(true);
            // Should still work with semantic analysis
        });

        it('should handle errors gracefully', async () => {
            const newContent = createMockStoredContent({
                id: 'new-1',
                title: 'Test Content',
                content: 'Test content'
            });

            // Mock an error by passing invalid existing content
            const invalidContent = [null as any];

            const result = await analyzer.analyzeRelationships(newContent, invalidContent);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.relationships.length).toBe(0);
        });
    });

    describe('updateRelationships', () => {
        it('should update relationships for modified content', async () => {
            const updatedContent = createMockStoredContent({
                id: 'content-1',
                title: 'Updated JavaScript Guide',
                content: 'Updated guide for JavaScript development with new frameworks',
                concepts: ['javascript', 'frameworks', 'development'],
                tags: ['javascript', 'programming', 'frameworks'],
                category: 'tutorial'
            });

            const result = await analyzer.updateRelationships(
                updatedContent,
                mockContent,
                []
            );

            expect(result.success).toBe(true);
            expect(result.relationships.length).toBeGreaterThan(0);
        });
    });

    describe('relationship types and scoring', () => {
        it('should assign appropriate relationship types', async () => {
            const newContent = createMockStoredContent({
                id: 'new-1',
                title: 'Advanced JavaScript Patterns',
                content: 'Advanced patterns and techniques for JavaScript development',
                concepts: ['javascript', 'patterns', 'advanced'],
                tags: ['javascript', 'programming', 'advanced'],
                category: 'tutorial'
            });

            const result = await analyzer.analyzeRelationships(newContent, mockContent);

            expect(result.success).toBe(true);

            const relationships = result.relationships;
            expect(relationships.length).toBeGreaterThan(0);

            // Check that relationships have valid types
            const validTypes = ['similar', 'builds_on', 'contradicts', 'references', 'related'];
            relationships.forEach(r => {
                expect(validTypes).toContain(r.type);
            });
        });

        it('should calculate confidence scores', async () => {
            const newContent = createMockStoredContent({
                id: 'new-1',
                title: 'JavaScript Testing',
                content: 'Testing JavaScript applications',
                concepts: ['javascript', 'testing'],
                tags: ['javascript', 'testing'],
                category: 'tutorial'
            });

            const result = await analyzer.analyzeRelationships(newContent, mockContent);

            expect(result.success).toBe(true);

            result.relationships.forEach(relationship => {
                expect(relationship.confidence).toBeGreaterThanOrEqual(0);
                expect(relationship.confidence).toBeLessThanOrEqual(1);
                expect(relationship.strength).toBeGreaterThanOrEqual(0);
                expect(relationship.strength).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('similarity calculations', () => {
        it('should calculate concept similarity correctly', async () => {
            const content1 = createMockStoredContent({
                id: 'content-1',
                concepts: ['javascript', 'testing', 'jest']
            });

            const content2 = createMockStoredContent({
                id: 'content-2',
                concepts: ['javascript', 'testing', 'mocha']
            });

            const result = await analyzer.analyzeRelationships(content1, [content2]);

            expect(result.success).toBe(true);
            expect(result.relationships.length).toBeGreaterThan(0);

            const relationship = result.relationships[0];
            expect(relationship.strength).toBeGreaterThan(0.3); // Should have meaningful overlap
        });

        it('should handle empty concept arrays', async () => {
            const content1 = createMockStoredContent({
                id: 'content-1',
                concepts: []
            });

            const content2 = createMockStoredContent({
                id: 'content-2',
                concepts: []
            });

            const result = await analyzer.analyzeRelationships(content1, [content2]);

            expect(result.success).toBe(true);
            // Should still work with other similarity measures
        });
    });
});

// Helper functions
function createMockContent(): StoredContent[] {
    return [
        createMockStoredContent({
            id: 'content-1',
            title: 'JavaScript Fundamentals',
            content: 'Learn the basics of JavaScript programming language',
            concepts: ['javascript', 'programming', 'fundamentals'],
            tags: ['javascript', 'programming', 'beginner'],
            category: 'tutorial'
        }),
        createMockStoredContent({
            id: 'content-2',
            title: 'React Development Guide',
            content: 'Building modern web applications with React framework',
            concepts: ['react', 'javascript', 'frontend'],
            tags: ['react', 'javascript', 'frontend'],
            category: 'tutorial'
        }),
        createMockStoredContent({
            id: 'content-3',
            title: 'Python Data Science',
            content: 'Data analysis and machine learning with Python',
            concepts: ['python', 'data-science', 'machine-learning'],
            tags: ['python', 'data-science', 'ml'],
            category: 'tutorial'
        }),
        createMockStoredContent({
            id: 'content-4',
            title: 'Web Design Principles',
            content: 'Design principles for creating beautiful websites',
            concepts: ['design', 'web', 'ui-ux'],
            tags: ['design', 'web', 'ui'],
            category: 'design'
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