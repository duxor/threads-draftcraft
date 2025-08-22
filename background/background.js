/**
 * Threads Drafter - Background Script
 * Handles extension lifecycle events and coordinates between components
 */

class ThreadsDrafterBackground {
  constructor() {
    this.init();
  }

  /**
   * Initialize the background script
   */
  init() {
    console.log('[Threads Drafter] Background script initialized');

    // Setup event listeners
    this.setupEventListeners();

    // Initialize default settings on install
    this.handleInstallation();
  }

  /**
   * Setup Chrome extension event listeners
   */
  setupEventListeners() {
    // Extension installation and startup
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleOnInstalled(details);
    });

    chrome.runtime.onStartup.addListener(() => {
      this.handleOnStartup();
    });

    // Message passing between components
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Tab updates to detect navigation to threads.com
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      this.handleStorageChange(changes, areaName);
    });
  }

  /**
   * Handle extension installation
   */
  async handleInstallation() {
    try {
      // Check if this is the first install
      const result = await chrome.storage.sync.get('isInstalled');
      
      if (!result.isInstalled) {
        await this.initializeDefaultSettings();
        await chrome.storage.sync.set({ isInstalled: true });
        console.log('[Threads Drafter] Extension installed with default settings');
      }
    } catch (error) {
      console.error('[Threads Drafter] Failed to handle installation:', error);
    }
  }

  /**
   * Initialize default settings
   */
  async initializeDefaultSettings() {
    const defaultSettings = {
      sortOrder: 'earliest',
      autoSort: true,
      showTimeIndicators: true,
      showDraftCount: true,
      version: '1.0.0',
      installDate: Date.now()
    };

    try {
      await chrome.storage.sync.set(defaultSettings);
      console.log('[Threads Drafter] Default settings initialized:', defaultSettings);
    } catch (error) {
      console.error('[Threads Drafter] Failed to initialize default settings:', error);
    }
  }

  /**
   * Handle extension installed event
   */
  async handleOnInstalled(details) {
    console.log('[Threads Drafter] Extension installed/updated:', details);

    switch (details.reason) {
      case 'install':
        await this.handleFirstInstall();
        break;
      case 'update':
        await this.handleUpdate(details.previousVersion);
        break;
      case 'chrome_update':
        console.log('[Threads Drafter] Chrome was updated');
        break;
    }
  }

  /**
   * Handle first installation
   */
  async handleFirstInstall() {
    console.log('[Threads Drafter] First installation detected');

    // Set badge to indicate extension is active
    try {
      await chrome.action.setBadgeText({ text: '✓' });
      await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      await chrome.action.setTitle({ title: 'Threads Drafter - Ready' });
    } catch (error) {
      console.error('[Threads Drafter] Failed to set badge:', error);
    }

    // Show welcome notification (optional)
    this.showWelcomeNotification();
  }

  /**
   * Handle extension update
   */
  async handleUpdate(previousVersion) {
    console.log('[Threads Drafter] Extension updated from version:', previousVersion);

    try {
      // Update version in storage
      await chrome.storage.sync.set({ 
        version: '1.0.0',
        lastUpdateDate: Date.now(),
        previousVersion: previousVersion
      });

      // Perform any migration logic here if needed
      await this.performMigration(previousVersion);

      console.log('[Threads Drafter] Update completed successfully');
    } catch (error) {
      console.error('[Threads Drafter] Failed to handle update:', error);
    }
  }

  /**
   * Perform data migration for updates
   */
  async performMigration(previousVersion) {
    console.log('[Threads Drafter] Performing migration from version:', previousVersion);

    // Add migration logic here as needed for future updates
    // For example:
    // - Convert old settings format to new format
    // - Update stored data structures
    // - Remove deprecated settings

    // Currently no migration needed for initial version
  }

  /**
   * Handle extension startup
   */
  handleOnStartup() {
    console.log('[Threads Drafter] Extension startup');
    
    // Reset badge on startup
    this.updateBadge();
  }

  /**
   * Handle messages from content scripts and popup
   */
  async handleMessage(message, sender, sendResponse) {
    console.log('[Threads Drafter] Received message:', message, 'from:', sender);

    try {
      switch (message.action) {
        case 'getSettings':
          const settings = await this.getSettings();
          sendResponse({ success: true, settings });
          break;

        case 'saveSettings':
          await this.saveSettings(message.settings);
          sendResponse({ success: true });
          break;

        case 'getDraftStats':
          // Forward to content script if needed
          const stats = await this.getDraftStats(sender.tab?.id);
          sendResponse({ success: true, stats });
          break;

        case 'updateBadge':
          await this.updateBadge(message.count);
          sendResponse({ success: true });
          break;

        case 'logError':
          this.logError(message.error, message.context);
          sendResponse({ success: true });
          break;

        default:
          console.warn('[Threads Drafter] Unknown message action:', message.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[Threads Drafter] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle tab updates
   */
  async handleTabUpdate(tabId, changeInfo, tab) {
    // Only process completed navigations to threads.com
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('threads.com')) {
      console.log('[Threads Drafter] Threads.com tab detected:', tabId);

      try {
        // Update badge to show extension is active on this tab
        await chrome.action.setBadgeText({ text: '●', tabId });
        await chrome.action.setBadgeBackgroundColor({ color: '#1DA1F2', tabId });
        await chrome.action.setTitle({ 
          title: 'Threads Drafter - Active on this tab',
          tabId 
        });

        // Optionally inject content script if not already present
        await this.ensureContentScriptInjected(tabId);
      } catch (error) {
        console.error('[Threads Drafter] Failed to handle tab update:', error);
      }
    }
  }

  /**
   * Ensure content script is injected in the tab
   */
  async ensureContentScriptInjected(tabId) {
    try {
      // Check if content script is already running
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      if (response && response.success) {
        console.log('[Threads Drafter] Content script already active in tab:', tabId);
        return;
      }
    } catch (error) {
      // Content script not present, inject it
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content/content.js']
        });

        await chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['content/content.css']
        });

        console.log('[Threads Drafter] Content script injected into tab:', tabId);
      } catch (injectError) {
        console.error('[Threads Drafter] Failed to inject content script:', injectError);
      }
    }
  }

  /**
   * Handle storage changes
   */
  handleStorageChange(changes, areaName) {
    console.log('[Threads Drafter] Storage changed:', changes, 'in area:', areaName);

    // Broadcast settings changes to all tabs
    this.broadcastSettingsUpdate(changes);
  }

  /**
   * Get settings from storage
   */
  async getSettings() {
    try {
      const result = await chrome.storage.sync.get({
        sortOrder: 'earliest',
        autoSort: true,
        showTimeIndicators: true,
        showDraftCount: true,
        showSortIndicator: true
      });

      return result;
    } catch (error) {
      console.error('[Threads Drafter] Failed to get settings:', error);
      throw error;
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
      console.log('[Threads Drafter] Settings saved:', settings);
    } catch (error) {
      console.error('[Threads Drafter] Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Get draft statistics from content script
   */
  async getDraftStats(tabId) {
    if (!tabId) {
      return null;
    }

    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'getDraftStats'
      });

      return response || null;
    } catch (error) {
      console.error('[Threads Drafter] Failed to get draft stats:', error);
      return null;
    }
  }

  /**
   * Update extension badge
   */
  async updateBadge(count = null) {
    try {
      if (count !== null) {
        await chrome.action.setBadgeText({ text: count.toString() });
        await chrome.action.setBadgeBackgroundColor({ color: '#1DA1F2' });
        await chrome.action.setTitle({ title: `Threads Drafter - ${count} drafts found` });
      } else {
        await chrome.action.setBadgeText({ text: '✓' });
        await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        await chrome.action.setTitle({ title: 'Threads Drafter - Ready' });
      }
    } catch (error) {
      console.error('[Threads Drafter] Failed to update badge:', error);
    }
  }

  /**
   * Broadcast settings updates to all content scripts
   */
  async broadcastSettingsUpdate(changes) {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.threads.com/*' });

      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'settingsChanged',
            changes: changes
          });
        } catch (error) {
          // Tab might not have content script, ignore
        }
      }
    } catch (error) {
      console.error('[Threads Drafter] Failed to broadcast settings update:', error);
    }
  }

  /**
   * Log errors for debugging
   */
  logError(error, context) {
    console.error(`[Threads Drafter] ${context}:`, error);

    // Store error in local storage for debugging (optional)
    try {
      chrome.storage.local.get('errorLog').then((result) => {
        const errorLog = result.errorLog || [];
        errorLog.push({
          timestamp: Date.now(),
          error: error.toString(),
          context: context,
          stack: error.stack
        });

        // Keep only last 50 errors
        if (errorLog.length > 50) {
          errorLog.splice(0, errorLog.length - 50);
        }

        chrome.storage.local.set({ errorLog });
      });
    } catch (storageError) {
      console.error('[Threads Drafter] Failed to log error:', storageError);
    }
  }

  /**
   * Show welcome notification (optional)
   */
  showWelcomeNotification() {
    // This could show a notification or open a welcome page
    // For now, just log the welcome message
    console.log('[Threads Drafter] Welcome! Extension installed successfully.');

    // Optionally create a notification
    /*
    chrome.notifications.create('welcome', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Threads Drafter Installed!',
      message: 'Your extension is ready. Visit Threads.com to get started.'
    });
    */
  }
}

// Initialize background script
const threadsDrafterBackground = new ThreadsDrafterBackground();
