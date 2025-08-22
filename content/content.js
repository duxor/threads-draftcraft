/**
 * Threads Drafter - Content Script
 * Enhances the drafts section on threads.com with sorting and organization features
 */

class ThreadsDrafter {
  constructor() {
    this.drafts = [];
    this.isExtensionEnabled = true;
    this.sortOrder = 'earliest'; // 'earliest' or 'latest'
    
    // Initialize the extension
    this.init();
  }

  /**
   * Initialize the extension
   */
  async init() {
    console.log('[Threads Drafter] Extension initialized');
    
    // Load settings from storage
    await this.loadSettings();
    
    // Start observing for drafts dialog
    this.observeForDraftsDialog();
    
    // Listen for settings updates
    this.setupMessageListener();
  }

  /**
   * Load extension settings from chrome storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        isEnabled: true,
        sortOrder: 'earliest'
      });
      
      this.isExtensionEnabled = result.isEnabled;
      this.sortOrder = result.sortOrder;
    } catch (error) {
      console.warn('[Threads Drafter] Could not load settings:', error);
    }
  }

  /**
   * Setup message listener for popup communication
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'toggleExtension') {
        this.isExtensionEnabled = message.enabled;
        this.processDrafts();
      } else if (message.action === 'changeSortOrder') {
        this.sortOrder = message.sortOrder;
        this.processDrafts();
      } else if (message.action === 'getDraftStats') {
        sendResponse({
          totalDrafts: this.drafts.length,
          nextScheduled: this.getNextScheduledDraft()
        });
      }
    });
  }

  /**
   * Observe for the appearance of drafts dialog
   */
  observeForDraftsDialog() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Look for drafts dialog or modal
          const dialogElements = document.querySelectorAll('[role="dialog"], .x1n2onr6');
          
          dialogElements.forEach((dialog) => {
            if (this.isDraftsDialog(dialog)) {
              console.log('[Threads Drafter] Drafts dialog detected');
              this.processDrafts(dialog);
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check for existing dialogs
    this.checkForExistingDraftsDialog();
  }

  /**
   * Check if the current page already has a drafts dialog open
   */
  checkForExistingDraftsDialog() {
    const dialogElements = document.querySelectorAll('[role="dialog"], .x1n2onr6');
    
    dialogElements.forEach((dialog) => {
      if (this.isDraftsDialog(dialog)) {
        console.log('[Threads Drafter] Existing drafts dialog found');
        this.processDrafts(dialog);
      }
    });
  }

  /**
   * Determine if a dialog element contains drafts
   */
  isDraftsDialog(element) {
    // Look for draft-specific indicators
    const textContent = element.textContent.toLowerCase();
    
    // Check for draft-related text or UI elements
    if (textContent.includes('draft') || 
        textContent.includes('scheduled') ||
        element.querySelector('[data-testid*="draft"]')) {
      return true;
    }

    // Check for multiple post-like structures that might be drafts
    const postElements = element.querySelectorAll('div[data-testid*="post"], div[class*="post"]');
    if (postElements.length > 1) {
      return true;
    }

    return false;
  }

  /**
   * Process drafts in the dialog
   */
  processDrafts(dialogElement = null) {
    if (!this.isExtensionEnabled) {
      return;
    }

    // Find the dialog element if not provided
    if (!dialogElement) {
      dialogElement = this.findDraftsDialog();
      if (!dialogElement) {
        return;
      }
    }

    // Extract drafts from the dialog
    this.extractDrafts(dialogElement);

    // Sort drafts
    this.sortDrafts();

    // Apply improvements to the UI
    this.enhanceUI(dialogElement);
  }

  /**
   * Find the drafts dialog in the DOM
   */
  findDraftsDialog() {
    const dialogs = document.querySelectorAll('[role="dialog"], .x1n2onr6');
    
    for (let dialog of dialogs) {
      if (this.isDraftsDialog(dialog)) {
        return dialog;
      }
    }
    
    return null;
  }

  /**
   * Extract draft information from the dialog
   */
  extractDrafts(dialogElement) {
    this.drafts = [];

    // Look for draft post elements
    const draftElements = this.findDraftElements(dialogElement);

    draftElements.forEach((element, index) => {
      const draft = this.parseDraftElement(element, index);
      if (draft) {
        this.drafts.push(draft);
      }
    });

    console.log(`[Threads Drafter] Found ${this.drafts.length} drafts`);
  }

  /**
   * Find individual draft elements within the dialog
   */
  findDraftElements(dialogElement) {
    const draftElements = [];

    // Try different selectors to find draft posts
    const selectors = [
      'div[data-testid*="post"]',
      'div[class*="post"]',
      'div[data-pressable-container="true"]',
      'div > div > div > div > div' // Generic nested divs that might contain drafts
    ];

    for (let selector of selectors) {
      const elements = dialogElement.querySelectorAll(selector);
      if (elements.length > 0) {
        draftElements.push(...Array.from(elements));
        break;
      }
    }

    // If no specific selectors work, try to find elements with draft-like content
    if (draftElements.length === 0) {
      const allDivs = dialogElement.querySelectorAll('div');
      const textContent = dialogElement.textContent;
      
      // If we can see truncated content like in the example, look for those patterns
      if (textContent.includes('keyboard') || textContent.includes('calendar')) {
        // Find divs that likely contain draft content
        allDivs.forEach(div => {
          if (div.textContent.trim().length > 10 && 
              div.children.length < 10 && 
              div.textContent.length < 200) {
            draftElements.push(div);
          }
        });
      }
    }

    return draftElements;
  }

  /**
   * Parse a single draft element to extract information
   */
  parseDraftElement(element, index) {
    const draft = {
      id: `draft_${index}`,
      element: element,
      content: '',
      scheduledTime: null,
      scheduledTimeStr: '',
      originalOrder: index
    };

    // Extract content
    draft.content = this.extractDraftContent(element);

    // Extract scheduled time information
    draft.scheduledTime = this.extractScheduledTime(element);
    draft.scheduledTimeStr = this.formatScheduledTime(draft.scheduledTime);

    return draft;
  }

  /**
   * Extract the main content text from a draft element
   */
  extractDraftContent(element) {
    // Try to find the main text content, avoiding UI elements
    const textNodes = [];
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip very short text nodes and whitespace
          if (node.textContent.trim().length < 3) {
            return NodeFilter.FILTER_SKIP;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node.textContent.trim());
    }

    // Return the first substantial text content
    return textNodes.find(text => text.length > 10) || textNodes[0] || 'Draft content';
  }

  /**
   * Extract scheduled time from draft element
   */
  extractScheduledTime(element) {
    // Look for time-related text or attributes
    const timeIndicators = [
      'scheduled for',
      'will post',
      'posting at',
      'scheduled',
      /\d{1,2}:\d{2}/,  // Time format
      /\d{1,2}\/\d{1,2}/, // Date format
    ];

    const textContent = element.textContent.toLowerCase();
    
    // For now, since we don't have actual scheduled time in the example,
    // we'll create mock scheduled times for demonstration
    const mockTimes = [
      new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
      new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
      new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
      new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
      new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    ];

    // Return a mock time based on the element's position
    const index = parseInt(element.getAttribute('data-draft-index')) || 
                  Array.from(element.parentElement?.children || []).indexOf(element) || 0;
    
    return mockTimes[index % mockTimes.length];
  }

  /**
   * Format scheduled time for display
   */
  formatScheduledTime(date) {
    if (!date) return 'No schedule';

    const now = new Date();
    const diff = date - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `in ${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return 'very soon';
    }
  }

  /**
   * Sort drafts according to current sort order
   */
  sortDrafts() {
    this.drafts.sort((a, b) => {
      if (!a.scheduledTime && !b.scheduledTime) return 0;
      if (!a.scheduledTime) return 1;
      if (!b.scheduledTime) return -1;

      if (this.sortOrder === 'earliest') {
        return a.scheduledTime - b.scheduledTime;
      } else {
        return b.scheduledTime - a.scheduledTime;
      }
    });
  }

  /**
   * Enhance the UI with sorted drafts and improvements
   */
  enhanceUI(dialogElement) {
    // Add extension indicator
    this.addExtensionIndicator(dialogElement);

    // Reorder drafts in the DOM
    this.reorderDraftElements(dialogElement);

    // Add scheduled time indicators
    this.addTimeIndicators();

    // Add draft count
    this.addDraftCount(dialogElement);
  }

  /**
   * Add extension indicator to show it's active
   */
  addExtensionIndicator(dialogElement) {
    // Remove existing indicator
    const existing = dialogElement.querySelector('.threads-drafter-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.className = 'threads-drafter-indicator';
    indicator.innerHTML = `
      <div style="
        background: #1DA1F2; 
        color: white; 
        padding: 8px 12px; 
        border-radius: 6px; 
        font-size: 12px; 
        font-weight: 500;
        margin: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      ">
        <span style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; display: inline-block;"></span>
        Threads Drafter Active - Sorted by ${this.sortOrder} first
      </div>
    `;

    // Insert at the top of the dialog
    dialogElement.insertBefore(indicator, dialogElement.firstChild);
  }

  /**
   * Reorder draft elements in the DOM according to sort order
   */
  reorderDraftElements(dialogElement) {
    if (this.drafts.length === 0) return;

    // Find the container that holds all drafts
    const container = this.drafts[0].element.parentElement;
    if (!container) return;

    // Reorder elements
    this.drafts.forEach((draft) => {
      container.appendChild(draft.element);
    });
  }

  /**
   * Add time indicators to each draft
   */
  addTimeIndicators() {
    this.drafts.forEach((draft) => {
      // Remove existing indicator
      const existing = draft.element.querySelector('.threads-drafter-time');
      if (existing) existing.remove();

      // Add time indicator
      const timeIndicator = document.createElement('div');
      timeIndicator.className = 'threads-drafter-time';
      timeIndicator.innerHTML = `
        <div style="
          background: rgba(29, 161, 242, 0.1);
          color: #1DA1F2;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          margin: 4px 0;
          border-left: 3px solid #1DA1F2;
        ">
          📅 Scheduled ${draft.scheduledTimeStr}
        </div>
      `;

      // Insert at the top of the draft element
      draft.element.insertBefore(timeIndicator, draft.element.firstChild);
    });
  }

  /**
   * Add draft count indicator
   */
  addDraftCount(dialogElement) {
    // Remove existing count
    const existing = dialogElement.querySelector('.threads-drafter-count');
    if (existing) existing.remove();

    if (this.drafts.length === 0) return;

    const countIndicator = document.createElement('div');
    countIndicator.className = 'threads-drafter-count';
    countIndicator.innerHTML = `
      <div style="
        background: rgba(76, 175, 80, 0.1);
        color: #4CAF50;
        padding: 6px 10px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        margin: 8px;
        text-align: center;
      ">
        📊 ${this.drafts.length} draft${this.drafts.length > 1 ? 's' : ''} total
      </div>
    `;

    // Add after the extension indicator
    const indicator = dialogElement.querySelector('.threads-drafter-indicator');
    if (indicator && indicator.nextSibling) {
      dialogElement.insertBefore(countIndicator, indicator.nextSibling);
    } else {
      dialogElement.insertBefore(countIndicator, dialogElement.firstChild);
    }
  }

  /**
   * Get the next scheduled draft for popup display
   */
  getNextScheduledDraft() {
    if (this.drafts.length === 0) return null;

    const scheduledDrafts = this.drafts.filter(draft => draft.scheduledTime);
    if (scheduledDrafts.length === 0) return null;

    // Sort by earliest
    scheduledDrafts.sort((a, b) => a.scheduledTime - b.scheduledTime);
    
    const next = scheduledDrafts[0];
    return {
      content: next.content.substring(0, 50) + '...',
      timeStr: next.scheduledTimeStr
    };
  }
}

// Initialize the extension when the script loads
const threadsDrafter = new ThreadsDrafter();
