/**
 * Threads DraftCraft - Popup Script
 * Handles popup interface interactions and settings management
 */

class ThreadsDraftCraftPopup {
  constructor() {
    this.settings = {
      sortOrder: 'earliest',
      autoSort: true,
      showTimeIndicators: true,
      showDraftCount: true,
      showSortIndicator: true,
      showDateDivider: true
    };

    this.init();
  }

  /**
   * Initialize the popup
   */
  async init() {
    // Popup initialized

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
        sortOrder: 'earliest',
        autoSort: true,
        showTimeIndicators: true,
        showDraftCount: true,
        showSortIndicator: true,
        showDateDivider: true
      });

      this.settings = { ...this.settings, ...result };
    } catch (error) {
      // Settings load failed
      this.showError('Failed to load settings');
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    try {
      await chrome.storage.sync.set(this.settings);
      // Settings saved
    } catch (error) {
      // Settings save failed
      this.showError('Failed to save settings');
    }
  }

  /**
   * Setup event listeners for UI elements
   */
  setupEventListeners() {

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

    // Show date divider toggle
    const showDateDivider = document.getElementById('showDateDivider');
    if (showDateDivider) {
      showDateDivider.addEventListener('change', (e) => {
        this.handleDateDividerToggle(e.target.checked);
      });
    }

    // Show sort indicator toggle
    const showSortIndicator = document.getElementById('showSortIndicator');
    if (showSortIndicator) {
      showSortIndicator.addEventListener('change', (e) => {
        this.handleSortIndicatorToggle(e.target.checked);
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
    // Date divider
    const showDateDivider = document.getElementById('showDateDivider');
    if (showDateDivider) {
      showDateDivider.checked = this.settings.showDateDivider;
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

    const showSortIndicator = document.getElementById('showSortIndicator');
    if (showSortIndicator) {
      showSortIndicator.checked = this.settings.showSortIndicator;
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
      // Draft stats load failed
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
      scheduledDrafts.textContent = stats.scheduledDrafts || stats.totalDrafts || '0';
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
   * Generic helper: send a message to the active threads.com tab
   */
  async _sendToActiveTab(message) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url.includes('threads.com')) {
        await chrome.tabs.sendMessage(tab.id, message);
      }
    } catch (error) {
      // Tab might not have content script
    }
  }

  /**
   * Generic toggle handler to reduce duplication
   */
  async _toggleSetting(settingKey, action, value, label) {
    this.settings[settingKey] = value;
    await this.saveSettings();
    await this._sendToActiveTab({ action, enabled: value });
    if (typeof value === 'boolean') {
      this.showSuccess(value ? `${label} enabled` : `${label} disabled`);
    } else {
      this.showSuccess(`${label} changed to ${value} first`);
    }
  }

  async handleSortOrderChange(order) {
    this.settings.sortOrder = order;
    await this.saveSettings();
    await this._sendToActiveTab({ action: 'changeSortOrder', sortOrder: order });
    this.showSuccess(`Sort order changed to ${order} first`);
  }

  async handleAutoSortToggle(enabled) {
    await this._toggleSetting('autoSort', 'toggleAutoSort', enabled, 'Auto sort');
  }

  async handleTimeIndicatorsToggle(enabled) {
    await this._toggleSetting('showTimeIndicators', 'toggleTimeIndicators', enabled, 'Time indicators');
  }

  async handleDraftCountToggle(enabled) {
    await this._toggleSetting('showDraftCount', 'toggleDraftCount', enabled, 'Draft count');
  }

  async handleSortIndicatorToggle(enabled) {
    await this._toggleSetting('showSortIndicator', 'toggleSortIndicator', enabled, 'Sort indicator');
  }

  async handleDateDividerToggle(enabled) {
    await this._toggleSetting('showDateDivider', 'toggleDateDivider', enabled, 'Date divider');
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
      // Refresh failed
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
      // Open Threads failed
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
      // Tab check failed
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
    const innerInfo = document.createElement('div');
    innerInfo.className = 'info-message-content';
    innerInfo.textContent = 'Navigate to Threads.com to see draft statistics';
    infoDiv.appendChild(innerInfo);

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
      url: 'https://github.com/duxor/threads-draftcraft#usage'
    });
  }

  /**
   * Open feedback page
   */
  openFeedbackPage() {
    chrome.tabs.create({
      url: 'https://github.com/duxor/threads-draftcraft/issues'
    });
  }

  /**
   * Open GitHub page
   */
  openGithubPage() {
    chrome.tabs.create({
      url: 'https://github.com/duxor/threads-draftcraft'
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ThreadsDraftCraftPopup();
});
