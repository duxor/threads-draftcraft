/**
 * Threads DraftCraft - Background Script
 * Handles extension lifecycle events and coordinates between components
 */

const BG_DEBUG = false;
function bgLog(...args) {
  if (BG_DEBUG) console.log('[Threads DraftCraft]', ...args);
}

class ThreadsDraftCraftBackground {
  constructor() {
    this.init();
  }

  /**
   * Initialize the background script
   */
  init() {
    bgLog('Background script initialized');

    // Setup event listeners
    this.setupEventListeners();
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
      bgLog(' Default settings initialized:', defaultSettings);
    } catch (error) {
      bgLog('ERROR: Failed to initialize default settings:', error);
    }
  }

  /**
   * Handle extension installed event
   */
  async handleOnInstalled(details) {
    bgLog(' Extension installed/updated:', details);

    switch (details.reason) {
      case 'install':
        await this.handleFirstInstall();
        break;
      case 'update':
        await this.handleUpdate(details.previousVersion);
        break;
      case 'chrome_update':
        bgLog(' Chrome was updated');
        break;
    }
  }

  /**
   * Handle first installation
   */
  async handleFirstInstall() {
    bgLog('First installation detected');

    // Initialize default settings
    await this.initializeDefaultSettings();
    await chrome.storage.sync.set({ isInstalled: true });

    // Set badge to indicate extension is active
    try {
      await chrome.action.setBadgeText({ text: '✓' });
      await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      await chrome.action.setTitle({ title: 'Threads DraftCraft - Ready' });
    } catch (error) {
      bgLog('ERROR: Failed to set badge:', error);
    }

    this.showWelcomeNotification();
  }

  /**
   * Handle extension update
   */
  async handleUpdate(previousVersion) {
    bgLog(' Extension updated from version:', previousVersion);

    try {
      // Update version in storage
      await chrome.storage.sync.set({ 
        version: '1.0.0',
        lastUpdateDate: Date.now(),
        previousVersion: previousVersion
      });

      // Perform any migration logic here if needed
      await this.performMigration(previousVersion);

      bgLog(' Update completed successfully');
    } catch (error) {
      bgLog('ERROR: Failed to handle update:', error);
    }
  }

  /**
   * Perform data migration for updates
   */
  async performMigration(previousVersion) {
    bgLog(' Performing migration from version:', previousVersion);

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
    bgLog(' Extension startup');
    
    // Reset badge on startup
    this.updateBadge();
  }

  /**
   * Handle messages from content scripts and popup
   */
  async handleMessage(message, sender, sendResponse) {
    bgLog(' Received message:', message, 'from:', sender);

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
          bgLog('Unknown message action:', message.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      bgLog('ERROR: Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle tab updates
   */
  async handleTabUpdate(tabId, changeInfo, tab) {
    // Only process completed navigations to threads.com
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('threads.com')) {
      bgLog(' Threads.com tab detected:', tabId);

      try {
        // Update badge to show extension is active on this tab
        await chrome.action.setBadgeText({ text: '●', tabId });
        await chrome.action.setBadgeBackgroundColor({ color: '#1DA1F2', tabId });
        await chrome.action.setTitle({ 
          title: 'Threads DraftCraft - Active on this tab',
          tabId 
        });

        // Optionally inject content script if not already present
        await this.ensureContentScriptInjected(tabId);
      } catch (error) {
        bgLog('ERROR: Failed to handle tab update:', error);
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
        bgLog(' Content script already active in tab:', tabId);
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

        bgLog(' Content script injected into tab:', tabId);
      } catch (injectError) {
        bgLog('ERROR: Failed to inject content script:', injectError);
      }
    }
  }

  /**
   * Handle storage changes
   */
  handleStorageChange(changes, areaName) {
    bgLog(' Storage changed:', changes, 'in area:', areaName);

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
        showSortIndicator: true,
        showDateDivider: true
      });

      return result;
    } catch (error) {
      bgLog('ERROR: Failed to get settings:', error);
      throw error;
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
      bgLog(' Settings saved:', settings);
    } catch (error) {
      bgLog('ERROR: Failed to save settings:', error);
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
      bgLog('ERROR: Failed to get draft stats:', error);
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
        await chrome.action.setTitle({ title: `Threads DraftCraft - ${count} drafts found` });
      } else {
        await chrome.action.setBadgeText({ text: '✓' });
        await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        await chrome.action.setTitle({ title: 'Threads DraftCraft - Ready' });
      }
    } catch (error) {
      bgLog('ERROR: Failed to update badge:', error);
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
      bgLog('ERROR: Failed to broadcast settings update:', error);
    }
  }

  /**
   * Log errors for debugging
   */
  logError(error, context) {
    bgLog(`ERROR: ${context}:`, error);

    // Store error in local storage for debugging
    chrome.storage.local.get('errorLog').then((result) => {
      const errorLog = result.errorLog || [];
      errorLog.push({
        timestamp: Date.now(),
        error: error.toString(),
        context: context,
        stack: error.stack
      });

      // Keep only last 50 errors
      chrome.storage.local.set({ errorLog: errorLog.slice(-50) });
    }).catch((storageError) => {
      bgLog('ERROR: Failed to log error:', storageError);
    });
  }

  /**
   * Show welcome notification (optional)
   */
  showWelcomeNotification() {
    // This could show a notification or open a welcome page
    // For now, just log the welcome message
    bgLog(' Welcome! Extension installed successfully.');

    // Optionally create a notification
    /*
    chrome.notifications.create('welcome', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Threads DraftCraft Installed!',
      message: 'Your extension is ready. Visit Threads.com to get started.'
    });
    */
  }
}

// Initialize background script
const threadsDraftCraftBackground = new ThreadsDraftCraftBackground();
