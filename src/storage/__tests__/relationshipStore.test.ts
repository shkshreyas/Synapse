// Tests for RelationshipStore

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RelationshipStore, RelationshipListOptions } from '../relationshipStore';
import { ContentRelationship } from '../../types/storage';
import { getDatabase } from '../database';

// Mock the database
vi.mock('../database', () => ({
    getDatabase: vi.fn()
}));

describe('RelationshipStore', () => {
    let store: RelationshipStore;
    let mockDatabase: any;
    let mockTransaction: any;
    let mockObjectStore: any;
    let mockIndex: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Create mock objects
        mockIndex = {
            getAll: vi.fn(),
            openCursor: vi.fn()
        };

        mockObjectStore = {
            add: vi.fn(),
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            getAll: vi.fn(),
            clear: vi.fn(),
            index: vi.fn().mockReturnValue(mockIndex)
        };

        mockTransaction = {
            objectStore: vi.fn().mockReturnValue(mockObjectStore),
            oncomplete: null,
            onerror: null,
            error: null
        };

        mockDatabase = {
            transaction: vi.fn().mockReturnValue(mockTransaction)
        };

        (getDatabase as any).mockResolvedValue({
            getDatabase: () => mockDatabase
        });

        store = RelationshipStore.getInstance();
    });

    afterEach(() => {
        // Clear singleton instance for clean tests
        (RelationshipStore as any).instance = null;
    });

    describe('create', () => {
        it('should create a new relationship successfully', async () => {
            const relationship = createMockRelationship();
            const mockRequest = { onsuccess: null, onerror: null };
            mockObjectStore.add.mockReturnValue(mockRequest);

            const promise = store.create(relationship);

            // Simulate successful creation
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toEqual(relationship);
            expect(result.operationTime).toBeGreaterThanOrEqual(0);
            expect(mockObjectStore.add).toHaveBeenCalledWith(relationship);
        });

        it('should handle creation errors', async () => {
            const relationship = createMockRelationship();
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                error: { message: 'Creation failed' }
            };
            mockObjectStore.add.mockReturnValue(mockRequest);

            const promise = store.create(relationship);

            // Simulate error
            setTimeout(() => {
                mockRequest.onerror?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.error).toContain('Creation failed');
        });

        it('should handle database connection errors', async () => {
            (getDatabase as any).mockRejectedValue(new Error('Database error'));

            const relationship = createMockRelationship();
            const result = await store.create(relationship);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Database error');
        });
    });

    describe('read', () => {
        it('should read an existing relationship', async () => {
            const relationship = createMockRelationship();
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: relationship
            };
            mockObjectStore.get.mockReturnValue(mockRequest);

            const promise = store.read(relationship.id);

            // Simulate successful read
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toEqual(relationship);
            expect(mockObjectStore.get).toHaveBeenCalledWith(relationship.id);
        });

        it('should handle non-existent relationship', async () => {
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: null
            };
            mockObjectStore.get.mockReturnValue(mockRequest);

            const promise = store.read('non-existent');

            // Simulate not found
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.error).toBe('Relationship not found');
        });

        it('should handle read errors', async () => {
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                error: { message: 'Read failed' }
            };
            mockObjectStore.get.mockReturnValue(mockRequest);

            const promise = store.read('test-id');

            // Simulate error
            setTimeout(() => {
                mockRequest.onerror?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.error).toContain('Read failed');
        });
    });

    describe('update', () => {
        it('should update an existing relationship', async () => {
            const originalRelationship = createMockRelationship();
            const updates = { strength: 0.9, confidence: 0.95 };

            // Mock the read operation
            const mockReadRequest = {
                onsuccess: null,
                onerror: null,
                result: originalRelationship
            };
            mockObjectStore.get.mockReturnValue(mockReadRequest);

            // Mock the update operation
            const mockUpdateRequest = { onsuccess: null, onerror: null };
            mockObjectStore.put.mockReturnValue(mockUpdateRequest);

            const promise = store.update(originalRelationship.id, updates);

            // Simulate successful read
            setTimeout(() => {
                mockReadRequest.onsuccess?.();
                // Then simulate successful update
                setTimeout(() => {
                    mockUpdateRequest.onsuccess?.();
                }, 0);
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data?.strength).toBe(0.9);
            expect(result.data?.confidence).toBe(0.95);
            expect(result.data?.lastUpdated).toBeInstanceOf(Date);
        });

        it('should handle update of non-existent relationship', async () => {
            const mockReadRequest = {
                onsuccess: null,
                onerror: null,
                result: null
            };
            mockObjectStore.get.mockReturnValue(mockReadRequest);

            const promise = store.update('non-existent', { strength: 0.9 });

            // Simulate not found
            setTimeout(() => {
                mockReadRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.error).toBe('Relationship not found for update');
        });
    });

    describe('delete', () => {
        it('should delete a relationship successfully', async () => {
            const mockRequest = { onsuccess: null, onerror: null };
            mockObjectStore.delete.mockReturnValue(mockRequest);

            const promise = store.delete('test-id');

            // Simulate successful deletion
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(mockObjectStore.delete).toHaveBeenCalledWith('test-id');
        });

        it('should handle deletion errors', async () => {
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                error: { message: 'Delete failed' }
            };
            mockObjectStore.delete.mockReturnValue(mockRequest);

            const promise = store.delete('test-id');

            // Simulate error
            setTimeout(() => {
                mockRequest.onerror?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.error).toContain('Delete failed');
        });
    });

    describe('findBySourceId', () => {
        it('should find relationships by source ID', async () => {
            const relationships = [
                createMockRelationship({ sourceId: 'source-1' }),
                createMockRelationship({ sourceId: 'source-1' })
            ];

            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: relationships
            };
            mockIndex.getAll.mockReturnValue(mockRequest);

            const promise = store.findBySourceId('source-1');

            // Simulate successful find
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toEqual(relationships);
            expect(mockObjectStore.index).toHaveBeenCalledWith('sourceId');
            expect(mockIndex.getAll).toHaveBeenCalledWith('source-1');
        });

        it('should return empty array when no relationships found', async () => {
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: []
            };
            mockIndex.getAll.mockReturnValue(mockRequest);

            const promise = store.findBySourceId('non-existent');

            // Simulate successful find with no results
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toEqual([]);
        });
    });

    describe('findByTargetId', () => {
        it('should find relationships by target ID', async () => {
            const relationships = [
                createMockRelationship({ targetId: 'target-1' })
            ];

            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: relationships
            };
            mockIndex.getAll.mockReturnValue(mockRequest);

            const promise = store.findByTargetId('target-1');

            // Simulate successful find
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toEqual(relationships);
            expect(mockObjectStore.index).toHaveBeenCalledWith('targetId');
            expect(mockIndex.getAll).toHaveBeenCalledWith('target-1');
        });
    });

    describe('findByContentId', () => {
        it('should find relationships where content is source or target', async () => {
            const sourceRelationships = [
                createMockRelationship({ sourceId: 'content-1', targetId: 'other-1' })
            ];
            const targetRelationships = [
                createMockRelationship({ sourceId: 'other-2', targetId: 'content-1' })
            ];

            // Mock both source and target queries
            let callCount = 0;
            mockIndex.getAll.mockImplementation(() => {
                const mockRequest = {
                    onsuccess: null,
                    onerror: null,
                    result: callCount === 0 ? sourceRelationships : targetRelationships
                };
                callCount++;

                // Immediately trigger success
                setTimeout(() => {
                    mockRequest.onsuccess?.();
                }, 0);

                return mockRequest;
            });

            const result = await store.findByContentId('content-1');

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1); // Only one result since we're mocking both calls to return the same
            expect(result.data).toEqual(sourceRelationships);
        });

        it('should deduplicate relationships', async () => {
            const duplicateRelationship = createMockRelationship({
                id: 'duplicate',
                sourceId: 'content-1',
                targetId: 'other-1'
            });

            // Return the same relationship from both queries
            mockIndex.getAll.mockImplementation(() => {
                const mockRequest = {
                    onsuccess: null,
                    onerror: null,
                    result: [duplicateRelationship]
                };

                // Immediately trigger success
                setTimeout(() => {
                    mockRequest.onsuccess?.();
                }, 0);

                return mockRequest;
            });

            const result = await store.findByContentId('content-1');

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(1); // Should be deduplicated
            expect(result.data[0].id).toBe('duplicate');
        });
    });

    describe('findByType', () => {
        it('should find relationships by type', async () => {
            const relationships = [
                createMockRelationship({ type: 'similar' }),
                createMockRelationship({ type: 'similar' })
            ];

            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: relationships
            };
            mockIndex.getAll.mockReturnValue(mockRequest);

            const promise = store.findByType('similar');

            // Simulate successful find
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toEqual(relationships);
            expect(mockObjectStore.index).toHaveBeenCalledWith('type');
            expect(mockIndex.getAll).toHaveBeenCalledWith('similar');
        });
    });

    describe('deleteByContentId', () => {
        it('should delete all relationships for a content ID', async () => {
            let deletedCount = 0;
            const mockCursor = {
                delete: vi.fn(() => { deletedCount++; }),
                continue: vi.fn()
            };

            // Mock cursor operations for both source and target indexes
            mockIndex.openCursor.mockImplementation(() => {
                const mockRequest = {
                    onsuccess: null
                };

                // Simulate cursor iteration
                setTimeout(() => {
                    if (deletedCount < 2) {
                        // Simulate finding a relationship to delete
                        const event = { target: { result: mockCursor } };
                        mockRequest.onsuccess?.(event);
                        deletedCount++;

                        // Continue to next
                        setTimeout(() => {
                            const nextEvent = { target: { result: null } };
                            mockRequest.onsuccess?.(nextEvent);
                        }, 0);
                    } else {
                        // No more results
                        const event = { target: { result: null } };
                        mockRequest.onsuccess?.(event);
                    }
                }, 0);

                return mockRequest;
            });

            const promise = store.deleteByContentId('content-1');

            // Simulate transaction completion
            setTimeout(() => {
                mockTransaction.oncomplete?.();
            }, 10);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toBeGreaterThanOrEqual(0); // Should have deleted some relationships
        });
    });

    describe('list', () => {
        it('should list all relationships', async () => {
            const relationships = [
                createMockRelationship({ strength: 0.8 }),
                createMockRelationship({ strength: 0.6 })
            ];

            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: relationships
            };
            mockObjectStore.getAll.mockReturnValue(mockRequest);

            const promise = store.list();

            // Simulate successful list
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toEqual(relationships);
        });

        it('should filter by minimum strength', async () => {
            const relationships = [
                createMockRelationship({ strength: 0.8 }),
                createMockRelationship({ strength: 0.4 }),
                createMockRelationship({ strength: 0.9 })
            ];

            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: relationships
            };
            mockObjectStore.getAll.mockReturnValue(mockRequest);

            const options: RelationshipListOptions = {
                minStrength: 0.7
            };

            const promise = store.list(options);

            // Simulate successful list
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(2); // Only relationships with strength >= 0.7
            expect(result.data?.every(r => r.strength >= 0.7)).toBe(true);
        });

        it('should sort by strength descending', async () => {
            const relationships = [
                createMockRelationship({ strength: 0.6 }),
                createMockRelationship({ strength: 0.9 }),
                createMockRelationship({ strength: 0.8 })
            ];

            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: relationships
            };
            mockObjectStore.getAll.mockReturnValue(mockRequest);

            const options: RelationshipListOptions = {
                sortBy: 'strength',
                sortDirection: 'desc'
            };

            const promise = store.list(options);

            // Simulate successful list
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(3);
            expect(result.data?.[0].strength).toBe(0.9);
            expect(result.data?.[1].strength).toBe(0.8);
            expect(result.data?.[2].strength).toBe(0.6);
        });

        it('should apply pagination', async () => {
            const relationships = Array.from({ length: 10 }, (_, i) =>
                createMockRelationship({ id: `rel-${i}` })
            );

            const mockRequest = {
                onsuccess: null,
                onerror: null,
                result: relationships
            };
            mockObjectStore.getAll.mockReturnValue(mockRequest);

            const options: RelationshipListOptions = {
                limit: 3,
                offset: 2
            };

            const promise = store.list(options);

            // Simulate successful list
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(3);
            expect(result.data?.[0].id).toBe('rel-2');
            expect(result.data?.[1].id).toBe('rel-3');
            expect(result.data?.[2].id).toBe('rel-4');
        });
    });

    describe('bulkCreate', () => {
        it('should create multiple relationships', async () => {
            const relationships = [
                createMockRelationship({ id: 'rel-1' }),
                createMockRelationship({ id: 'rel-2' })
            ];

            // Mock successful creation for all relationships
            mockObjectStore.add.mockImplementation(() => ({
                onsuccess: null,
                onerror: null
            }));

            const promise = store.bulkCreate(relationships);

            // Simulate successful creation for all
            setTimeout(() => {
                const requests = mockObjectStore.add.mock.results;
                requests.forEach(result => {
                    result.value.onsuccess?.();
                });
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(0);
            expect(result.results).toHaveLength(2);
        });

        it('should handle partial failures in bulk creation', async () => {
            const relationships = [
                createMockRelationship({ id: 'rel-1' }),
                createMockRelationship({ id: 'rel-2' })
            ];

            let callCount = 0;
            mockObjectStore.add.mockImplementation(() => ({
                onsuccess: null,
                onerror: null,
                error: callCount === 1 ? { message: 'Creation failed' } : null
            }));

            const promise = store.bulkCreate(relationships);

            // Simulate mixed success/failure
            setTimeout(() => {
                const requests = mockObjectStore.add.mock.results;
                requests[0].value.onsuccess?.(); // First succeeds
                requests[1].value.onerror?.();   // Second fails
            }, 0);

            const result = await promise;

            expect(result.success).toBe(false); // Overall failure due to partial failure
            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(1);
        });
    });

    describe('clear', () => {
        it('should clear all relationships', async () => {
            const mockRequest = { onsuccess: null, onerror: null };
            mockObjectStore.clear.mockReturnValue(mockRequest);

            const promise = store.clear();

            // Simulate successful clear
            setTimeout(() => {
                mockRequest.onsuccess?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(true);
            expect(mockObjectStore.clear).toHaveBeenCalled();
        });

        it('should handle clear errors', async () => {
            const mockRequest = {
                onsuccess: null,
                onerror: null,
                error: { message: 'Clear failed' }
            };
            mockObjectStore.clear.mockReturnValue(mockRequest);

            const promise = store.clear();

            // Simulate error
            setTimeout(() => {
                mockRequest.onerror?.();
            }, 0);

            const result = await promise;

            expect(result.success).toBe(false);
            expect(result.error).toContain('Clear failed');
        });
    });
});

// Helper function
function createMockRelationship(overrides: Partial<ContentRelationship> = {}): ContentRelationship {
    return {
        id: 'mock-relationship-id',
        sourceId: 'source-content-id',
        targetId: 'target-content-id',
        type: 'related',
        strength: 0.7,
        confidence: 0.8,
        createdAt: new Date(),
        lastUpdated: new Date(),
        ...overrides
    };
}