// Example demonstrating the relationship detection system

import { RelationshipService } from '../relationshipService';
import { StoredContent, ContentRelationship } from '../../types/storage';

/**
 * Example usage of the relationship detection system
 */
export class RelationshipExample {
    private service: RelationshipService;

    constructor() {
        // Mock storage functions for the example
        const getStoredContent = async (): Promise<StoredContent[]> => {
            return this.mockContentDatabase;
        };

        const saveRelationships = async (relationships: ContentRelationship[]): Promise<void> => {
            console.log(`Saving ${relationships.length} relationships to storage`);
            this.mockRelationshipDatabase = relationships;
        };

        const loadRelationships = async (): Promise<ContentRelationship[]> => {
            return this.mockRelationshipDatabase;
        };

        // Initialize the service
        this.service = new RelationshipService(
            {
                enableAutoProcessing: true,
                processingDelay: 0,
                maxRelationshipsPerContent: 10
            },
            getStoredContent,
            saveRelationships,
            loadRelationships
        );
    }

    private mockContentDatabase: StoredContent[] = [
        {
            id: 'js-basics',
            url: 'https://example.com/js-basics',
            title: 'JavaScript Fundamentals',
            content: 'Learn the basics of JavaScript programming including variables, functions, and objects.',
            metadata: {
                readingTime: 10,
                pageType: 'article',
                language: 'en',
                wordCount: 500,
                imageCount: 2,
                linkCount: 5
            },
            captureMethod: 'manual',
            timestamp: new Date('2024-01-01'),
            concepts: ['javascript', 'programming', 'fundamentals'],
            tags: ['javascript', 'beginner', 'programming'],
            category: 'tutorial',
            timesAccessed: 5,
            lastAccessed: new Date(),
            syncedToCloud: false,
            cloudAnalysisComplete: false,
            lastModified: new Date(),
            storageSize: 2000,
            version: 1
        },
        {
            id: 'react-intro',
            url: 'https://example.com/react-intro',
            title: 'Introduction to React',
            content: 'React is a JavaScript library for building user interfaces. Learn components, props, and state.',
            metadata: {
                readingTime: 15,
                pageType: 'article',
                language: 'en',
                wordCount: 750,
                imageCount: 3,
                linkCount: 8
            },
            captureMethod: 'auto',
            timestamp: new Date('2024-01-02'),
            concepts: ['react', 'javascript', 'components', 'ui'],
            tags: ['react', 'javascript', 'frontend'],
            category: 'tutorial',
            timesAccessed: 8,
            lastAccessed: new Date(),
            syncedToCloud: false,
            cloudAnalysisComplete: false,
            lastModified: new Date(),
            storageSize: 3000,
            version: 1
        },
        {
            id: 'python-basics',
            url: 'https://example.com/python-basics',
            title: 'Python Programming Basics',
            content: 'Python is a versatile programming language. Learn syntax, data types, and control structures.',
            metadata: {
                readingTime: 12,
                pageType: 'article',
                language: 'en',
                wordCount: 600,
                imageCount: 1,
                linkCount: 4
            },
            captureMethod: 'manual',
            timestamp: new Date('2024-01-03'),
            concepts: ['python', 'programming', 'syntax'],
            tags: ['python', 'beginner', 'programming'],
            category: 'tutorial',
            timesAccessed: 3,
            lastAccessed: new Date(),
            syncedToCloud: false,
            cloudAnalysisComplete: false,
            lastModified: new Date(),
            storageSize: 2500,
            version: 1
        }
    ];

    private mockRelationshipDatabase: ContentRelationship[] = [];

    /**
     * Demonstrates adding new content and detecting relationships
     */
    async demonstrateRelationshipDetection(): Promise<void> {
        console.log('=== Relationship Detection Example ===\n');

        // Initialize the service
        await this.service.initialize();

        // Add a new piece of content that should relate to existing content
        const newContent: StoredContent = {
            id: 'js-advanced',
            url: 'https://example.com/js-advanced',
            title: 'Advanced JavaScript Patterns',
            content: 'Explore advanced JavaScript concepts including closures, prototypes, and async programming.',
            metadata: {
                readingTime: 20,
                pageType: 'article',
                language: 'en',
                wordCount: 1000,
                imageCount: 4,
                linkCount: 12
            },
            captureMethod: 'manual',
            timestamp: new Date(),
            concepts: ['javascript', 'advanced', 'patterns', 'closures'],
            tags: ['javascript', 'advanced', 'programming'],
            category: 'tutorial',
            timesAccessed: 0,
            lastAccessed: new Date(),
            syncedToCloud: false,
            cloudAnalysisComplete: false,
            lastModified: new Date(),
            storageSize: 4000,
            version: 1
        };

        // Add the new content to our mock database
        this.mockContentDatabase.push(newContent);

        console.log('Adding new content:', newContent.title);
        console.log('Concepts:', newContent.concepts);
        console.log('Tags:', newContent.tags);
        console.log('Category:', newContent.category);
        console.log();

        // Process the new content to detect relationships
        await this.service.onContentCreated(newContent);

        // Get related content
        const relatedContent = this.service.getRelatedContent(newContent.id, 5);
        console.log(`Found ${relatedContent.length} related content items:\n`);

        for (const relationship of relatedContent) {
            const targetContent = this.mockContentDatabase.find(c => c.id === relationship.targetId);
            if (targetContent) {
                console.log(`- ${targetContent.title}`);
                console.log(`  Relationship: ${relationship.type}`);
                console.log(`  Strength: ${(relationship.strength * 100).toFixed(1)}%`);
                console.log(`  Confidence: ${(relationship.confidence * 100).toFixed(1)}%`);
                console.log();
            }
        }

        // Show service statistics
        const serviceStats = this.service.getServiceStats();
        const relationshipStats = this.service.getRelationshipStats();

        console.log('=== Service Statistics ===');
        console.log(`Total processed: ${serviceStats.totalProcessed}`);
        console.log(`Total relationships: ${relationshipStats.totalRelationships}`);
        console.log(`Average strength: ${(relationshipStats.averageStrength * 100).toFixed(1)}%`);
        console.log(`Average confidence: ${(relationshipStats.averageConfidence * 100).toFixed(1)}%`);
        console.log();

        // Show relationships by type
        console.log('=== Relationships by Type ===');
        for (const [type, count] of Object.entries(relationshipStats.relationshipsByType)) {
            console.log(`${type}: ${count}`);
        }
        console.log();

        // Demonstrate querying relationships
        console.log('=== Query Examples ===');

        // Find all JavaScript-related relationships
        const jsRelationships = this.service.queryRelationships({
            minStrength: 0.3
        });
        console.log(`High-strength relationships: ${jsRelationships.length}`);

        // Find similar content
        const similarContent = this.service.queryRelationships({
            type: 'similar',
            limit: 3
        });
        console.log(`Similar content relationships: ${similarContent.length}`);

        // Clean up
        this.service.destroy();
    }

    /**
     * Demonstrates updating content and relationship changes
     */
    async demonstrateRelationshipUpdates(): Promise<void> {
        console.log('\n=== Relationship Update Example ===\n');

        await this.service.initialize();

        // Get an existing content item
        const existingContent = { ...this.mockContentDatabase[0] };
        console.log('Original content:', existingContent.title);
        console.log('Original concepts:', existingContent.concepts);

        // Update the content with new concepts
        existingContent.concepts = ['javascript', 'programming', 'fundamentals', 'react', 'components'];
        existingContent.tags = ['javascript', 'react', 'programming', 'frontend'];
        existingContent.lastModified = new Date();

        console.log('Updated concepts:', existingContent.concepts);
        console.log('Updated tags:', existingContent.tags);
        console.log();

        // Update the content in our mock database
        const index = this.mockContentDatabase.findIndex(c => c.id === existingContent.id);
        this.mockContentDatabase[index] = existingContent;

        // Process the updated content
        await this.service.onContentUpdated(existingContent);

        // Show new relationships
        const relatedContent = this.service.getRelatedContent(existingContent.id, 5);
        console.log(`Updated relationships (${relatedContent.length} found):\n`);

        for (const relationship of relatedContent) {
            const targetContent = this.mockContentDatabase.find(c => c.id === relationship.targetId);
            if (targetContent) {
                console.log(`- ${targetContent.title}`);
                console.log(`  Strength: ${(relationship.strength * 100).toFixed(1)}%`);
                console.log();
            }
        }

        this.service.destroy();
    }
}

// Example usage
if (require.main === module) {
    const example = new RelationshipExample();

    example.demonstrateRelationshipDetection()
        .then(() => example.demonstrateRelationshipUpdates())
        .then(() => console.log('Example completed!'))
        .catch(console.error);
}