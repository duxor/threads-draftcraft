/**
 * Threads DraftCraft - Content Script
 * Enhances the drafts section on threads.com with sorting and organization features
 */

class ThreadsDraftCraft {
  constructor() {
    this.drafts = [];
    this.sortOrder = 'earliest'; // 'earliest' or 'latest'
    this.autoSort = true;
    this.showTimeIndicators = true;
    this.showDraftCount = true;
    this.showSortIndicator = true;
    
    // Initialize the extension
    this.init();
  }

  /**
   * Initialize the extension
   */
  async init() {
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
        sortOrder: 'earliest',
        autoSort: true,
        showTimeIndicators: true,
        showDraftCount: true,
        showSortIndicator: true
      });
      this.sortOrder = result.sortOrder;
      this.autoSort = result.autoSort;
      this.showTimeIndicators = result.showTimeIndicators;
      this.showDraftCount = result.showDraftCount;
      this.showSortIndicator = result.showSortIndicator;
    } catch (error) {
      console.warn('[Threads DraftCraft] Could not load settings:', error);
    }
  }

  /**
   * Setup message listener for popup communication
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'changeSortOrder') {
        this.sortOrder = message.sortOrder;
        this.processDrafts(null, true); // Force reprocessing
      } else if (message.action === 'toggleAutoSort') {
        this.autoSort = message.enabled;
        this.processDrafts(null, true); // Force reprocessing to apply/remove sorting immediately
      } else if (message.action === 'toggleTimeIndicators') {
        this.showTimeIndicators = message.enabled;
        this.processDrafts(null, true); // Force reprocessing to show/hide time indicators
      } else if (message.action === 'toggleDraftCount') {
        this.showDraftCount = message.enabled;
        this.processDrafts(null, true); // Force reprocessing to show/hide draft count
      } else if (message.action === 'toggleSortIndicator') {
        this.showSortIndicator = message.enabled;
        this.processDrafts(null, true); // Force reprocessing to show/hide sort indicator
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
          // Skip mutations caused by our own extension elements
          const isExtensionMutation = mutation.addedNodes && 
            Array.from(mutation.addedNodes).some(node => 
              node.nodeType === Node.ELEMENT_NODE && 
              (node.classList?.contains('threads-draftcraft-indicator') || 
               node.classList?.contains('threads-draftcraft-count') ||
               node.classList?.contains('threads-draftcraft-time'))
            );
          
          if (isExtensionMutation) {
            return; // Skip processing this mutation
          }
          
          // Look for drafts dialog or modal
          const dialogElements = document.querySelectorAll('[role="dialog"], .x1n2onr6');
          
          dialogElements.forEach((dialog) => {
            // Check if dialog is already processed to prevent infinite loop
            if (dialog.hasAttribute('data-threads-draftcraft-processed')) {
              return;
            }
            
            if (this.isDraftsDialog(dialog)) {
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
      // Check if dialog is already processed to prevent infinite loop
      if (dialog.hasAttribute('data-threads-draftcraft-processed')) {
        return;
      }
      
      if (this.isDraftsDialog(dialog)) {
        this.processDrafts(dialog);
      }
    });
  }

  /**
   * Determine if a dialog element contains drafts
   */
  isDraftsDialog(element) {
    const textContent = element.textContent.toLowerCase();
    
    // First, check for edit/compose dialog indicators - if found, this is NOT a drafts dialog
    const editIndicators = [
      'new thread',
      'add a topic',
      'what\'s new?',
      'attach media',
      'add a gif',
      'add an emoji',
      'add a poll',
      'add a location',
      'add to thread',
      'anyone can reply'
    ];
    
    for (const indicator of editIndicators) {
      if (textContent.includes(indicator)) {
        return false;
      }
    }
    
    // Check for specific drafts dialog indicators
    const draftsIndicators = [
      'posting tomorrow at',
      'posting today at',
      'posting in',
      'scheduled for'
    ];
    
    let hasDraftsIndicator = false;
    for (const indicator of draftsIndicators) {
      if (textContent.includes(indicator)) {
        hasDraftsIndicator = true;
        break;
      }
    }
    
    // Must have "drafts" text AND scheduling indicators to be considered a drafts dialog
    const hasDraftsText = textContent.includes('draft');
    
    // Additional check: look for multiple scheduled posts pattern
    const hasMultipleScheduledPosts = (textContent.match(/posting (today|tomorrow) at/g) || []).length > 1;
    
    // Only return true if we have clear drafts indicators and no edit indicators
    const isDrafts = hasDraftsText && (hasDraftsIndicator || hasMultipleScheduledPosts);
    
    // if (isDrafts) {
    //   console.log('[Threads DraftCraft] Confirmed drafts dialog with indicators');
    // }
    
    return isDrafts;
  }

  /**
   * Remove existing extension enhancements from dialog
   */
  removeExistingEnhancements(dialogElement) {
    // Remove extension indicators
    const indicators = dialogElement.querySelectorAll('.threads-draftcraft-indicator');
    indicators.forEach(indicator => indicator.remove());
    
    // Remove draft count indicators
    const countIndicators = dialogElement.querySelectorAll('.threads-draftcraft-count');
    countIndicators.forEach(indicator => indicator.remove());
    
    // Remove time indicators and reset processed flags
    const timeIndicators = dialogElement.querySelectorAll('.threads-draftcraft-time');
    timeIndicators.forEach(indicator => indicator.remove());
    
    // Reset all processed flags on draft elements
    const processedElements = dialogElement.querySelectorAll('[data-threads-draftcraft-time-added]');
    processedElements.forEach(element => element.removeAttribute('data-threads-draftcraft-time-added'));
  }

  /**
   * Restore original order of draft elements
   */
  restoreOriginalOrder(dialogElement) {
    if (this.drafts.length === 0) return;

    // Find the container that holds all drafts
    const container = this.drafts[0].element.parentElement;
    if (!container) return;

    // Sort drafts by their original order
    const originalDrafts = [...this.drafts].sort((a, b) => a.originalOrder - b.originalOrder);
    
    // Restore elements to original DOM order
    originalDrafts.forEach((draft) => {
      container.appendChild(draft.element);
    });
  }

  /**
   * Process drafts in the dialog
   */
  processDrafts(dialogElement = null, force = false) {

    // Find the dialog element if not provided
    if (!dialogElement) {
      dialogElement = this.findDraftsDialog();
      if (!dialogElement) {
        return;
      }
    }

    // Check if already processed to prevent infinite loop (unless forced)
    if (!force && dialogElement.hasAttribute('data-threads-draftcraft-processed')) {
      return;
    }

    // If forcing reprocessing, remove existing extension elements first
    if (force) {
      this.removeExistingEnhancements(dialogElement);
    }

    // Extract drafts from the dialog
    this.extractDrafts(dialogElement);

    // Sort drafts only if auto sort is enabled
    if (this.autoSort) {
      this.sortDrafts();
    }

    // Apply improvements to the UI
    this.enhanceUI(dialogElement);

    // Mark dialog as processed to prevent re-processing
    dialogElement.setAttribute('data-threads-draftcraft-processed', 'true');
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
  }

  /**
   * Find individual draft elements within the dialog
   */
  findDraftElements(dialogElement) {
    const draftElements = [];

    // Try specific selectors first for proper draft post elements
    const specificSelectors = [
      'div[data-testid*="post"]',
      'div[class*="post"]',
      'div[data-pressable-container="true"]'
    ];

    for (let selector of specificSelectors) {
      const elements = dialogElement.querySelectorAll(selector);
      if (elements.length > 0) {
        // Enhanced filtering: check if element contains any scheduleable content
        const validDrafts = Array.from(elements).filter(element => {
          return this.hasScheduleableContent(element);
        });
        if (validDrafts.length > 0) {
          draftElements.push(...validDrafts);
          break;
        }
      }
    }

    // If no specific selectors work, look for elements containing scheduling text
    if (draftElements.length === 0) {
      const allDivs = dialogElement.querySelectorAll('div');
      const foundDrafts = new Set(); // Prevent duplicates
      
      allDivs.forEach(div => {
        const text = div.textContent.trim();
        
        // Enhanced detection: look for any scheduleable content
        if (text.length > 20 && text.length < 500 && this.hasScheduleableContent(div)) {
          // Make sure this isn't a child of an already found element
          let isChild = false;
          for (let found of foundDrafts) {
            if (found.contains(div) || div.contains(found)) {
              isChild = true;
              break;
            }
          }
          
          if (!isChild) {
            foundDrafts.add(div);
          }
        }
      });
      
      draftElements.push(...Array.from(foundDrafts));
    }

    // Final filter: remove any elements that are children of other selected elements
    const filteredElements = [];
    draftElements.forEach(element => {
      let isChild = false;
      for (let other of draftElements) {
        if (other !== element && other.contains(element)) {
          isChild = true;
          break;
        }
      }
      if (!isChild) {
        filteredElements.push(element);
      }
    });
    return filteredElements;
  }

  /**
   * Check if an element contains content that can be scheduled
   * Uses the same comprehensive logic as extractScheduledTime
   */
  hasScheduleableContent(element) {
    const text = element.textContent.toLowerCase().trim();
    
    if (!text || text.length < 5) {
      return false;
    }
    
    // Define day names for matching
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayPattern = dayNames.join('|');
    
    // Check for explicit time patterns (same as extractScheduledTime)
    const timePatterns = [
      // Match "today/tomorrow/dayname at HH:MM AM/PM" with optional timezone
      new RegExp(`(?:posting\\s+)?(?:today|tomorrow|${dayPattern})\\s+at\\s+\\d{1,2}:\\d{2}\\s*(?:am|pm|AM|PM)(?:\\s+[A-Z]{3}[+-]?\\d{1,2})?`, 'i'),
      // Fallback for just the time with optional timezone
      /\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)(?:\s+[A-Z]{3}[+-]?\d{1,2})?/i
    ];
    
    // Check for explicit time patterns
    for (const pattern of timePatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
    
    // Check for day name patterns (enhanced from extractScheduledTime)
    for (const dayName of dayNames) {
      const dayPatterns = [
        `posting ${dayName}`,
        `${dayName} at`,
        `${dayName} review`,
        `${dayName} meeting`,
        `${dayName} motivation`,
        `${dayName} planning`,
        `${dayName} session`,
        `${dayName} post`,
        `${dayName} is`,
        `${dayName} will`,
        `${dayName}!`,
        // Also check for day names at the beginning of sentences or after punctuation
        new RegExp(`(^|\\.|!|\\?)\\s*${dayName}\\b`, 'i')
      ];
      
      for (const pattern of dayPatterns) {
        if (typeof pattern === 'string') {
          if (text.includes(pattern)) {
            return true;
          }
        } else {
          // Handle regex patterns
          if (pattern.test(text)) {
            return true;
          }
        }
      }
    }
    
    // Check for other scheduling indicators
    const schedulingIndicators = [
      'posting today',
      'today at',
      'posting tomorrow',
      'tomorrow at',
      'posting in',
      /in \d+ hours?/,
      /in \d+ days?/,
      /\btoday\b/,
      /\btomorrow\b/
    ];
    
    for (const indicator of schedulingIndicators) {
      if (typeof indicator === 'string') {
        if (text.includes(indicator)) {
          return true;
        }
      } else {
        // Handle regex patterns
        if (indicator.test(text)) {
          return true;
        }
      }
    }
    
    return false;
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
    const originalText = element.textContent;
    const textContent = originalText.toLowerCase();
    
    // Try to extract actual time strings from Threads.com draft content
    // Look for patterns like "today at 2:14 pm", "tomorrow at 12:36 PM", "Sunday at 3:00 PM", etc.
    
    // Define day names for matching
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayPattern = dayNames.join('|');
    
    // Enhanced patterns to match times with day names and optional timezone info
    const timePatterns = [
      // Match "today/tomorrow/dayname at HH:MM AM/PM" with optional timezone (case-insensitive)
      new RegExp(`(?:posting\\s+)?(?:today|tomorrow|${dayPattern})\\s+at\\s+(\\d{1,2}):(\\d{2})\\s*(am|pm|AM|PM)(?:\\s+[A-Z]{3}[+-]?\\d{1,2})?`, 'i'),
      // Fallback for just the time with optional timezone (case-insensitive)
      /(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)(?:\s+[A-Z]{3}[+-]?\d{1,2})?/i
    ];
    
    let timeMatch = null;
    let dayMatch = null;
    
    for (const pattern of timePatterns) {
      timeMatch = textContent.match(pattern);
      if (timeMatch) {
        // Also capture which day was mentioned
        const dayRegex = new RegExp(`(today|tomorrow|${dayPattern})`, 'i');
        dayMatch = textContent.match(dayRegex);
        break;
      }
    }
    
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const isPM = timeMatch[3].toLowerCase() === 'pm';
      
      // Convert to 24-hour format
      let hour24 = hours;
      if (isPM && hours !== 12) {
        hour24 += 12;
      } else if (!isPM && hours === 12) {
        hour24 = 0;
      }
      
      // Create date object
      const now = new Date();
      const scheduledDate = new Date(now);
      
      // Determine the target date based on day mentioned
      if (dayMatch) {
        const dayIndicator = dayMatch[1].toLowerCase();
        
        if (dayIndicator === 'today') {
          // Keep current date
        } else if (dayIndicator === 'tomorrow') {
          scheduledDate.setDate(now.getDate() + 1);
        } else if (dayNames.includes(dayIndicator)) {
          // Handle specific day names
          const targetDayIndex = dayNames.indexOf(dayIndicator);
          const currentDayIndex = now.getDay();
          
          // Calculate days until target day
          let daysUntil = targetDayIndex - currentDayIndex;
          if (daysUntil < 0) {
            daysUntil += 7; // Next week if day has passed
          }
          
          scheduledDate.setDate(now.getDate() + daysUntil);
        }
      }
      
      scheduledDate.setHours(hour24, minutes, 0, 0);
      
      // If the time has already passed today and no specific day was mentioned, schedule for tomorrow
      if (!dayMatch && scheduledDate <= now) {
        scheduledDate.setDate(now.getDate() + 1);
      }
      return scheduledDate;
    }
    
    // Fallback patterns for relative time indicators
    
    // Check for specific day names without specific time (Sunday, Monday, etc.)
    for (const dayName of dayNames) {
      // More comprehensive pattern matching for day names
      const dayPatterns = [
        `posting ${dayName}`,
        `${dayName} at`,
        `${dayName} review`,
        `${dayName} meeting`,
        `${dayName} motivation`,
        `${dayName} planning`,
        `${dayName} session`,
        `${dayName} post`,
        `${dayName} is`,
        `${dayName} will`,
        `${dayName}!`,
        // Also check for day names at the beginning of sentences or after punctuation
        new RegExp(`(^|\\.|!|\\?)\\s*${dayName}\\b`, 'i')
      ];
      
      let dayFound = false;
      for (const pattern of dayPatterns) {
        if (typeof pattern === 'string') {
          if (textContent.includes(pattern)) {
            dayFound = true;
            break;
          }
        } else {
          // Handle regex patterns
          if (pattern.test(textContent)) {
            dayFound = true;
            break;
          }
        }
      }
      
      if (dayFound) {
        const now = new Date();
        const scheduledDate = new Date(now);
        
        const targetDayIndex = dayNames.indexOf(dayName);
        const currentDayIndex = now.getDay();
        
        // Calculate days until target day
        let daysUntil = targetDayIndex - currentDayIndex;
        if (daysUntil < 0) {
          daysUntil += 7; // Next week if day has passed
        }
        
        scheduledDate.setDate(now.getDate() + daysUntil);
        // Set a random time during business hours for the day
        const randomHour = Math.floor(Math.random() * 12) + 9; // 9 AM to 8 PM
        const randomMinute = Math.floor(Math.random() * 60);
        scheduledDate.setHours(randomHour, randomMinute, 0, 0);
        return scheduledDate;
      }
    }
    
    // Check for "today" indicators without specific time
    if (textContent.includes('posting today') || textContent.includes('today at')) {
      // Generate times for today (next few hours)
      const hoursFromNow = Math.floor(Math.random() * 8) + 1; // 1-8 hours from now
      return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    }
    
    // Check for "tomorrow" indicators without specific time
    if (textContent.includes('posting tomorrow') || textContent.includes('tomorrow at')) {
      // Generate times for tomorrow (24+ hours from now)
      const hoursFromNow = Math.floor(Math.random() * 12) + 24; // 24-35 hours from now
      return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    }
    
    // Check for "in X hours" or "in X days" patterns
    const inHoursMatch = textContent.match(/in (\d+) hours?/);
    if (inHoursMatch) {
      const hours = parseInt(inHoursMatch[1]);
      return new Date(Date.now() + hours * 60 * 60 * 1000);
    }
    
    const inDaysMatch = textContent.match(/in (\d+) days?/);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1]);
      return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    
    // Final fallback: assign times based on position to maintain some order
    const index = parseInt(element.getAttribute('data-draft-index')) || 
                  Array.from(element.parentElement?.children || []).indexOf(element) || 0;
    
    // Create chronologically ordered times as fallback
    const mockTimes = [
      new Date(Date.now() + 2 * 60 * 60 * 1000),  // 2 hours from now
      new Date(Date.now() + 4 * 60 * 60 * 1000),  // 4 hours from now
      new Date(Date.now() + 8 * 60 * 60 * 1000),  // 8 hours from now
      new Date(Date.now() + 16 * 60 * 60 * 1000), // 16 hours from now
      new Date(Date.now() + 25 * 60 * 60 * 1000), // 25 hours from now (tomorrow)
      new Date(Date.now() + 30 * 60 * 60 * 1000), // 30 hours from now (tomorrow)
      new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now (day after)
    ];
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
      return `in ${days} day${days > 1 ? 's' : ''} - ${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      // Calculate exact minutes and seconds for precise display
      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (minutes > 0) {
        return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
      } else if (seconds > 0) {
        return `in ${seconds} second${seconds > 1 ? 's' : ''}`;
      } else {
        return 'in a few seconds';
      }
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
   * Add extension indicator to show it's active (integrated into existing header)
   */
  addExtensionIndicator(dialogElement) {
    // Remove any existing separate indicators
    const existing = dialogElement.querySelector('.threads-draftcraft-indicator');
    if (existing) existing.remove();

    // Find the existing "Drafts" header
    const draftsHeader = dialogElement.querySelector('h1 span');
    if (!draftsHeader || !draftsHeader.textContent.includes('Drafts')) {
      return;
    }

    // Remove any existing integrated indicators
    const existingStatus = draftsHeader.querySelector('.threads-draftcraft-status');
    if (existingStatus) existingStatus.remove();

    // Skip adding sort indicator if disabled
    if (!this.showSortIndicator) {
      return;
    }

    // Create compact status indicator to integrate into header
    const statusIndicator = document.createElement('span');
    statusIndicator.className = 'threads-draftcraft-status';
    statusIndicator.innerHTML = `
      <span style="
        margin-left: 8px;
        font-size: 12px;
        font-weight: 400;
        opacity: 0.8;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      ">
        <svg width="12" height="12" viewBox="0 0 12 12" style="display: inline-block; margin-right: 2px;">
          <path d="M6 2L6 10M3 7L6 10L9 7" stroke="#4CAF50" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        ${this.sortOrder === 'earliest' ? 'Earliest' : 'Latest'} First
      </span>
    `;

    // Integrate the status into the existing header
    draftsHeader.appendChild(statusIndicator);
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
   * Add time indicators to each draft (integrated into existing "Posting" sections)
   */
  addTimeIndicators() {
    if (!this.showTimeIndicators) {
      // If time indicators are disabled, remove any existing ones
      this.drafts.forEach((draft) => {
        const existingIndicators = draft.element.querySelectorAll('.threads-draftcraft-time, .threads-draftcraft-time-subtle');
        existingIndicators.forEach(indicator => indicator.remove());
        
        // Also remove integrated time info
        const existingTimeInfo = draft.element.querySelector('.threads-draftcraft-time-info');
        if (existingTimeInfo) existingTimeInfo.remove();
        
        // Remove processed flag so it can be re-processed later
        draft.element.removeAttribute('data-threads-draftcraft-time-added');
      });
      return;
    }

    this.drafts.forEach((draft) => {
      // Always remove existing indicators first, regardless of processed flag
      const existingIndicators = draft.element.querySelectorAll('.threads-draftcraft-time, .threads-draftcraft-time-subtle');
      existingIndicators.forEach(indicator => indicator.remove());

      // Find existing "Posting" text within the draft element
      const walker = document.createTreeWalker(
        draft.element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            return node.textContent.toLowerCase().includes('posting') ? 
              NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          }
        }
      );

      let postingTextNode = walker.nextNode();
      if (postingTextNode && postingTextNode.parentElement) {
        // Remove any existing integrated time info
        const existingTimeInfo = postingTextNode.parentElement.querySelector('.threads-draftcraft-time-info');
        if (existingTimeInfo) existingTimeInfo.remove();

        // Create compact time info to integrate with posting text
        const timeInfo = document.createElement('span');
        timeInfo.className = 'threads-draftcraft-time-info';
        timeInfo.style.cssText = `
          margin-left: 6px;
          color: #1DA1F2;
          font-weight: 500;
          background: rgba(29, 161, 242, 0.1);
          padding: 0 6px;
          border-radius: 4px;
          display: inline-block;
        `;
        timeInfo.textContent = `${draft.scheduledTimeStr}`;

        // Integrate the time info with the existing posting text
        postingTextNode.parentElement.appendChild(timeInfo);
      } else {
        // Fallback: if no "Posting" text found, add a subtle indicator at the top
        const timeIndicator = document.createElement('div');
        timeIndicator.className = 'threads-draftcraft-time-subtle';
        timeIndicator.innerHTML = `
          <div style="
            color: #1DA1F2;
            font-size: 10px;
            font-weight: 500;
            margin: 2px 0;
            opacity: 0.8;
          ">
            📅 ${draft.scheduledTimeStr}
          </div>
        `;
        draft.element.insertBefore(timeIndicator, draft.element.firstChild);
      }
      
      // Mark this element as processed to prevent future duplicates
      draft.element.setAttribute('data-threads-draftcraft-time-added', 'true');
    });
  }

  /**
   * Add draft count indicator (integrated into existing header)
   */
  addDraftCount(dialogElement) {
    // Remove any existing separate count indicators
    const existing = dialogElement.querySelector('.threads-draftcraft-count');
    if (existing) existing.remove();

    // Always remove existing integrated count badges
    const draftsHeader = dialogElement.querySelector('h1 span');
    if (draftsHeader) {
      const existingCount = draftsHeader.querySelector('.threads-draftcraft-count-badge');
      if (existingCount) existingCount.remove();
    }

    if (!this.showDraftCount) {
      return; // Skip adding draft count if disabled
    }

    if (this.drafts.length === 0) return;

    // Verify we have the drafts header (already found above)
    if (!draftsHeader || !draftsHeader.textContent.includes('Drafts')) {
      // console.warn('[Threads DraftCraft] Could not find Drafts header for count integration');
      return;
    }

    // Create compact count badge to integrate into header
    const countBadge = document.createElement('span');
    countBadge.className = 'threads-draftcraft-count-badge';
    countBadge.innerHTML = `
      <span style="
        margin-left: 8px;
        background: rgba(76, 175, 80, 0.15);
        color: #4CAF50;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 2px;
      ">
        📊 ${this.drafts.length}
      </span>
    `;

    // Integrate the count into the existing header
    draftsHeader.appendChild(countBadge);
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
const threadsDraftCraft = new ThreadsDraftCraft();
