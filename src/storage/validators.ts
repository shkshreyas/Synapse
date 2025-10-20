// Data validation utilities for storage operations

import { CapturedContent } from '../types/content';
import { StoredContent, ValidationResult, ValidationError, ValidationWarning } from '../types/storage';

export function validateContent(content: CapturedContent | StoredContent): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required field validations
    if (!content.id || typeof content.id !== 'string' || content.id.trim().length === 0) {
        errors.push({
            field: 'id',
            message: 'Content ID is required and must be a non-empty string',
            code: 'REQUIRED_FIELD'
        });
    }

    if (!content.url || typeof content.url !== 'string') {
        errors.push({
            field: 'url',
            message: 'URL is required and must be a string',
            code: 'REQUIRED_FIELD'
        });
    } else if (!isValidUrl(content.url)) {
        errors.push({
            field: 'url',
            message: 'URL must be a valid HTTP or HTTPS URL',
            code: 'INVALID_FORMAT'
        });
    }

    if (!content.title || typeof content.title !== 'string' || content.title.trim().length === 0) {
        errors.push({
            field: 'title',
            message: 'Title is required and must be a non-empty string',
            code: 'REQUIRED_FIELD'
        });
    }

    if (!content.content || typeof content.content !== 'string') {
        errors.push({
            field: 'content',
            message: 'Content is required and must be a string',
            code: 'REQUIRED_FIELD'
        });
    } else if (content.content.length < 10) {
        warnings.push({
            field: 'content',
            message: 'Content is very short (less than 10 characters)',
            code: 'SHORT_CONTENT'
        });
    }

    if (!content.timestamp || !(content.timestamp instanceof Date)) {
        errors.push({
            field: 'timestamp',
            message: 'Timestamp is required and must be a Date object',
            code: 'REQUIRED_FIELD'
        });
    } else if (content.timestamp > new Date()) {
        errors.push({
            field: 'timestamp',
            message: 'Timestamp cannot be in the future',
            code: 'INVALID_VALUE'
        });
    }

    if (!content.captureMethod || !['manual', 'auto', 'highlight'].includes(content.captureMethod)) {
        errors.push({
            field: 'captureMethod',
            message: 'Capture method must be one of: manual, auto, highlight',
            code: 'INVALID_VALUE'
        });
    }

    // Metadata validation
    if (!content.metadata) {
        errors.push({
            field: 'metadata',
            message: 'Metadata is required',
            code: 'REQUIRED_FIELD'
        });
    } else {
        const metadataValidation = validateMetadata(content.metadata);
        errors.push(...metadataValidation.errors);
        warnings.push(...metadataValidation.warnings);
    }

    // Screenshot validation
    if (content.screenshot !== undefined) {
        if (typeof content.screenshot !== 'string') {
            errors.push({
                field: 'screenshot',
                message: 'Screenshot must be a string (base64 or URL)',
                code: 'INVALID_TYPE'
            });
        } else if (content.screenshot.length > 10 * 1024 * 1024) { // 10MB limit
            warnings.push({
                field: 'screenshot',
                message: 'Screenshot is very large (>10MB), consider compression',
                code: 'LARGE_DATA'
            });
        }
    }

    // StoredContent specific validations
    if ('timesAccessed' in content) {
        const storedContent = content as StoredContent;

        if (typeof storedContent.timesAccessed !== 'number' || storedContent.timesAccessed < 0) {
            errors.push({
                field: 'timesAccessed',
                message: 'Times accessed must be a non-negative number',
                code: 'INVALID_VALUE'
            });
        }

        if (!(storedContent.lastAccessed instanceof Date)) {
            errors.push({
                field: 'lastAccessed',
                message: 'Last accessed must be a Date object',
                code: 'INVALID_TYPE'
            });
        }

        if (!(storedContent.lastModified instanceof Date)) {
            errors.push({
                field: 'lastModified',
                message: 'Last modified must be a Date object',
                code: 'INVALID_TYPE'
            });
        }

        if (typeof storedContent.syncedToCloud !== 'boolean') {
            errors.push({
                field: 'syncedToCloud',
                message: 'Synced to cloud must be a boolean',
                code: 'INVALID_TYPE'
            });
        }

        if (typeof storedContent.cloudAnalysisComplete !== 'boolean') {
            errors.push({
                field: 'cloudAnalysisComplete',
                message: 'Cloud analysis complete must be a boolean',
                code: 'INVALID_TYPE'
            });
        }

        if (typeof storedContent.storageSize !== 'number' || storedContent.storageSize < 0) {
            errors.push({
                field: 'storageSize',
                message: 'Storage size must be a non-negative number',
                code: 'INVALID_VALUE'
            });
        }

        if (typeof storedContent.version !== 'number' || storedContent.version < 1) {
            errors.push({
                field: 'version',
                message: 'Version must be a positive number',
                code: 'INVALID_VALUE'
            });
        }

        // Optional field validations
        if (storedContent.importance !== undefined) {
            if (typeof storedContent.importance !== 'number' ||
                storedContent.importance < 1 ||
                storedContent.importance > 10) {
                errors.push({
                    field: 'importance',
                    message: 'Importance must be a number between 1 and 10',
                    code: 'INVALID_RANGE'
                });
            }
        }

        if (storedContent.userRating !== undefined) {
            if (typeof storedContent.userRating !== 'number' ||
                storedContent.userRating < 1 ||
                storedContent.userRating > 5) {
                errors.push({
                    field: 'userRating',
                    message: 'User rating must be a number between 1 and 5',
                    code: 'INVALID_RANGE'
                });
            }
        }

        if (storedContent.tags !== undefined) {
            if (!Array.isArray(storedContent.tags)) {
                errors.push({
                    field: 'tags',
                    message: 'Tags must be an array',
                    code: 'INVALID_TYPE'
                });
            } else if (storedContent.tags.some(tag => typeof tag !== 'string')) {
                errors.push({
                    field: 'tags',
                    message: 'All tags must be strings',
                    code: 'INVALID_TYPE'
                });
            }
        }

        if (storedContent.concepts !== undefined) {
            if (!Array.isArray(storedContent.concepts)) {
                errors.push({
                    field: 'concepts',
                    message: 'Concepts must be an array',
                    code: 'INVALID_TYPE'
                });
            } else if (storedContent.concepts.some(concept => typeof concept !== 'string')) {
                errors.push({
                    field: 'concepts',
                    message: 'All concepts must be strings',
                    code: 'INVALID_TYPE'
                });
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

function validateMetadata(metadata: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (typeof metadata.readingTime !== 'number' || metadata.readingTime < 0) {
        errors.push({
            field: 'metadata.readingTime',
            message: 'Reading time must be a non-negative number',
            code: 'INVALID_VALUE'
        });
    }

    if (!metadata.pageType || !['article', 'video', 'documentation', 'social', 'other'].includes(metadata.pageType)) {
        errors.push({
            field: 'metadata.pageType',
            message: 'Page type must be one of: article, video, documentation, social, other',
            code: 'INVALID_VALUE'
        });
    }

    if (!metadata.language || typeof metadata.language !== 'string') {
        errors.push({
            field: 'metadata.language',
            message: 'Language is required and must be a string',
            code: 'REQUIRED_FIELD'
        });
    }

    if (typeof metadata.wordCount !== 'number' || metadata.wordCount < 0) {
        errors.push({
            field: 'metadata.wordCount',
            message: 'Word count must be a non-negative number',
            code: 'INVALID_VALUE'
        });
    }

    if (typeof metadata.imageCount !== 'number' || metadata.imageCount < 0) {
        errors.push({
            field: 'metadata.imageCount',
            message: 'Image count must be a non-negative number',
            code: 'INVALID_VALUE'
        });
    }

    if (typeof metadata.linkCount !== 'number' || metadata.linkCount < 0) {
        errors.push({
            field: 'metadata.linkCount',
            message: 'Link count must be a non-negative number',
            code: 'INVALID_VALUE'
        });
    }

    // Optional fields
    if (metadata.author !== undefined && typeof metadata.author !== 'string') {
        errors.push({
            field: 'metadata.author',
            message: 'Author must be a string',
            code: 'INVALID_TYPE'
        });
    }

    if (metadata.publishDate !== undefined && !(metadata.publishDate instanceof Date)) {
        errors.push({
            field: 'metadata.publishDate',
            message: 'Publish date must be a Date object',
            code: 'INVALID_TYPE'
        });
    }

    if (metadata.description !== undefined && typeof metadata.description !== 'string') {
        errors.push({
            field: 'metadata.description',
            message: 'Description must be a string',
            code: 'INVALID_TYPE'
        });
    }

    if (metadata.keywords !== undefined) {
        if (!Array.isArray(metadata.keywords)) {
            errors.push({
                field: 'metadata.keywords',
                message: 'Keywords must be an array',
                code: 'INVALID_TYPE'
            });
        } else if (metadata.keywords.some((keyword: any) => typeof keyword !== 'string')) {
            errors.push({
                field: 'metadata.keywords',
                message: 'All keywords must be strings',
                code: 'INVALID_TYPE'
            });
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

function isValidUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        return false;
    }
}

export function validateSearchQuery(query: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!query || typeof query !== 'string') {
        errors.push({
            field: 'query',
            message: 'Search query is required and must be a string',
            code: 'REQUIRED_FIELD'
        });
    } else {
        const trimmedQuery = query.trim();

        if (trimmedQuery.length === 0) {
            errors.push({
                field: 'query',
                message: 'Search query cannot be empty',
                code: 'EMPTY_VALUE'
            });
        } else if (trimmedQuery.length < 2) {
            warnings.push({
                field: 'query',
                message: 'Very short search queries may not return relevant results',
                code: 'SHORT_QUERY'
            });
        } else if (trimmedQuery.length > 500) {
            warnings.push({
                field: 'query',
                message: 'Very long search queries may be truncated',
                code: 'LONG_QUERY'
            });
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}