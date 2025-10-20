private async handleCapture(): Promise<void> {
    try {
        // Show loading state
        if (this.statusElement) {
            this.statusElement.textContent = 'Capturing...';
            this.statusElement.style.display = 'block';
        }
        if (this.captureButton) {
            this.captureButton.disabled = true;
        }

        // Get current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];

        if (!currentTab || !currentTab.id) {
            throw new Error('No active tab found');
        }

        // Send capture request to content script
        const response = await MessageHandler.sendMessage({
            type: 'CAPTURE_CONTENT',
            data: { tabId: currentTab.id }
        });

        if (response.error) {
            throw new Error(response.error);
        }

        // Show success message
        if (this.statusElement) {
            this.statusElement.textContent = 'Content captured!';
            this.statusElement.style.color = '#4CAF50';
            setTimeout(() => {
                if (this.statusElement) {
                    this.statusElement.style.display = 'none';
                }
            }, 2000);
        }

        // Refresh recent captures
        await this.loadRecentCaptures();
    } catch (error) {
        console.error('Capture failed:', error);
        if (this.statusElement) {
            this.statusElement.textContent = `Capture failed: ${error.message}`;
            this.statusElement.style.color = '#f44336';
        }
    } finally {
        if (this.captureButton) {
            this.captureButton.disabled = false;
        }
    }
}