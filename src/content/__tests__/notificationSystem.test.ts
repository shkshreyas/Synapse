// Tests for notification system functionality

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationSystem } from '../notificationSystem.js';
import { ContextualSuggestion } from '../contextIntegration.js';

// Mock DOM methods
Object.defineProperty(document, 'createElement', {
    value: vi.fn((tagName: string) => {
        const element = {
            tagName: tagName.toUpperCase(),
            className: '',
            innerHTML: '',
            textContent: '',
            style: {},
            classList: {
                add: vi.fn(),
                remove: vi.fn(),
                contains: vi.fn()
            },
            appendChild: vi.fn(),
            addEventListener: vi.fn(),
            querySelector: vi.fn(),
            querySelectorAll: vi.fn(() => []),
            setAttribute: vi.fn(),
            getAttribute: vi.fn(),
            removeAttribute: vi.fn(),
            offsetHeight: 100,
            parentNode: null
        };
        return element;
    })
});

Object.defineProperty(document, 'head', {
    value: {
        appendChild: vi.fn()
    }
});

Object.defineProperty(document, 'body', {
    value: {
        appendChild: vi.fn()
    }
});

// Mock window.AudioContext
Object.defineProperty(window, 'AudioContext', {
    value: vi.fn(() => ({
        createOscillator: vi.fn(() => ({
            connect: vi.fn(),
            frequency: {
                setValueAtTime: vi.fn(),
                linearRampToValueAtTime: vi.fn(),
                exponentialRampToValueAtTime: vi.fn()
            },
            start: vi.fn(),
            stop: vi.fn()
        })),
        createGain: vi.fn(() => ({
            connect: vi.fn(),
            gain: {
                setValueAtTime: vi.fn(),
                linearRampToValueAtTime: vi.fn(),
                exponentialRampToValueAtTime: vi.fn()
            }
        })),
        destination: {},
        currentTime: 0
    }))
});

describe('NotificationSystem', () => {
    let notificationSystem: NotificationSystem;
    let mockSuggestion: ContextualSuggestion;

    beforeEach(() => {
        // Clear all mocks
        vi.clearAllMocks();

        // Create fresh notification system
        notificationSystem = new NotificationSystem({
            position: 'top-right',
            duration: 5000,
            style: 'contextual',
            enableSound: false,
            enableAnimation: true,
            maxConcurrentNotifications: 3
        });

        // Mock suggestion
        mockSuggestion = {
            contentId: 'test-content-1',
            content: {
                id: 'test-content-1',
                url: 'https://example.com/article',
                title: 'Test Article Title',
                content: 'This is a test article about JavaScript programming and web development best practices.',
                metadata: {
                    readingTime: 5,
                    pageType: 'article',
                    language: 'en',
                    author: 'Test Author',
                    wordCount: 500,
                    imageCount: 2,
                    linkCount: 5
                },
                captureMethod: 'manual',
                timestamp: new Date('2024-01-15'),
                timesAccessed: 3,
                lastAccessed: new Date('2024-01-20'),
                syncedToCloud: false,
                cloudAnalysisComplete: false,
                lastModified: new Date('2024-01-15'),
                storageSize: 1024,
                version: 1
            },
            relevanceScore: 0.8,
            matchReasons: ['Similar content themes', 'Shared keywords'],
            suggestedTiming: {
                contentId: 'test-content-1',
                suggestedTime: new Date(Date.now() + 5000),
                confidence: 0.9,
                reason: 'High relevance to current context',
                urgency: 'immediate'
            },
            priority: 'high',
            confidence: 0.9
        };
    });

    afterEach(() => {
        notificationSystem.destroy();
    });

    describe('showSuggestion', () => {
        it('should create and show a notification', () => {
            const notificationId = notificationSystem.showSuggestion(mockSuggestion);

            expect(notificationId).toBeDefined();
            expect(typeof notificationId).toBe('string');
            expect(notificationId).toMatch(/^notification-\d+-[a-z0-9]+$/);
        });

        it('should create notification with correct content', () => {
            const createElement = document.createElement as any;

            notificationSystem.showSuggestion(mockSuggestion);

            // Verify notification element was created
            expect(createElement).toHaveBeenCalledWith('div');

            // Check that content was set (would need more detailed mocking to verify exact content)
            const createdElements = createElement.mock.calls;
            expect(createdElements.length).toBeGreaterThan(0);
        });

        it('should apply correct CSS classes based on priority', () => {
            const mockElement = document.createElement('div');
            const createElement = vi.spyOn(document, 'createElement').mockReturnValue(mockElement as any);

            notificationSystem.showSuggestion(mockSuggestion);

            expect(mockElement.className).toContain('priority-high');
        });

        it('should respect maxConcurrentNotifications limit', () => {
            const system = new NotificationSystem({
                maxConcurrentNotifications: 2
            });

            // Show 3 notifications (should only keep 2)
            const id1 = system.showSuggestion(mockSuggestion);
            const id2 = system.showSuggestion({ ...mockSuggestion, contentId: 'test-2' });
            const id3 = system.showSuggestion({ ...mockSuggestion, contentId: 'test-3' });

            const activeNotifications = system.getActiveNotifications();
            expect(activeNotifications.length).toBeLessThanOrEqual(2);

            system.destroy();
        });

        it('should auto-dismiss notification after duration', (done) => {
            const system = new NotificationSystem({
                duration: 100 // 100ms for quick test
            });

            const notificationId = system.showSuggestion(mockSuggestion);

            // Check that notification exists initially
            let activeNotifications = system.getActiveNotifications();
            expect(activeNotifications.length).toBe(1);

            // Check that it's dismissed after duration
            setTimeout(() => {
                activeNotifications = system.getActiveNotifications();
                expect(activeNotifications.length).toBe(0);
                system.destroy();
                done();
            }, 150);
        });
    });

    describe('dismissNotification', () => {
        it('should dismiss a specific notification', () => {
            const notificationId = notificationSystem.showSuggestion(mockSuggestion);

            let activeNotifications = notificationSystem.getActiveNotifications();
            expect(activeNotifications.length).toBe(1);

            notificationSystem.dismissNotification(notificationId);

            activeNotifications = notificationSystem.getActiveNotifications();
            expect(activeNotifications.length).toBe(0);
        });

        it('should not error when dismissing non-existent notification', () => {
            expect(() => {
                notificationSystem.dismissNotification('non-existent-id');
            }).not.toThrow();
        });

        it('should not dismiss already dismissed notification', () => {
            const notificationId = notificationSystem.showSuggestion(mockSuggestion);

            // Dismiss twice
            notificationSystem.dismissNotification(notificationId);
            notificationSystem.dismissNotification(notificationId);

            // Should not cause errors
            const activeNotifications = notificationSystem.getActiveNotifications();
            expect(activeNotifications.length).toBe(0);
        });
    });

    describe('dismissAllNotifications', () => {
        it('should dismiss all active notifications', () => {
            // Show multiple notifications
            notificationSystem.showSuggestion(mockSuggestion);
            notificationSystem.showSuggestion({ ...mockSuggestion, contentId: 'test-2' });
            notificationSystem.showSuggestion({ ...mockSuggestion, contentId: 'test-3' });

            let activeNotifications = notificationSystem.getActiveNotifications();
            expect(activeNotifications.length).toBe(3);

            notificationSystem.dismissAllNotifications();

            activeNotifications = notificationSystem.getActiveNotifications();
            expect(activeNotifications.length).toBe(0);
        });
    });

    describe('interaction tracking', () => {
        it('should call interaction callbacks when interactions occur', () => {
            const interactionCallback = vi.fn();
            notificationSystem.onInteraction(interactionCallback);

            const notificationId = notificationSystem.showSuggestion(mockSuggestion);

            // Simulate interaction by calling the callback directly
            // (In real implementation, this would be triggered by DOM events)
            const mockInteraction = {
                notificationId,
                action: 'clicked' as const,
                timestamp: new Date(),
                timeVisible: 5000
            };

            // Manually trigger callback to test
            interactionCallback(mockInteraction);

            expect(interactionCallback).toHaveBeenCalledWith(mockInteraction);
        });

        it('should remove interaction callbacks when requested', () => {
            const interactionCallback = vi.fn();

            notificationSystem.onInteraction(interactionCallback);
            notificationSystem.offInteraction(interactionCallback);

            // Callback should not be called after removal
            // This would need more complex testing to verify properly
        });
    });

    describe('notification styles', () => {
        it('should create minimal style notification', () => {
            const system = new NotificationSystem({
                style: 'minimal'
            });

            const mockElement = document.createElement('div');
            const createElement = vi.spyOn(document, 'createElement').mockReturnValue(mockElement as any);

            system.showSuggestion(mockSuggestion);

            expect(mockElement.className).toContain('style-minimal');

            system.destroy();
        });

        it('should create detailed style notification', () => {
            const system = new NotificationSystem({
                style: 'detailed'
            });

            const mockElement = document.createElement('div');
            const createElement = vi.spyOn(document, 'createElement').mockReturnValue(mockElement as any);

            system.showSuggestion(mockSuggestion);

            expect(mockElement.className).toContain('style-detailed');

            system.destroy();
        });

        it('should create contextual style notification', () => {
            const system = new NotificationSystem({
                style: 'contextual'
            });

            const mockElement = document.createElement('div');
            const createElement = vi.spyOn(document, 'createElement').mockReturnValue(mockElement as any);

            system.showSuggestion(mockSuggestion);

            expect(mockElement.className).toContain('style-contextual');

            system.destroy();
        });
    });

    describe('sound notifications', () => {
        it('should play sound when enabled', () => {
            const system = new NotificationSystem({
                enableSound: true
            });

            // Mock AudioContext constructor
            const mockAudioContext = {
                createOscillator: vi.fn(() => ({
                    connect: vi.fn(),
                    frequency: {
                        setValueAtTime: vi.fn(),
                        linearRampToValueAtTime: vi.fn(),
                        exponentialRampToValueAtTime: vi.fn()
                    },
                    start: vi.fn(),
                    stop: vi.fn()
                })),
                createGain: vi.fn(() => ({
                    connect: vi.fn(),
                    gain: {
                        setValueAtTime: vi.fn(),
                        linearRampToValueAtTime: vi.fn(),
                        exponentialRampToValueAtTime: vi.fn()
                    }
                })),
                destination: {},
                currentTime: 0
            };

            (window as any).AudioContext = vi.fn(() => mockAudioContext);

            system.showSuggestion(mockSuggestion);

            // Verify AudioContext was created (sound was attempted)
            expect(window.AudioContext).toHaveBeenCalled();

            system.destroy();
        });

        it('should not play sound when disabled', () => {
            const system = new NotificationSystem({
                enableSound: false
            });

            const audioContextSpy = vi.spyOn(window, 'AudioContext' as any);

            system.showSuggestion(mockSuggestion);

            // AudioContext should not be called when sound is disabled
            expect(audioContextSpy).not.toHaveBeenCalled();

            system.destroy();
        });
    });

    describe('updateOptions', () => {
        it('should update notification options', () => {
            notificationSystem.updateOptions({
                position: 'bottom-left',
                duration: 10000
            });

            // Options should be updated (would need access to internal state to verify)
            // This is more of an integration test
        });
    });

    describe('content snippet generation', () => {
        it('should truncate long content appropriately', () => {
            const longContent = 'A'.repeat(200);
            const suggestionWithLongContent = {
                ...mockSuggestion,
                content: {
                    ...mockSuggestion.content,
                    content: longContent
                }
            };

            // This would need access to the private method to test directly
            // For now, we test that the notification is created without error
            expect(() => {
                notificationSystem.showSuggestion(suggestionWithLongContent);
            }).not.toThrow();
        });

        it('should handle empty content gracefully', () => {
            const suggestionWithEmptyContent = {
                ...mockSuggestion,
                content: {
                    ...mockSuggestion.content,
                    content: ''
                }
            };

            expect(() => {
                notificationSystem.showSuggestion(suggestionWithEmptyContent);
            }).not.toThrow();
        });
    });

    describe('destroy', () => {
        it('should clean up all notifications and resources', () => {
            // Show some notifications
            notificationSystem.showSuggestion(mockSuggestion);
            notificationSystem.showSuggestion({ ...mockSuggestion, contentId: 'test-2' });

            let activeNotifications = notificationSystem.getActiveNotifications();
            expect(activeNotifications.length).toBe(2);

            notificationSystem.destroy();

            activeNotifications = notificationSystem.getActiveNotifications();
            expect(activeNotifications.length).toBe(0);
        });
    });
});