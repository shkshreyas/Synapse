// Non-intrusive notification system for content suggestions

import { ContextualSuggestion } from './contextIntegration.js';

export interface NotificationOptions {
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
    duration: number; // milliseconds, 0 for persistent
    style: 'minimal' | 'detailed' | 'contextual';
    enableSound: boolean;
    enableAnimation: boolean;
    maxConcurrentNotifications: number;
    stackDirection: 'up' | 'down';
}

export interface NotificationState {
    id: string;
    suggestion: ContextualSuggestion;
    element: HTMLElement;
    createdAt: Date;
    isVisible: boolean;
    isDismissed: boolean;
    userInteracted: boolean;
}

export interface NotificationInteraction {
    notificationId: string;
    action: 'viewed' | 'clicked' | 'dismissed' | 'expired' | 'hovered';
    timestamp: Date;
    timeVisible: number; // milliseconds
    dismissalReason?: 'manual' | 'timeout' | 'new_page' | 'user_request';
}

export class NotificationSystem {
    private notifications: Map<string, NotificationState> = new Map();
    private container: HTMLElement | null = null;
    private styleSheet: CSSStyleSheet | null = null;
    private interactionCallbacks: Array<(interaction: NotificationInteraction) => void> = [];

    private readonly defaultOptions: NotificationOptions = {
        position: 'top-right',
        duration: 8000, // 8 seconds
        style: 'contextual',
        enableSound: false,
        enableAnimation: true,
        maxConcurrentNotifications: 3,
        stackDirection: 'down'
    };

    constructor(options: Partial<NotificationOptions> = {}) {
        this.defaultOptions = { ...this.defaultOptions, ...options };
        this.initialize();
    }

    /**
     * Shows a suggestion notification
     */
    showSuggestion(
        suggestion: ContextualSuggestion,
        options: Partial<NotificationOptions> = {}
    ): string {
        const config = { ...this.defaultOptions, ...options };
        const notificationId = this.generateNotificationId();

        // Check if we've reached the maximum concurrent notifications
        this.enforceMaxConcurrentNotifications(config.maxConcurrentNotifications);

        // Create notification element
        const element = this.createNotificationElement(suggestion, config);

        // Create notification state
        const notification: NotificationState = {
            id: notificationId,
            suggestion,
            element,
            createdAt: new Date(),
            isVisible: false,
            isDismissed: false,
            userInteracted: false
        };

        // Add to container
        if (this.container) {
            this.container.appendChild(element);
        }

        // Store notification
        this.notifications.set(notificationId, notification);

        // Show with animation
        this.showNotification(notification, config);

        // Set up auto-dismiss timer
        if (config.duration > 0) {
            setTimeout(() => {
                this.dismissNotification(notificationId, 'timeout');
            }, config.duration);
        }

        // Play sound if enabled
        if (config.enableSound) {
            this.playNotificationSound();
        }

        return notificationId;
    }

    /**
     * Dismisses a specific notification
     */
    dismissNotification(notificationId: string, reason: NotificationInteraction['dismissalReason'] = 'manual'): void {
        const notification = this.notifications.get(notificationId);
        if (!notification || notification.isDismissed) return;

        notification.isDismissed = true;

        // Record interaction
        this.recordInteraction(notification, 'dismissed', reason);

        // Hide with animation
        this.hideNotification(notification, () => {
            // Remove from DOM and map
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(notificationId);
        });
    }

    /**
     * Dismisses all notifications
     */
    dismissAllNotifications(reason: NotificationInteraction['dismissalReason'] = 'user_request'): void {
        const notificationIds = Array.from(this.notifications.keys());
        notificationIds.forEach(id => this.dismissNotification(id, reason));
    }

    /**
     * Gets all active notifications
     */
    getActiveNotifications(): NotificationState[] {
        return Array.from(this.notifications.values()).filter(n => !n.isDismissed);
    }

    /**
     * Adds a callback for notification interactions
     */
    onInteraction(callback: (interaction: NotificationInteraction) => void): void {
        this.interactionCallbacks.push(callback);
    }

    /**
     * Removes a callback for notification interactions
     */
    offInteraction(callback: (interaction: NotificationInteraction) => void): void {
        const index = this.interactionCallbacks.indexOf(callback);
        if (index > -1) {
            this.interactionCallbacks.splice(index, 1);
        }
    }

    /**
     * Updates notification options
     */
    updateOptions(options: Partial<NotificationOptions>): void {
        Object.assign(this.defaultOptions, options);
        this.updateContainerPosition();
    }

    /**
     * Initializes the notification system
     */
    private initialize(): void {
        this.createContainer();
        this.injectStyles();
        this.setupEventListeners();
    }

    /**
     * Creates the notification container
     */
    private createContainer(): void {
        this.container = document.createElement('div');
        this.container.id = 'mindscribe-notifications';
        this.container.className = 'mindscribe-notification-container';

        this.updateContainerPosition();

        document.body.appendChild(this.container);
    }

    /**
     * Updates container position based on options
     */
    private updateContainerPosition(): void {
        if (!this.container) return;

        // Reset classes
        this.container.className = 'mindscribe-notification-container';

        // Add position class
        this.container.classList.add(`position-${this.defaultOptions.position}`);
        this.container.classList.add(`stack-${this.defaultOptions.stackDirection}`);
    }

    /**
     * Injects CSS styles for notifications
     */
    private injectStyles(): void {
        const style = document.createElement('style');
        style.textContent = this.getNotificationCSS();
        document.head.appendChild(style);
    }

    /**
     * Gets CSS styles for notifications
     */
    private getNotificationCSS(): string {
        return `
            .mindscribe-notification-container {
                position: fixed;
                z-index: 10000;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .mindscribe-notification-container.position-top-right {
                top: 20px;
                right: 20px;
            }
            
            .mindscribe-notification-container.position-top-left {
                top: 20px;
                left: 20px;
            }
            
            .mindscribe-notification-container.position-bottom-right {
                bottom: 20px;
                right: 20px;
            }
            
            .mindscribe-notification-container.position-bottom-left {
                bottom: 20px;
                left: 20px;
            }
            
            .mindscribe-notification-container.position-center {
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            
            .mindscribe-notification {
                pointer-events: auto;
                background: #ffffff;
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                margin-bottom: 12px;
                max-width: 380px;
                min-width: 300px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
            }
            
            .mindscribe-notification.visible {
                opacity: 1;
                transform: translateX(0);
            }
            
            .mindscribe-notification.hiding {
                opacity: 0;
                transform: translateX(100%);
            }
            
            .mindscribe-notification-header {
                padding: 12px 16px 8px;
                border-bottom: 1px solid #f0f0f0;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .mindscribe-notification-title {
                font-size: 14px;
                font-weight: 600;
                color: #1a1a1a;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .mindscribe-notification-icon {
                width: 16px;
                height: 16px;
                background: #4f46e5;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 10px;
                font-weight: bold;
            }
            
            .mindscribe-notification-close {
                background: none;
                border: none;
                font-size: 18px;
                color: #6b7280;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            
            .mindscribe-notification-close:hover {
                background-color: #f3f4f6;
            }
            
            .mindscribe-notification-body {
                padding: 12px 16px;
            }
            
            .mindscribe-notification-content-title {
                font-size: 13px;
                font-weight: 500;
                color: #374151;
                margin: 0 0 4px 0;
                line-height: 1.4;
            }
            
            .mindscribe-notification-content-snippet {
                font-size: 12px;
                color: #6b7280;
                margin: 0 0 8px 0;
                line-height: 1.4;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            
            .mindscribe-notification-meta {
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 11px;
                color: #9ca3af;
                margin-bottom: 8px;
            }
            
            .mindscribe-notification-relevance {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .mindscribe-notification-relevance-bar {
                width: 40px;
                height: 3px;
                background: #e5e7eb;
                border-radius: 2px;
                overflow: hidden;
            }
            
            .mindscribe-notification-relevance-fill {
                height: 100%;
                background: #10b981;
                transition: width 0.3s ease;
            }
            
            .mindscribe-notification-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }
            
            .mindscribe-notification-action {
                padding: 6px 12px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                background: #ffffff;
                color: #374151;
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                text-decoration: none;
                display: inline-block;
            }
            
            .mindscribe-notification-action:hover {
                background: #f9fafb;
                border-color: #9ca3af;
            }
            
            .mindscribe-notification-action.primary {
                background: #4f46e5;
                color: white;
                border-color: #4f46e5;
            }
            
            .mindscribe-notification-action.primary:hover {
                background: #4338ca;
                border-color: #4338ca;
            }
            
            .mindscribe-notification-reasons {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid #f0f0f0;
            }
            
            .mindscribe-notification-reasons-title {
                font-size: 10px;
                font-weight: 600;
                color: #6b7280;
                margin: 0 0 4px 0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .mindscribe-notification-reasons-list {
                font-size: 11px;
                color: #9ca3af;
                margin: 0;
                line-height: 1.3;
            }
            
            .mindscribe-notification.style-minimal .mindscribe-notification-body {
                padding: 8px 12px;
            }
            
            .mindscribe-notification.style-minimal .mindscribe-notification-meta,
            .mindscribe-notification.style-minimal .mindscribe-notification-reasons {
                display: none;
            }
            
            .mindscribe-notification.priority-high {
                border-left: 4px solid #ef4444;
            }
            
            .mindscribe-notification.priority-medium {
                border-left: 4px solid #f59e0b;
            }
            
            .mindscribe-notification.priority-low {
                border-left: 4px solid #10b981;
            }
            
            @media (max-width: 480px) {
                .mindscribe-notification-container {
                    left: 10px !important;
                    right: 10px !important;
                    top: 10px !important;
                }
                
                .mindscribe-notification {
                    max-width: none;
                    min-width: auto;
                }
            }
        `;
    }

    /**
     * Creates a notification element
     */
    private createNotificationElement(
        suggestion: ContextualSuggestion,
        options: NotificationOptions
    ): HTMLElement {
        const notification = document.createElement('div');
        notification.className = `mindscribe-notification style-${options.style} priority-${suggestion.priority}`;

        // Header
        const header = document.createElement('div');
        header.className = 'mindscribe-notification-header';

        const title = document.createElement('h4');
        title.className = 'mindscribe-notification-title';
        title.innerHTML = `
            <span class="mindscribe-notification-icon">M</span>
            Related Content
        `;

        const closeButton = document.createElement('button');
        closeButton.className = 'mindscribe-notification-close';
        closeButton.innerHTML = '×';
        closeButton.title = 'Dismiss';

        header.appendChild(title);
        header.appendChild(closeButton);

        // Body
        const body = document.createElement('div');
        body.className = 'mindscribe-notification-body';

        const contentTitle = document.createElement('h5');
        contentTitle.className = 'mindscribe-notification-content-title';
        contentTitle.textContent = suggestion.content.title;

        const contentSnippet = document.createElement('p');
        contentSnippet.className = 'mindscribe-notification-content-snippet';
        contentSnippet.textContent = this.generateContentSnippet(suggestion.content.content);

        body.appendChild(contentTitle);
        body.appendChild(contentSnippet);

        // Meta information (for detailed and contextual styles)
        if (options.style !== 'minimal') {
            const meta = document.createElement('div');
            meta.className = 'mindscribe-notification-meta';

            const relevance = document.createElement('div');
            relevance.className = 'mindscribe-notification-relevance';
            relevance.innerHTML = `
                <span>Relevance:</span>
                <div class="mindscribe-notification-relevance-bar">
                    <div class="mindscribe-notification-relevance-fill" style="width: ${suggestion.relevanceScore * 100}%"></div>
                </div>
                <span>${Math.round(suggestion.relevanceScore * 100)}%</span>
            `;

            const timing = document.createElement('span');
            timing.textContent = `${suggestion.suggestedTiming.urgency} priority`;

            meta.appendChild(relevance);
            meta.appendChild(timing);
            body.appendChild(meta);
        }

        // Actions
        const actions = document.createElement('div');
        actions.className = 'mindscribe-notification-actions';

        const viewAction = document.createElement('a');
        viewAction.className = 'mindscribe-notification-action primary';
        viewAction.textContent = 'View';
        viewAction.href = suggestion.content.url;
        viewAction.target = '_blank';

        const dismissAction = document.createElement('button');
        dismissAction.className = 'mindscribe-notification-action';
        dismissAction.textContent = 'Dismiss';

        actions.appendChild(viewAction);
        actions.appendChild(dismissAction);
        body.appendChild(actions);

        // Reasons (for contextual style)
        if (options.style === 'contextual' && suggestion.matchReasons.length > 0) {
            const reasons = document.createElement('div');
            reasons.className = 'mindscribe-notification-reasons';

            const reasonsTitle = document.createElement('h6');
            reasonsTitle.className = 'mindscribe-notification-reasons-title';
            reasonsTitle.textContent = 'Why this is relevant:';

            const reasonsList = document.createElement('p');
            reasonsList.className = 'mindscribe-notification-reasons-list';
            reasonsList.textContent = suggestion.matchReasons.join(', ');

            reasons.appendChild(reasonsTitle);
            reasons.appendChild(reasonsList);
            body.appendChild(reasons);
        }

        notification.appendChild(header);
        notification.appendChild(body);

        // Set up event listeners
        this.setupNotificationEventListeners(notification, suggestion);

        return notification;
    }

    /**
     * Sets up event listeners for a notification
     */
    private setupNotificationEventListeners(element: HTMLElement, suggestion: ContextualSuggestion): void {
        const notificationId = this.findNotificationIdByElement(element);
        if (!notificationId) return;

        // Close button
        const closeButton = element.querySelector('.mindscribe-notification-close') as HTMLElement;
        if (closeButton) {
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dismissNotification(notificationId, 'manual');
            });
        }

        // Dismiss action
        const dismissAction = element.querySelector('.mindscribe-notification-action:not(.primary)') as HTMLElement;
        if (dismissAction) {
            dismissAction.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dismissNotification(notificationId, 'manual');
            });
        }

        // View action
        const viewAction = element.querySelector('.mindscribe-notification-action.primary') as HTMLElement;
        if (viewAction) {
            viewAction.addEventListener('click', () => {
                const notification = this.notifications.get(notificationId);
                if (notification) {
                    notification.userInteracted = true;
                    this.recordInteraction(notification, 'clicked');
                }
            });
        }

        // Hover tracking
        let hoverStartTime: number | null = null;

        element.addEventListener('mouseenter', () => {
            hoverStartTime = Date.now();
            const notification = this.notifications.get(notificationId);
            if (notification) {
                this.recordInteraction(notification, 'hovered');
            }
        });

        element.addEventListener('mouseleave', () => {
            if (hoverStartTime) {
                const hoverDuration = Date.now() - hoverStartTime;
                if (hoverDuration > 1000) { // Consider as "viewed" if hovered for more than 1 second
                    const notification = this.notifications.get(notificationId);
                    if (notification) {
                        notification.userInteracted = true;
                        this.recordInteraction(notification, 'viewed');
                    }
                }
                hoverStartTime = null;
            }
        });
    }

    /**
     * Shows a notification with animation
     */
    private showNotification(notification: NotificationState, options: NotificationOptions): void {
        notification.isVisible = true;

        if (options.enableAnimation) {
            // Trigger reflow to ensure initial state is applied
            notification.element.offsetHeight;

            // Add visible class for animation
            requestAnimationFrame(() => {
                notification.element.classList.add('visible');
            });
        } else {
            notification.element.classList.add('visible');
        }
    }

    /**
     * Hides a notification with animation
     */
    private hideNotification(notification: NotificationState, callback: () => void): void {
        notification.isVisible = false;
        notification.element.classList.add('hiding');

        if (this.defaultOptions.enableAnimation) {
            setTimeout(callback, 300); // Match CSS transition duration
        } else {
            callback();
        }
    }

    /**
     * Enforces maximum concurrent notifications
     */
    private enforceMaxConcurrentNotifications(maxNotifications: number): void {
        const activeNotifications = this.getActiveNotifications();

        if (activeNotifications.length >= maxNotifications) {
            // Dismiss oldest notifications
            const sortedNotifications = activeNotifications
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

            const toRemove = sortedNotifications.slice(0, activeNotifications.length - maxNotifications + 1);
            toRemove.forEach(notification => {
                this.dismissNotification(notification.id, 'new_page');
            });
        }
    }

    /**
     * Records a user interaction with a notification
     */
    private recordInteraction(
        notification: NotificationState,
        action: NotificationInteraction['action'],
        dismissalReason?: NotificationInteraction['dismissalReason']
    ): void {
        const timeVisible = Date.now() - notification.createdAt.getTime();

        const interaction: NotificationInteraction = {
            notificationId: notification.id,
            action,
            timestamp: new Date(),
            timeVisible,
            dismissalReason
        };

        // Notify callbacks
        this.interactionCallbacks.forEach(callback => {
            try {
                callback(interaction);
            } catch (error) {
                console.error('Error in notification interaction callback:', error);
            }
        });
    }

    /**
     * Generates a content snippet for display
     */
    private generateContentSnippet(content: string): string {
        const maxLength = 120;
        if (content.length <= maxLength) {
            return content;
        }

        // Find a good breaking point (end of sentence or word)
        const truncated = content.substring(0, maxLength);
        const lastSentence = truncated.lastIndexOf('.');
        const lastSpace = truncated.lastIndexOf(' ');

        const breakPoint = lastSentence > maxLength - 50 ? lastSentence + 1 : lastSpace;

        return content.substring(0, breakPoint) + '...';
    }

    /**
     * Plays notification sound
     */
    private playNotificationSound(): void {
        try {
            // Create a subtle notification sound using Web Audio API
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            // Fallback: no sound if Web Audio API is not available
            console.warn('Could not play notification sound:', error);
        }
    }

    /**
     * Sets up global event listeners
     */
    private setupEventListeners(): void {
        // Dismiss notifications on page navigation
        window.addEventListener('beforeunload', () => {
            this.dismissAllNotifications('new_page');
        });

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Pause timers when page is hidden
                // Implementation would depend on specific requirements
            }
        });
    }

    /**
     * Generates a unique notification ID
     */
    private generateNotificationId(): string {
        return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Finds notification ID by element (helper method)
     */
    private findNotificationIdByElement(element: HTMLElement): string | null {
        for (const [id, notification] of this.notifications) {
            if (notification.element === element) {
                return id;
            }
        }
        return null;
    }

    /**
     * Cleanup method to remove all notifications and event listeners
     */
    destroy(): void {
        this.dismissAllNotifications('user_request');

        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        this.notifications.clear();
        this.interactionCallbacks = [];
    }
}

// Export singleton instance
export const notificationSystem = new NotificationSystem();