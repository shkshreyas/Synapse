// Storage-specific type definitions for MindScribe

import { CapturedContent, PageMetadata } from './content';

export interface StoredContent extends CapturedContent {
    // AI-generated metadata
    summaries?: ContentSummaries;
    concepts?: string[];
    tags?: string[];
    category?: string;
    importance?: number; // 1-10 scale

    // User interaction data
    timesAccessed: number;
    lastAccessed: Date;
    userNotes?: string;
    userRating?: number; // 1-5 scale

    // Knowledge graph data
    graphPosition?: { x: number; y: number };
    clusterGroup?: string;

    // Sync data
    syncedToCloud: boolean;
    cloudAnalysisComplete: boolean;
    lastModified: Date;

    // Storage metadata
    storageSize: number; // Size in bytes
    version: number; // For schema migrations
}

export interface ContentSummaries {
    tldr: string;        // 1 sentence
    quick: string;       // 2-3 sentences
    detailed: string;    // 1 paragraph
}

export interface SearchIndexEntry {
    id: string;
    contentId: string;
    terms: string[];
    title: string;
    content: string;
    metadata: SearchableMetadata;
    lastUpdated: Date;
}

export interface SearchableMetadata {
    category?: string;
    tags?: string[];
    concepts?: string[];
    author?: string;
    pageType: string;
    language: string;
    readingTime: number;
    importance?: number;
}

export interface ContentRelationship {
    id: string;
    sourceId: string;
    targetId: string;
    type: 'similar' | 'builds_on' | 'contradicts' | 'references' | 'related';
    strength: number; // 0-1
    confidence: number; // 0-1
    createdAt: Date;
    lastUpdated: Date;
}

export interface StorageSettings {
    key: string;
    value: any;
    lastModified: Date;
}

export interface StorageQuotaInfo {
    used: number;
    available: number;
    percentage: number;
    warningThreshold: number; // Percentage at which to warn user
    cleanupThreshold: number; // Percentage at which to auto-cleanup
}

export interface CleanupCriteria {
    maxAge?: number; // Days
    minAccessCount?: number;
    minImportance?: number;
    excludeUserRated?: boolean;
    excludeUserNotes?: boolean;
}

export interface StorageStats {
    totalItems: number;
    totalSize: number;
    averageSize: number;
    oldestItem: Date;
    newestItem: Date;
    mostAccessed: string; // Content ID
    categories: Record<string, number>;
    languages: Record<string, number>;
}

// Validation interfaces
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
}

export interface ValidationWarning {
    field: string;
    message: string;
    code: string;
}

// Storage operation results
export interface StorageOperationResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    operationTime: number;
}

export interface BulkOperationResult<T = any> {
    success: boolean;
    successCount: number;
    failureCount: number;
    results: StorageOperationResult<T>[];
    totalTime: number;
}