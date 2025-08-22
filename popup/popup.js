/**
 * Threads Drafter - Popup Script
 * Handles popup interface interactions and settings management
 */

class ThreadsDrafterPopup {
  constructor() {
    this.settings = {
      isEnabled: true,
      sortOrder: 'earliest',
      autoSort: true,
      showTimeIndicators: true,
      showDraftCount: true
    };

    this.init();
  }

  /**
   * Initialize the popup
   */
  async init() {
    console.log('[Threads Drafter] Popup initialized');

    // Load current settings
    await this.loadSettings();

    // Setup event listeners
    this.setupEventListeners();

    // Update UI with current settings
    this.updateUI();

    // Load draft statistics
    await this.loadDraftStats();

    // Check if we're on threads.com
    this.checkThreadsTab();
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        isEnabled: true,
        sortOrder: 'earliest',
        autoSort: true,
        showTimeIndicators: true,
        showDraftCount: true
      });

      this.settings = { ...this.settings, ...result };
    } catch (error) {
      console.error('[Threads Drafter] Failed to load settings:', error);
      this.showError('Failed to load settings');
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    try {
      await chrome.storage.sync.set(this.settings);
      console.log('[Threads Drafter] Settings saved:', this.settings);
    } catch (error) {
      console.error('[Threads Drafter] Failed to save settings:', error);
      this.showError('Failed to save settings');
    }
  }

  /**
   * Setup event listeners for UI elements
   */
  setupEventListeners() {
    // Extension toggle
    const extensionToggle = document.getElementById('extensionToggle');
    if (extensionToggle) {
      extensionToggle.addEventListener('change', (e) => {
        this.handleExtensionToggle(e.target.checked);
      });
    }

    // Sort order dropdown
    const sortOrder = document.getElementById('sortOrder');
    if (sortOrder) {
      sortOrder.addEventListener('change', (e) => {
        this.handleSortOrderChange(e.target.value);
      });
    }

    // Auto sort toggle
    const autoSort = document.getElementById('autoSort');
    if (autoSort) {
      autoSort.addEventListener('change', (e) => {
        this.handleAutoSortToggle(e.target.checked);
      });
    }

    // Show time indicators toggle
    const showTimeIndicators = document.getElementById('showTimeIndicators');
    if (showTimeIndicators) {
      showTimeIndicators.addEventListener('change', (e) => {
        this.handleTimeIndicatorsToggle(e.target.checked);
      });
    }

    // Show draft count toggle
    const showDraftCount = document.getElementById('showDraftCount');
    if (showDraftCount) {
      showDraftCount.addEventListener('change', (e) => {
        this.handleDraftCountToggle(e.target.checked);
      });
    }

    // Action buttons
    const refreshButton = document.getElementById('refreshDrafts');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        this.handleRefreshDrafts();
      });
    }

    const openThreadsButton = document.getElementById('openThreads');
    if (openThreadsButton) {
      openThreadsButton.addEventListener('click', () => {
        this.handleOpenThreads();
      });
    }

    // Footer links
    const helpLink = document.getElementById('helpLink');
    if (helpLink) {
      helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openHelpPage();
      });
    }

    const feedbackLink = document.getElementById('feedbackLink');
    if (feedbackLink) {
      feedbackLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openFeedbackPage();
      });
    }

    const githubLink = document.getElementById('githubLink');
    if (githubLink) {
      githubLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.openGithubPage();
      });
    }

    // Message close buttons
    const errorClose = document.getElementById('errorClose');
    if (errorClose) {
      errorClose.addEventListener('click', () => {
        this.hideError();
      });
    }

    const successClose = document.getElementById('successClose');
    if (successClose) {
      successClose.addEventListener('click', () => {
        this.hideSuccess();
      });
    }
  }

  /**
   * Update UI elements with current settings
   */
  updateUI() {
    // Extension status
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');
    const extensionToggle = document.getElementById('extensionToggle');

    if (statusIcon && statusText && extensionToggle) {
      if (this.settings.isEnabled) {
        statusIcon.className = 'status-icon active';
        statusText.textContent = 'Extension Active';
        extensionToggle.checked = true;
      } else {
        statusIcon.className = 'status-icon inactive';
        statusText.textContent = 'Extension Inactive';
        extensionToggle.checked = false;
      }
    }

    // Settings
    const sortOrder = document.getElementById('sortOrder');
    if (sortOrder) {
      sortOrder.value = this.settings.sortOrder;
    }

    const autoSort = document.getElementById('autoSort');
    if (autoSort) {
      autoSort.checked = this.settings.autoSort;
    }

    const showTimeIndicators = document.getElementById('showTimeIndicators');
    if (showTimeIndicators) {
      showTimeIndicators.checked = this.settings.showTimeIndicators;
    }

    const showDraftCount = document.getElementById('showDraftCount');
    if (showDraftCount) {
      showDraftCount.checked = this.settings.showDraftCount;
    }
  }

  /**
   * Load draft statistics from content script
   */
  async loadDraftStats() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url.includes('threads.com')) {
        this.showThreadsNotActiveMessage();
        return;
      }

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getDraftStats'
      });

      if (response) {
        this.updateStatsUI(response);
      } else {
        this.showNoStatsMessage();
      }
    } catch (error) {
      console.error('[Threads Drafter] Failed to load draft stats:', error);
      this.showNoStatsMessage();
    }
  }

  /**
   * Update statistics UI
   */
  updateStatsUI(stats) {
    const totalDrafts = document.getElementById('totalDrafts');
    const scheduledDrafts = document.getElementById('scheduledDrafts');
    const nextScheduledContainer = document.getElementById('nextScheduledContainer');
    const nextDraftText = document.getElementById('nextDraftText');
    const nextDraftTime = document.getElementById('nextDraftTime');

    if (totalDrafts) {
      totalDrafts.textContent = stats.totalDrafts || '0';
    }

    if (scheduledDrafts) {
      scheduledDrafts.textContent = stats.totalDrafts || '0';
    }

    if (stats.nextScheduled && nextScheduledContainer && nextDraftText && nextDraftTime) {
      nextScheduledContainer.style.display = 'block';
      nextDraftText.textContent = stats.nextScheduled.content;
      nextDraftTime.textContent = stats.nextScheduled.timeStr;
    } else if (nextScheduledContainer) {
      nextScheduledContainer.style.display = 'none';
    }
  }

  /**
   * Handle extension toggle
   */
  async handleExtensionToggle(enabled) {
    this.settings.isEnabled = enabled;
    await this.saveSettings();
    this.updateUI();

    // Send message to content script
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url.includes('threads.com')) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'toggleExtension',
          enabled: enabled
        });
      }
    } catch (error) {
      console.error('[Threads Drafter] Failed to toggle extension:', error);
    }

    this.showSuccess(enabled ? 'Extension enabled' : 'Extension disabled');
  }

  /**
   * Handle sort order change
   */
  async handleSortOrderChange(order) {
    this.settings.sortOrder = order;
    await this.saveSettings();

    // Send message to content script
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url.includes('threads.com')) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'changeSortOrder',
          sortOrder: order
        });
      }
    } catch (error) {
      console.error('[Threads Drafter] Failed to change sort order:', error);
    }

    this.showSuccess(`Sort order changed to ${order} first`);
  }

  /**
   * Handle auto sort toggle
   */
  async handleAutoSortToggle(enabled) {
    this.settings.autoSort = enabled;
    await this.saveSettings();
    this.showSuccess(enabled ? 'Auto sort enabled' : 'Auto sort disabled');
  }

  /**
   * Handle time indicators toggle
   */
  async handleTimeIndicatorsToggle(enabled) {
    this.settings.showTimeIndicators = enabled;
    await this.saveSettings();
    this.showSuccess(enabled ? 'Time indicators enabled' : 'Time indicators disabled');
  }

  /**
   * Handle draft count toggle
   */
  async handleDraftCountToggle(enabled) {
    this.settings.showDraftCount = enabled;
    await this.saveSettings();
    this.showSuccess(enabled ? 'Draft count enabled' : 'Draft count disabled');
  }

  /**
   * Handle refresh drafts button
   */
  async handleRefreshDrafts() {
    this.showLoading(true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url.includes('threads.com')) {
        this.showError('Please navigate to Threads.com first');
        return;
      }

      // Reload draft statistics
      await this.loadDraftStats();
      this.showSuccess('Drafts refreshed');
    } catch (error) {
      console.error('[Threads Drafter] Failed to refresh drafts:', error);
      this.showError('Failed to refresh drafts');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Handle open threads button
   */
  async handleOpenThreads() {
    try {
      await chrome.tabs.create({
        url: 'https://www.threads.com'
      });
      window.close();
    } catch (error) {
      console.error('[Threads Drafter] Failed to open Threads:', error);
      this.showError('Failed to open Threads.com');
    }
  }

  /**
   * Check if current tab is threads.com
   */
  async checkThreadsTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url.includes('threads.com')) {
        this.showThreadsNotActiveMessage();
      }
    } catch (error) {
      console.error('[Threads Drafter] Failed to check tab:', error);
    }
  }

  /**
   * Show loading state
   */
  showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    if (errorMessage && errorText) {
      errorText.textContent = message;
      errorMessage.style.display = 'flex';
      
      // Auto hide after 5 seconds
      setTimeout(() => {
        this.hideError();
      }, 5000);
    }
  }

  /**
   * Hide error message
   */
  hideError() {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    
    if (successMessage && successText) {
      successText.textContent = message;
      successMessage.style.display = 'flex';
      
      // Auto hide after 3 seconds
      setTimeout(() => {
        this.hideSuccess();
      }, 3000);
    }
  }

  /**
   * Hide success message
   */
  hideSuccess() {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) {
      successMessage.style.display = 'none';
    }
  }

  /**
   * Show message when not on threads.com
   */
  showThreadsNotActiveMessage() {
    const totalDrafts = document.getElementById('totalDrafts');
    const scheduledDrafts = document.getElementById('scheduledDrafts');

    if (totalDrafts) totalDrafts.textContent = '-';
    if (scheduledDrafts) scheduledDrafts.textContent = '-';

    // Show info message
    const infoDiv = document.createElement('div');
    infoDiv.className = 'info-message';
    infoDiv.innerHTML = `
      <div style="
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.3);
        color: #856404;
        padding: 8px 12px;
        border-radius: 4px;
        margin: 8px 20px;
        font-size: 12px;
        text-align: center;
      ">
        📌 Navigate to Threads.com to see draft statistics
      </div>
    `;

    const statsSection = document.querySelector('.stats-section');
    if (statsSection && !document.querySelector('.info-message')) {
      statsSection.appendChild(infoDiv);
    }
  }

  /**
   * Show message when no stats available
   */
  showNoStatsMessage() {
    const totalDrafts = document.getElementById('totalDrafts');
    const scheduledDrafts = document.getElementById('scheduledDrafts');

    if (totalDrafts) totalDrafts.textContent = '0';
    if (scheduledDrafts) scheduledDrafts.textContent = '0';
  }

  /**
   * Open help page
   */
  openHelpPage() {
    chrome.tabs.create({
      url: 'https://github.com/username/threads-scheduler-extension#usage'
    });
  }

  /**
   * Open feedback page
   */
  openFeedbackPage() {
    chrome.tabs.create({
      url: 'https://github.com/username/threads-scheduler-extension/issues'
    });
  }

  /**
   * Open GitHub page
   */
  openGithubPage() {
    chrome.tabs.create({
      url: 'https://github.com/username/threads-scheduler-extension'
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ThreadsDrafterPopup();
});
