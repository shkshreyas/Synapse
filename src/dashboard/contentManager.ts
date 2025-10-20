// Advanced content management and organization tools

import { StoredContent } from '../types/storage';
import { ContentStore } from '../storage/contentStore';

export interface ContentFilter {
    category?: string;
    tags?: string[];
    dateRange?: { start: Date; end: Date };
    importance?: { min: number; max: number };
    accessCount?: { min: number; max: number };
    hasNotes?: boolean;
    language?: string;
    searchQuery?: string;
}

export interface BulkOperation {
    type: 'delete' | 'updateCategory' | 'addTags' | 'removeTags' | 'updateImportance' | 'export';
    contentIds: string[];
    parameters?: any;
}

export interface ContentOrganization {
    collections: ContentCollection[];
    smartFilters: SmartFilter[];
    customTags: CustomTag[];
}

export interface ContentCollection {
    id: string;
    name: string;
    description: string;
    contentIds: string[];
    color: string;
    createdAt: Date;
    lastModified: Date;
}

export interface SmartFilter {
    id: string;
    name: string;
    description: string;
    filter: ContentFilter;
    autoUpdate: boolean;
    createdAt: Date;
}

export interface CustomTag {
    id: string;
    name: string;
    color: string;
    description?: string;
    usageCount: number;
    createdAt: Date;
}

export interface ContentStats {
    totalItems: number;
    categories: Record<string, number>;
    tags: Record<string, number>;
    languages: Record<string, number>;
    averageImportance: number;
    totalReadingTime: number;
    accessPatterns: {
        neverAccessed: number;
        lowAccess: number;
        mediumAccess: number;
        highAccess: number;
    };
}

export class ContentManager {
    private static instance: ContentManager | null = null;
    private contentStore: ContentStore;
    private organization: ContentOrganization;

    constructor() {
        this.contentStore = ContentStore.getInstance();
        this.organization = {
            collections: [],
            smartFilters: [],
            customTags: []
        };
        this.loadOrganization();
    }

    static getInstance(): ContentManager {
        if (!ContentManager.instance) {
            ContentManager.instance = new ContentManager();
        }
        return ContentManager.instance;
    }

    async filterContent(content: StoredContent[], filter: ContentFilter): Promise<StoredContent[]> {
        let filtered = [...content];

        // Category filter
        if (filter.category) {
            filtered = filtered.filter(item => item.category === filter.category);
        }

        // Tags filter
        if (filter.tags && filter.tags.length > 0) {
            filtered = filtered.filter(item =>
                item.tags && filter.tags!.some(tag => item.tags!.includes(tag))
            );
        }

        // Date range filter
        if (filter.dateRange) {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.timestamp);
                return itemDate >= filter.dateRange!.start && itemDate <= filter.dateRange!.end;
            });
        }

        // Importance filter
        if (filter.importance) {
            filtered = filtered.filter(item => {
                const importance = item.importance || 5;
                return importance >= filter.importance!.min && importance <= filter.importance!.max;
            });
        }

        // Access count filter
        if (filter.accessCount) {
            filtered = filtered.filter(item =>
                item.timesAccessed >= filter.accessCount!.min &&
                item.timesAccessed <= filter.accessCount!.max
            );
        }

        // Has notes filter
        if (filter.hasNotes !== undefined) {
            filtered = filtered.filter(item =>
                filter.hasNotes ? (item.userNotes && item.userNotes.length > 0) : !item.userNotes
            );
        }

        // Language filter
        if (filter.language) {
            filtered = filtered.filter(item => item.metadata.language === filter.language);
        }

        // Search query filter
        if (filter.searchQuery) {
            const query = filter.searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.title.toLowerCase().includes(query) ||
                item.content.toLowerCase().includes(query) ||
                (item.tags && item.tags.some(tag => tag.toLowerCase().includes(query))) ||
                (item.concepts && item.concepts.some(concept => concept.toLowerCase().includes(query)))
            );
        }

        return filtered;
    }

    async performBulkOperation(operation: BulkOperation): Promise<{ success: number; failed: number; errors: string[] }> {
        const results = { success: 0, failed: 0, errors: [] as string[] };

        for (const contentId of operation.contentIds) {
            try {
                switch (operation.type) {
                    case 'delete':
                        await this.deleteContent(contentId);
                        break;
                    case 'updateCategory':
                        await this.updateContentCategory(contentId, operation.parameters.category);
                        break;
                    case 'addTags':
                        await this.addTagsToContent(contentId, operation.parameters.tags);
                        break;
                    case 'removeTags':
                        await this.removeTagsFromContent(contentId, operation.parameters.tags);
                        break;
                    case 'updateImportance':
                        await this.updateContentImportance(contentId, operation.parameters.importance);
                        break;
                    case 'export':
                        // Export is handled differently as it's not per-item
                        break;
                }
                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push(`Failed to process ${contentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        return results;
    }

    async createCollection(name: string, description: string, contentIds: string[] = []): Promise<ContentCollection> {
        const collection: ContentCollection = {
            id: `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            description,
            contentIds,
            color: this.generateRandomColor(),
            createdAt: new Date(),
            lastModified: new Date()
        };

        this.organization.collections.push(collection);
        await this.saveOrganization();

        return collection;
    }

    async updateCollection(collectionId: string, updates: Partial<ContentCollection>): Promise<void> {
        const collection = this.organization.collections.find(c => c.id === collectionId);
        if (!collection) {
            throw new Error('Collection not found');
        }

        Object.assign(collection, updates, { lastModified: new Date() });
        await this.saveOrganization();
    }

    async deleteCollection(collectionId: string): Promise<void> {
        this.organization.collections = this.organization.collections.filter(c => c.id !== collectionId);
        await this.saveOrganization();
    }

    async addContentToCollection(collectionId: string, contentIds: string[]): Promise<void> {
        const collection = this.organization.collections.find(c => c.id === collectionId);
        if (!collection) {
            throw new Error('Collection not found');
        }

        // Add unique content IDs
        const newIds = contentIds.filter(id => !collection.contentIds.includes(id));
        collection.contentIds.push(...newIds);
        collection.lastModified = new Date();

        await this.saveOrganization();
    }

    async removeContentFromCollection(collectionId: string, contentIds: string[]): Promise<void> {
        const collection = this.organization.collections.find(c => c.id === collectionId);
        if (!collection) {
            throw new Error('Collection not found');
        }

        collection.contentIds = collection.contentIds.filter(id => !contentIds.includes(id));
        collection.lastModified = new Date();

        await this.saveOrganization();
    }

    async createSmartFilter(name: string, description: string, filter: ContentFilter): Promise<SmartFilter> {
        const smartFilter: SmartFilter = {
            id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            description,
            filter,
            autoUpdate: true,
            createdAt: new Date()
        };

        this.organization.smartFilters.push(smartFilter);
        await this.saveOrganization();

        return smartFilter;
    }

    async updateSmartFilter(filterId: string, updates: Partial<SmartFilter>): Promise<void> {
        const filter = this.organization.smartFilters.find(f => f.id === filterId);
        if (!filter) {
            throw new Error('Smart filter not found');
        }

        Object.assign(filter, updates);
        await this.saveOrganization();
    }

    async deleteSmartFilter(filterId: string): Promise<void> {
        this.organization.smartFilters = this.organization.smartFilters.filter(f => f.id !== filterId);
        await this.saveOrganization();
    }

    async createCustomTag(name: string, color: string, description?: string): Promise<CustomTag> {
        // Check if tag already exists
        const existing = this.organization.customTags.find(t => t.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            throw new Error('Tag already exists');
        }

        const customTag: CustomTag = {
            id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            color,
            description,
            usageCount: 0,
            createdAt: new Date()
        };

        this.organization.customTags.push(customTag);
        await this.saveOrganization();

        return customTag;
    }

    async updateCustomTag(tagId: string, updates: Partial<CustomTag>): Promise<void> {
        const tag = this.organization.customTags.find(t => t.id === tagId);
        if (!tag) {
            throw new Error('Custom tag not found');
        }

        Object.assign(tag, updates);
        await this.saveOrganization();
    }

    async deleteCustomTag(tagId: string): Promise<void> {
        this.organization.customTags = this.organization.customTags.filter(t => t.id !== tagId);
        await this.saveOrganization();
    }

    async generateContentStats(content: StoredContent[]): Promise<ContentStats> {
        const stats: ContentStats = {
            totalItems: content.length,
            categories: {},
            tags: {},
            languages: {},
            averageImportance: 0,
            totalReadingTime: 0,
            accessPatterns: {
                neverAccessed: 0,
                lowAccess: 0,
                mediumAccess: 0,
                highAccess: 0
            }
        };

        let totalImportance = 0;

        content.forEach(item => {
            // Categories
            const category = item.category || 'other';
            stats.categories[category] = (stats.categories[category] || 0) + 1;

            // Tags
            if (item.tags) {
                item.tags.forEach(tag => {
                    stats.tags[tag] = (stats.tags[tag] || 0) + 1;
                });
            }

            // Languages
            const language = item.metadata.language || 'unknown';
            stats.languages[language] = (stats.languages[language] || 0) + 1;

            // Importance
            const importance = item.importance || 5;
            totalImportance += importance;

            // Reading time
            stats.totalReadingTime += item.metadata.readingTime || 0;

            // Access patterns
            if (item.timesAccessed === 0) {
                stats.accessPatterns.neverAccessed++;
            } else if (item.timesAccessed <= 2) {
                stats.accessPatterns.lowAccess++;
            } else if (item.timesAccessed <= 10) {
                stats.accessPatterns.mediumAccess++;
            } else {
                stats.accessPatterns.highAccess++;
            }
        });

        stats.averageImportance = content.length > 0 ? totalImportance / content.length : 0;

        return stats;
    }

    async suggestTags(content: StoredContent): Promise<string[]> {
        const suggestions: string[] = [];

        // Extract potential tags from title and content
        const text = (content.title + ' ' + content.content).toLowerCase();
        const words = text.match(/\b\w{4,}\b/g) || [];

        // Common programming/tech terms that make good tags
        const techTerms = [
            'javascript', 'typescript', 'python', 'java', 'react', 'vue', 'angular',
            'node', 'express', 'database', 'sql', 'api', 'rest', 'graphql',
            'css', 'html', 'frontend', 'backend', 'fullstack', 'devops',
            'tutorial', 'guide', 'documentation', 'reference', 'example',
            'algorithm', 'data structure', 'design pattern', 'architecture',
            'testing', 'debugging', 'performance', 'security', 'authentication'
        ];

        // Find matching tech terms
        techTerms.forEach(term => {
            if (words.some(word => word.includes(term) || term.includes(word))) {
                suggestions.push(term);
            }
        });

        // Use existing concepts as tag suggestions
        if (content.concepts) {
            suggestions.push(...content.concepts.slice(0, 5));
        }

        // Remove duplicates and limit
        return Array.from(new Set(suggestions)).slice(0, 8);
    }

    async suggestCollections(content: StoredContent[]): Promise<{ name: string; description: string; contentIds: string[] }[]> {
        const suggestions: { name: string; description: string; contentIds: string[] }[] = [];

        // Group by category
        const categoryGroups = new Map<string, StoredContent[]>();
        content.forEach(item => {
            const category = item.category || 'other';
            if (!categoryGroups.has(category)) {
                categoryGroups.set(category, []);
            }
            categoryGroups.get(category)!.push(item);
        });

        categoryGroups.forEach((items, category) => {
            if (items.length >= 3) {
                suggestions.push({
                    name: `${category.charAt(0).toUpperCase() + category.slice(1)} Collection`,
                    description: `All ${category} content`,
                    contentIds: items.map(item => item.id)
                });
            }
        });

        // Group by common tags
        const tagGroups = new Map<string, StoredContent[]>();
        content.forEach(item => {
            if (item.tags) {
                item.tags.forEach(tag => {
                    if (!tagGroups.has(tag)) {
                        tagGroups.set(tag, []);
                    }
                    tagGroups.get(tag)!.push(item);
                });
            }
        });

        tagGroups.forEach((items, tag) => {
            if (items.length >= 3) {
                suggestions.push({
                    name: `${tag} Resources`,
                    description: `Content related to ${tag}`,
                    contentIds: items.map(item => item.id)
                });
            }
        });

        return suggestions.slice(0, 5);
    }

    getOrganization(): ContentOrganization {
        return this.organization;
    }

    private async deleteContent(contentId: string): Promise<void> {
        const result = await this.contentStore.delete(contentId);
        if (!result.success) {
            throw new Error(result.error || 'Failed to delete content');
        }
    }

    private async updateContentCategory(contentId: string, category: string): Promise<void> {
        const result = await this.contentStore.update(contentId, { category });
        if (!result.success) {
            throw new Error(result.error || 'Failed to update category');
        }
    }

    private async addTagsToContent(contentId: string, newTags: string[]): Promise<void> {
        const readResult = await this.contentStore.read(contentId);
        if (!readResult.success || !readResult.data) {
            throw new Error('Content not found');
        }

        const existingTags = readResult.data.tags || [];
        const updatedTags = Array.from(new Set([...existingTags, ...newTags]));

        const updateResult = await this.contentStore.update(contentId, { tags: updatedTags });
        if (!updateResult.success) {
            throw new Error(updateResult.error || 'Failed to add tags');
        }

        // Update tag usage counts
        newTags.forEach(tagName => {
            const customTag = this.organization.customTags.find(t => t.name === tagName);
            if (customTag) {
                customTag.usageCount++;
            }
        });
        await this.saveOrganization();
    }

    private async removeTagsFromContent(contentId: string, tagsToRemove: string[]): Promise<void> {
        const readResult = await this.contentStore.read(contentId);
        if (!readResult.success || !readResult.data) {
            throw new Error('Content not found');
        }

        const existingTags = readResult.data.tags || [];
        const updatedTags = existingTags.filter(tag => !tagsToRemove.includes(tag));

        const updateResult = await this.contentStore.update(contentId, { tags: updatedTags });
        if (!updateResult.success) {
            throw new Error(updateResult.error || 'Failed to remove tags');
        }

        // Update tag usage counts
        tagsToRemove.forEach(tagName => {
            const customTag = this.organization.customTags.find(t => t.name === tagName);
            if (customTag && customTag.usageCount > 0) {
                customTag.usageCount--;
            }
        });
        await this.saveOrganization();
    }

    private async updateContentImportance(contentId: string, importance: number): Promise<void> {
        const result = await this.contentStore.update(contentId, { importance });
        if (!result.success) {
            throw new Error(result.error || 'Failed to update importance');
        }
    }

    private generateRandomColor(): string {
        const colors = [
            '#4285f4', '#34a853', '#ea4335', '#fbbc04', '#9aa0a6',
            '#8e24aa', '#d81b60', '#e53935', '#fb8c00', '#fdd835',
            '#43a047', '#00acc1', '#3949ab', '#8e24aa', '#c0ca33'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    private async loadOrganization(): Promise<void> {
        try {
            // Load from localStorage for now
            const stored = localStorage.getItem('mindscribe-organization');
            if (stored) {
                this.organization = JSON.parse(stored);

                // Convert date strings back to Date objects
                this.organization.collections.forEach(collection => {
                    collection.createdAt = new Date(collection.createdAt);
                    collection.lastModified = new Date(collection.lastModified);
                });

                this.organization.smartFilters.forEach(filter => {
                    filter.createdAt = new Date(filter.createdAt);
                });

                this.organization.customTags.forEach(tag => {
                    tag.createdAt = new Date(tag.createdAt);
                });
            }
        } catch (error) {
            console.error('Failed to load organization data:', error);
        }
    }

    private async saveOrganization(): Promise<void> {
        try {
            localStorage.setItem('mindscribe-organization', JSON.stringify(this.organization));
        } catch (error) {
            console.error('Failed to save organization data:', error);
        }
    }
}