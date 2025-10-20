// Relationship analysis for content items using semantic similarity

import { StoredContent, ContentRelationship } from '../types/storage';
import { ExtractedConcept } from './types';

export interface RelationshipAnalysisResult {
    relationships: ContentRelationship[];
    processingTime: number;
    success: boolean;
    error?: string;
}

export interface SimilarityScore {
    contentId: string;
    score: number;
    reasons: string[];
}

export interface RelationshipDetectionOptions {
    minSimilarityThreshold: number; // 0-1, minimum score to create relationship
    maxRelationshipsPerContent: number; // Limit relationships to prevent noise
    enableSemanticAnalysis: boolean;
    enableConceptMatching: boolean;
    enableCategoryMatching: boolean;
}

export class RelationshipAnalyzer {
    private readonly defaultOptions: RelationshipDetectionOptions = {
        minSimilarityThreshold: 0.3,
        maxRelationshipsPerContent: 10,
        enableSemanticAnalysis: true,
        enableConceptMatching: true,
        enableCategoryMatching: true
    };

    /**
     * Analyzes relationships between a new content item and existing content
     */
    async analyzeRelationships(
        newContent: StoredContent,
        existingContent: StoredContent[],
        options: Partial<RelationshipDetectionOptions> = {}
    ): Promise<RelationshipAnalysisResult> {
        const startTime = Date.now();
        const config = { ...this.defaultOptions, ...options };

        try {
            const similarities = await this.calculateSimilarities(
                newContent,
                existingContent,
                config
            );

            const relationships = this.createRelationships(
                newContent.id,
                similarities,
                config
            );

            return {
                relationships,
                processingTime: Date.now() - startTime,
                success: true
            };
        } catch (error) {
            return {
                relationships: [],
                processingTime: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Updates relationships when content is modified
     */
    async updateRelationships(
        updatedContent: StoredContent,
        allContent: StoredContent[],
        existingRelationships: ContentRelationship[],
        options: Partial<RelationshipDetectionOptions> = {}
    ): Promise<RelationshipAnalysisResult> {
        const startTime = Date.now();
        const config = { ...this.defaultOptions, ...options };

        try {
            // Remove existing relationships for this content
            const otherContent = allContent.filter(c => c.id !== updatedContent.id);

            // Recalculate relationships
            const similarities = await this.calculateSimilarities(
                updatedContent,
                otherContent,
                config
            );

            const newRelationships = this.createRelationships(
                updatedContent.id,
                similarities,
                config
            );

            return {
                relationships: newRelationships,
                processingTime: Date.now() - startTime,
                success: true
            };
        } catch (error) {
            return {
                relationships: [],
                processingTime: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Calculates similarity scores between content items
     */
    private async calculateSimilarities(
        targetContent: StoredContent,
        candidateContent: StoredContent[],
        options: RelationshipDetectionOptions
    ): Promise<SimilarityScore[]> {
        const similarities: SimilarityScore[] = [];

        for (const candidate of candidateContent) {
            const score = await this.calculateContentSimilarity(
                targetContent,
                candidate,
                options
            );

            if (score.score >= options.minSimilarityThreshold) {
                similarities.push(score);
            }
        }

        // Sort by score descending and limit results
        return similarities
            .sort((a, b) => b.score - a.score)
            .slice(0, options.maxRelationshipsPerContent);
    }

    /**
     * Calculates similarity between two content items
     */
    private async calculateContentSimilarity(
        content1: StoredContent,
        content2: StoredContent,
        options: RelationshipDetectionOptions
    ): Promise<SimilarityScore> {
        const reasons: string[] = [];
        let totalScore = 0;
        let weightSum = 0;

        // Category matching (weight: 0.2)
        if (options.enableCategoryMatching && content1.category && content2.category) {
            const categoryWeight = 0.2;
            const categoryScore = content1.category === content2.category ? 1 : 0;
            totalScore += categoryScore * categoryWeight;
            weightSum += categoryWeight;

            if (categoryScore > 0) {
                reasons.push(`Same category: ${content1.category}`);
            }
        }

        // Concept matching (weight: 0.4)
        if (options.enableConceptMatching && content1.concepts && content2.concepts) {
            const conceptWeight = 0.4;
            const conceptScore = this.calculateConceptSimilarity(content1.concepts, content2.concepts);
            totalScore += conceptScore * conceptWeight;
            weightSum += conceptWeight;

            if (conceptScore > 0.3) {
                const commonConcepts = content1.concepts.filter(c => content2.concepts!.includes(c));
                reasons.push(`Shared concepts: ${commonConcepts.slice(0, 3).join(', ')}`);
            }
        }

        // Tag matching (weight: 0.2)
        if (content1.tags && content2.tags) {
            const tagWeight = 0.2;
            const tagScore = this.calculateTagSimilarity(content1.tags, content2.tags);
            totalScore += tagScore * tagWeight;
            weightSum += tagWeight;

            if (tagScore > 0.3) {
                const commonTags = content1.tags.filter(t => content2.tags!.includes(t));
                reasons.push(`Shared tags: ${commonTags.slice(0, 3).join(', ')}`);
            }
        }

        // Semantic text similarity (weight: 0.2)
        if (options.enableSemanticAnalysis) {
            const semanticWeight = 0.2;
            const semanticScore = await this.calculateSemanticSimilarity(
                content1.content,
                content2.content
            );
            totalScore += semanticScore * semanticWeight;
            weightSum += semanticWeight;

            if (semanticScore > 0.4) {
                reasons.push('Similar content themes');
            }
        }

        // Normalize score
        const finalScore = weightSum > 0 ? totalScore / weightSum : 0;

        return {
            contentId: content2.id,
            score: finalScore,
            reasons
        };
    }

    /**
     * Calculates concept similarity using Jaccard similarity
     */
    private calculateConceptSimilarity(concepts1: string[], concepts2: string[]): number {
        if (concepts1.length === 0 && concepts2.length === 0) return 0;

        const set1 = new Set(concepts1.map(c => c.toLowerCase()));
        const set2 = new Set(concepts2.map(c => c.toLowerCase()));

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    /**
     * Calculates tag similarity using Jaccard similarity
     */
    private calculateTagSimilarity(tags1: string[], tags2: string[]): number {
        if (tags1.length === 0 && tags2.length === 0) return 0;

        const set1 = new Set(tags1.map(t => t.toLowerCase()));
        const set2 = new Set(tags2.map(t => t.toLowerCase()));

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    /**
     * Calculates semantic similarity using simple text analysis
     * In a real implementation, this would use embeddings or Chrome's AI APIs
     */
    private async calculateSemanticSimilarity(text1: string, text2: string): Promise<number> {
        // Simple implementation using word overlap
        // In production, this would use Chrome's AI APIs for better semantic analysis
        const words1 = this.extractSignificantWords(text1);
        const words2 = this.extractSignificantWords(text2);

        if (words1.length === 0 && words2.length === 0) return 0;

        const set1 = new Set(words1);
        const set2 = new Set(words2);

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    /**
     * Extracts significant words from text (removes stop words, short words)
     */
    private extractSignificantWords(text: string): string[] {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
            'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
        ]);

        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.has(word))
            .slice(0, 100); // Limit to first 100 significant words
    }

    /**
     * Creates relationship objects from similarity scores
     */
    private createRelationships(
        sourceId: string,
        similarities: SimilarityScore[],
        options: RelationshipDetectionOptions
    ): ContentRelationship[] {
        return similarities.map(similarity => ({
            id: `${sourceId}-${similarity.contentId}-${Date.now()}`,
            sourceId,
            targetId: similarity.contentId,
            type: this.determineRelationshipType(similarity.score, similarity.reasons),
            strength: similarity.score,
            confidence: this.calculateConfidence(similarity.score, similarity.reasons.length),
            createdAt: new Date(),
            lastUpdated: new Date()
        }));
    }

    /**
     * Determines relationship type based on similarity score and reasons
     */
    private determineRelationshipType(
        score: number,
        reasons: string[]
    ): ContentRelationship['type'] {
        // High similarity with concept overlap suggests building upon
        if (score > 0.7 && reasons.some(r => r.includes('concepts'))) {
            return 'builds_on';
        }

        // Same category with high similarity
        if (score > 0.6 && reasons.some(r => r.includes('category'))) {
            return 'similar';
        }

        // Medium to high similarity
        if (score > 0.5) {
            return 'related';
        }

        // Default for lower similarities
        return 'related';
    }

    /**
     * Calculates confidence score for relationship
     */
    private calculateConfidence(score: number, reasonCount: number): number {
        // Base confidence on similarity score
        let confidence = score;

        // Boost confidence if multiple reasons support the relationship
        if (reasonCount > 1) {
            confidence = Math.min(1, confidence + (reasonCount - 1) * 0.1);
        }

        return Math.round(confidence * 100) / 100; // Round to 2 decimal places
    }
}