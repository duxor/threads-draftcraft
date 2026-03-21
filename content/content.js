/**
 * Threads DraftCraft - Content Script
 * Enhances the drafts section on threads.com with sorting and organization features
 */

/** Named constants */
const DRAFTCRAFT_DEBUG = false;
const MIN_DRAFT_TEXT_LENGTH = 5;
const MIN_DRAFT_CONTENT_LENGTH = 20;
const MAX_DRAFT_CONTENT_LENGTH = 500;
const MIN_SUBSTANTIAL_TEXT_LENGTH = 10;
const MIN_TEXT_NODE_LENGTH = 3;
const DEBOUNCE_DELAY_MS = 150;
const SUGGESTION_WINDOW_START_HOUR = 6;
const SUGGESTION_WINDOW_END_HOUR = 23;
const SUGGESTION_MIN_FUTURE_MINUTES = 30;
const SUGGESTION_COUNT = 3;
const NEXT_DRAFT_PREVIEW_LENGTH = 50;
const FALLBACK_MOCK_HOURS = [2, 4, 8, 16, 25, 30, 48];
const BUSINESS_HOURS_START = 9;
const BUSINESS_HOURS_END = 20;

/** Day/month name constants */
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_NAMES_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Shared regex patterns for schedule detection */
const DAY_PATTERN = DAY_NAMES.join('|');
const DAY_PATTERN_SHORT = DAY_NAMES_SHORT.join('|');
const MONTH_PATTERN = MONTH_NAMES.join('|');

const SCHEDULE_TIME_PATTERNS = [
  // Match "Posting on Mon, Sep 1 at 4:17 PM GMT+2" format
  new RegExp(`posting\\s+on\\s+(${DAY_PATTERN_SHORT}|${DAY_PATTERN}),?\\s+(${MONTH_PATTERN})\\s+(\\d{1,2})\\s+at\\s+(\\d{1,2}):(\\d{2})\\s*(am|pm|AM|PM)(?:\\s+([A-Z]{3}[+-]?\\d{1,2}))?`, 'i'),
  // Match "today/tomorrow/dayname at HH:MM AM/PM" with optional timezone
  new RegExp(`(?:posting\\s+)?(?:today|tomorrow|${DAY_PATTERN})\\s+at\\s+(\\d{1,2}):(\\d{2})\\s*(am|pm|AM|PM)(?:\\s+[A-Z]{3}[+-]?\\d{1,2})?`, 'i'),
  // Fallback for just the time with optional timezone
  /(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)(?:\s+[A-Z]{3}[+-]?\d{1,2})?/i
];

const SCHEDULE_DETECTION_PATTERNS = [
  // Match "today/tomorrow/dayname at HH:MM AM/PM" with optional timezone
  new RegExp(`(?:posting\\s+)?(?:today|tomorrow|${DAY_PATTERN})\\s+at\\s+\\d{1,2}:\\d{2}\\s*(?:am|pm|AM|PM)(?:\\s+[A-Z]{3}[+-]?\\d{1,2})?`, 'i'),
  // Match "Posting on Mon, Sep 1 at 4:17 PM GMT+2" format
  new RegExp(`posting\\s+on\\s+(?:${DAY_PATTERN_SHORT}|${DAY_PATTERN}),?\\s+(?:${MONTH_PATTERN})\\s+\\d{1,2}\\s+at\\s+\\d{1,2}:\\d{2}\\s*(?:am|pm|AM|PM)(?:\\s+[A-Z]{3}[+-]?\\d{1,2})?`, 'i'),
  // Fallback for just the time with optional timezone
  /\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)(?:\s+[A-Z]{3}[+-]?\d{1,2})?/i
];

const SCHEDULING_INDICATORS = [
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

/** Safe text escaping helper */
function escapeText(str) {
  const div = document.createElement('span');
  div.textContent = str;
  return div.textContent;
}

/** Conditional logger */
function debugLog(...args) {
  if (DRAFTCRAFT_DEBUG) {
    console.log('[Threads DraftCraft]', ...args);
  }
}

class ThreadsDraftCraft {
  constructor() {
    this.drafts = [];
    this.sortOrder = 'earliest'; // 'earliest' or 'latest'
    this.autoSort = true;
    this.showTimeIndicators = true;
    this.showDraftCount = true;
    this.showSortIndicator = true;
    this.showDateDivider = true;
    this.observer = null;
    this._debounceTimer = null;

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
        showSortIndicator: true,
        showDateDivider: true
      });
      this.sortOrder = result.sortOrder;
      this.autoSort = result.autoSort;
      this.showTimeIndicators = result.showTimeIndicators;
      this.showDraftCount = result.showDraftCount;
      this.showSortIndicator = result.showSortIndicator;
      this.showDateDivider = result.showDateDivider;
    } catch (error) {
      debugLog('Could not load settings:', error);
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
      } else if (message.action === 'toggleDateDivider') {
        this.showDateDivider = message.enabled;
        this.processDrafts(null, true); // Reprocess to show/hide date dividers
      } else if (message.action === 'getDraftStats') {
        sendResponse({
          totalDrafts: this.drafts.length,
          scheduledDrafts: this.drafts.filter(d => d.scheduledTime).length,
          nextScheduled: this.getNextScheduledDraft()
        });
      }
    });
  }

  /**
   * Observe for the appearance of drafts dialog
   */
  observeForDraftsDialog() {
    // Disconnect existing observer if any
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      let hasRelevantMutation = false;

      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;

        // Skip mutations caused by our own extension elements
        const isExtensionMutation = mutation.addedNodes &&
          Array.from(mutation.addedNodes).some(node =>
            node.nodeType === Node.ELEMENT_NODE &&
            node.className && typeof node.className === 'string' &&
            node.className.includes('threads-draftcraft')
          );

        if (!isExtensionMutation) {
          hasRelevantMutation = true;
          break;
        }
      }

      if (!hasRelevantMutation) return;

      // Debounce processing to avoid excessive DOM queries
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        this._processDialogMutations();
      }, DEBOUNCE_DELAY_MS);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check for existing dialogs
    this.checkForExistingDraftsDialog();
  }

  /**
   * Process dialog mutations (debounced)
   */
  _processDialogMutations() {
    const dialogElements = document.querySelectorAll('[role="dialog"]');

    dialogElements.forEach((dialog) => {
      if (dialog.hasAttribute('data-threads-draftcraft-processed')) {
        return;
      }

      if (this.isDraftsDialog(dialog)) {
        this.processDrafts(dialog);
      }
    });
  }

  /**
   * Disconnect the observer (cleanup)
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    clearTimeout(this._debounceTimer);
  }

  /**
   * Check if the current page already has a drafts dialog open
   */
  checkForExistingDraftsDialog() {
    const dialogElements = document.querySelectorAll('[role="dialog"]');

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

    // Remove date dividers
    const dateDividers = dialogElement.querySelectorAll('.threads-draftcraft-date-divider');
    dateDividers.forEach(divider => divider.remove());

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
    const dialogs = document.querySelectorAll('[role="dialog"]');

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
        if (text.length > MIN_DRAFT_CONTENT_LENGTH && text.length < MAX_DRAFT_CONTENT_LENGTH && this.hasScheduleableContent(div)) {
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
   * Uses shared patterns from module-level constants
   */
  hasScheduleableContent(element) {
    const text = element.textContent.toLowerCase().trim();

    if (!text || text.length < MIN_DRAFT_TEXT_LENGTH) {
      return false;
    }

    // Check for explicit time patterns (shared with extractScheduledTime)
    for (const pattern of SCHEDULE_DETECTION_PATTERNS) {
      if (pattern.test(text)) {
        return true;
      }
    }

    // Check for day name patterns
    if (this._matchesDayNamePattern(text)) {
      return true;
    }

    // Check for other scheduling indicators
    for (const indicator of SCHEDULING_INDICATORS) {
      if (typeof indicator === 'string') {
        if (text.includes(indicator)) return true;
      } else if (indicator.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if text matches any day-name-based scheduling pattern
   */
  _matchesDayNamePattern(text) {
    for (const dayName of DAY_NAMES) {
      const patterns = [
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
        `${dayName}!`
      ];

      for (const pattern of patterns) {
        if (text.includes(pattern)) return true;
      }

      // Also check for day names at sentence boundaries
      const sentencePattern = new RegExp(`(^|\\.|!|\\?)\\s*${dayName}\\b`, 'i');
      if (sentencePattern.test(text)) return true;
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
          if (node.textContent.trim().length < MIN_TEXT_NODE_LENGTH) {
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
    return textNodes.find(text => text.length > MIN_SUBSTANTIAL_TEXT_LENGTH) || textNodes[0] || 'Draft content';
  }

  /**
   * Extract scheduled time from draft element
   */
  /**
   * Convert 12-hour time to 24-hour format
   */
  _to24Hour(hours, isPM) {
    let hour24 = hours;
    if (isPM && hours !== 12) {
      hour24 += 12;
    } else if (!isPM && hours === 12) {
      hour24 = 0;
    }
    return hour24;
  }

  /**
   * Calculate days until a target day of week (0=Sun, 6=Sat)
   * If target is same as current day, returns 7 (next week)
   */
  _daysUntilDay(targetDayIndex, currentDayIndex) {
    let daysUntil = targetDayIndex - currentDayIndex;
    if (daysUntil <= 0) {
      daysUntil += 7; // Next week if day has passed or is today
    }
    return daysUntil;
  }

  extractScheduledTime(element) {
    const textContent = element.textContent.toLowerCase();

    let timeMatch = null;
    let dayMatch = null;
    let patternIndex = -1;

    for (let i = 0; i < SCHEDULE_TIME_PATTERNS.length; i++) {
      timeMatch = textContent.match(SCHEDULE_TIME_PATTERNS[i]);
      if (timeMatch) {
        patternIndex = i;
        if (i > 0) {
          const dayRegex = new RegExp(`(today|tomorrow|${DAY_PATTERN})`, 'i');
          dayMatch = textContent.match(dayRegex);
        }
        break;
      }
    }

    if (timeMatch) {
      // Handle "Posting on Mon, Sep 1 at 4:17 PM GMT+2" format (first pattern)
      if (patternIndex === 0) {
        const monthName = timeMatch[2].toLowerCase();
        const dateNum = parseInt(timeMatch[3]);
        const hours = parseInt(timeMatch[4]);
        const minutes = parseInt(timeMatch[5]);
        const isPM = timeMatch[6].toLowerCase() === 'pm';

        const monthIndex = MONTH_NAMES.indexOf(monthName);
        if (monthIndex === -1) return null;

        const hour24 = this._to24Hour(hours, isPM);
        const currentYear = new Date().getFullYear();
        const scheduledDate = new Date(currentYear, monthIndex, dateNum, hour24, minutes, 0, 0);

        if (scheduledDate < new Date()) {
          scheduledDate.setFullYear(currentYear + 1);
        }

        return scheduledDate;
      }

      // Handle today/tomorrow/dayname format
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const isPM = timeMatch[3].toLowerCase() === 'pm';
      const hour24 = this._to24Hour(hours, isPM);

      const now = new Date();
      const scheduledDate = new Date(now);

      if (dayMatch) {
        const dayIndicator = dayMatch[1].toLowerCase();

        if (dayIndicator === 'today') {
          // Keep current date
        } else if (dayIndicator === 'tomorrow') {
          scheduledDate.setDate(now.getDate() + 1);
        } else if (DAY_NAMES.includes(dayIndicator)) {
          const targetDayIndex = DAY_NAMES.indexOf(dayIndicator);
          const daysUntil = this._daysUntilDay(targetDayIndex, now.getDay());
          scheduledDate.setDate(now.getDate() + daysUntil);
        }
      }

      scheduledDate.setHours(hour24, minutes, 0, 0);

      if (!dayMatch && scheduledDate <= now) {
        scheduledDate.setDate(now.getDate() + 1);
      }
      return scheduledDate;
    }

    // Fallback: day name without specific time - use deterministic time based on position
    if (this._matchesDayNamePattern(textContent)) {
      for (const dayName of DAY_NAMES) {
        if (textContent.includes(dayName)) {
          const now = new Date();
          const scheduledDate = new Date(now);
          const targetDayIndex = DAY_NAMES.indexOf(dayName);
          const daysUntil = this._daysUntilDay(targetDayIndex, now.getDay());
          scheduledDate.setDate(now.getDate() + daysUntil);

          // Deterministic time based on element position (not random)
          const index = Array.from(element.parentElement?.children || []).indexOf(element);
          const deterministicHour = BUSINESS_HOURS_START + ((index * 3) % (BUSINESS_HOURS_END - BUSINESS_HOURS_START));
          scheduledDate.setHours(deterministicHour, 0, 0, 0);
          return scheduledDate;
        }
      }
    }

    // Check for "today" indicators without specific time - deterministic
    if (textContent.includes('posting today') || textContent.includes('today at')) {
      const index = Array.from(element.parentElement?.children || []).indexOf(element);
      return new Date(Date.now() + (1 + index * 2) * 60 * 60 * 1000);
    }

    // Check for "tomorrow" indicators without specific time - deterministic
    if (textContent.includes('posting tomorrow') || textContent.includes('tomorrow at')) {
      const index = Array.from(element.parentElement?.children || []).indexOf(element);
      return new Date(Date.now() + (24 + index * 2) * 60 * 60 * 1000);
    }

    // Check for "in X hours" or "in X days" patterns
    const inHoursMatch = textContent.match(/in (\d+) hours?/);
    if (inHoursMatch) {
      return new Date(Date.now() + parseInt(inHoursMatch[1]) * 60 * 60 * 1000);
    }

    const inDaysMatch = textContent.match(/in (\d+) days?/);
    if (inDaysMatch) {
      return new Date(Date.now() + parseInt(inDaysMatch[1]) * 24 * 60 * 60 * 1000);
    }

    // Final fallback: deterministic times based on position
    const index = parseInt(element.getAttribute('data-draft-index')) ||
      Array.from(element.parentElement?.children || []).indexOf(element) || 0;

    return new Date(Date.now() + FALLBACK_MOCK_HOURS[index % FALLBACK_MOCK_HOURS.length] * 60 * 60 * 1000);
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

    // Add date dividers between different days
    if (this.showDateDivider) {
      this.addDateDividers();
    }

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

    // Find the existing "Drafts" header element (h1)
    const headerEl = dialogElement.querySelector('h1');
    if (!headerEl || !headerEl.textContent.includes('Drafts')) {
      return;
    }

    // Determine a safe container (prefer the parent of h1)
    const headerContainer = headerEl.parentElement || headerEl;

    // Remove any existing integrated indicators from the container
    const existingStatus = headerContainer.querySelector('.threads-draftcraft-status');
    if (existingStatus) existingStatus.remove();

    // Skip adding sort indicator if disabled
    if (!this.showSortIndicator) {
      return;
    }

    // Create compact status indicator to integrate into header
    const statusIndicator = document.createElement('span');
    statusIndicator.className = 'threads-draftcraft-status';

    const innerSpan = document.createElement('span');
    innerSpan.className = 'threads-draftcraft-status-label';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '12');
    svg.setAttribute('height', '12');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('threads-draftcraft-status-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M6 2L6 10M3 7L6 10L9 7');
    path.setAttribute('stroke', '#4CAF50');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);

    innerSpan.appendChild(svg);
    innerSpan.appendChild(document.createTextNode(
      ` ${this.sortOrder === 'earliest' ? 'Earliest' : 'Latest'} First`
    ));
    statusIndicator.appendChild(innerSpan);

    // Integrate the status into the header container (sibling to h1)
    headerContainer.appendChild(statusIndicator);
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

  // Helper: date utils and suggestions
  getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  startOfDay(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    return d;
  }

  endOfDay(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    return d;
  }

  collectScheduledByDate() {
    const map = new Map();
    this.drafts.forEach(d => {
      const dt = d.scheduledTime instanceof Date ? d.scheduledTime : null;
      if (!dt) return;
      const key = this.getDateKey(dt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(new Date(dt));
    });
    // sort
    for (const [k, arr] of map.entries()) {
      arr.sort((a,b)=>a-b);
      map.set(k, arr);
    }
    return map;
  }

  // Generate at least 3 suggestions per date. Start with 3-hour cadence, then densify to 2h, 1h, and finally place in largest gaps. Ensure minutes are never 00.
  generateSuggestionsForDate(baseDate, existingTimes) {
    const suggestions = [];
    const now = new Date();
    const isToday = this.getDateKey(baseDate) === this.getDateKey(now);
    const dayStart = this.startOfDay(baseDate);
    const dayEnd = this.endOfDay(baseDate);

    const minTime = isToday ? new Date(Math.max(now.getTime() + SUGGESTION_MIN_FUTURE_MINUTES * 60000, new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), SUGGESTION_WINDOW_START_HOUR).getTime())) : new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), SUGGESTION_WINDOW_START_HOUR);

    const endWindow = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), SUGGESTION_WINDOW_END_HOUR, 0, 0, 0);

    const taken = [...(existingTimes||[])].filter(d => d >= dayStart && d <= dayEnd);

    // Helper to check conflict within a variable window
    const conflicts = (candidate, thresholdMinutes = 90) => {
      const thresholdMs = thresholdMinutes * 60 * 1000;
      for (const t of taken) {
        if (Math.abs(t - candidate) < thresholdMs) return true;
      }
      for (const s of suggestions) {
        if (Math.abs(s - candidate) < thresholdMs) return true;
      }
      return false;
    };

    // Minute generator: never return 00, randomize 1..59
    const randomNonZeroMinute = () => {
      let m = Math.floor(Math.random()*59) + 1; // 1..59
      if (m === 60) m = 59;
      return m;
    };

    const withRandomMinutes = (dt) => {
      const nd = new Date(dt);
      nd.setMinutes(randomNonZeroMinute(), 0, 0);
      return nd;
    };

    // 1) Try 3-hour cadence anchors spread across the day
    for (let hour = SUGGESTION_WINDOW_START_HOUR; hour <= SUGGESTION_WINDOW_END_HOUR && suggestions.length < SUGGESTION_COUNT; hour += 3) {
      const slot = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hour, 0, 0, 0);
      if (slot < minTime || slot > endWindow) continue;
      const cand = withRandomMinutes(slot);
      if (!conflicts(cand, 90)) suggestions.push(cand);
    }

    // 2) If still short, try every 2 hours
    for (let hour = SUGGESTION_WINDOW_START_HOUR; hour <= SUGGESTION_WINDOW_END_HOUR && suggestions.length < SUGGESTION_COUNT; hour += 2) {
      const slot = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hour, 0, 0, 0);
      if (slot < minTime || slot > endWindow) continue;
      const cand = withRandomMinutes(slot);
      if (!conflicts(cand, 75)) suggestions.push(cand);
    }

    // 3) If still short, try every hour
    for (let hour = SUGGESTION_WINDOW_START_HOUR; hour <= SUGGESTION_WINDOW_END_HOUR && suggestions.length < SUGGESTION_COUNT; hour += 1) {
      const slot = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hour, 0, 0, 0);
      if (slot < minTime || slot > endWindow) continue;
      const cand = withRandomMinutes(slot);
      if (!conflicts(cand, 60)) suggestions.push(cand);
    }

    // 4) If still short, find largest gaps between existing (taken + suggestions) within window and drop a time in the middle
    if (suggestions.length < SUGGESTION_COUNT) {
      const pool = [...taken, ...suggestions].filter(t => t >= minTime && t <= endWindow).sort((a,b)=>a-b);
      // Add window bounds to compute gaps
      const bounds = [minTime, ...pool, endWindow];
      const gaps = [];
      for (let i = 0; i < bounds.length - 1; i++) {
        const a = bounds[i];
        const b = bounds[i+1];
        const gapMs = b - a;
        if (gapMs > 15*60*1000) { // consider gaps > 15 minutes
          gaps.push({a, b, gapMs});
        }
      }
      gaps.sort((x,y)=>y.gapMs - x.gapMs);
      let gi = 0;
      while (suggestions.length < SUGGESTION_COUNT && gi < gaps.length) {
        const {a, b} = gaps[gi++];
        const mid = new Date(a.getTime() + (b - a)/2);
        const cand = withRandomMinutes(mid);
        if (!conflicts(cand, 45)) suggestions.push(cand);
      }
    }

    // Final safety: if we still don't have 3, place at deterministic offsets from minTime
    let offsetMin = 45;
    while (suggestions.length < SUGGESTION_COUNT) {
      const cand = new Date(minTime.getTime() + offsetMin*60000);
      const c2 = withRandomMinutes(cand);
      if (!conflicts(c2, 30)) suggestions.push(c2);
      offsetMin += 37; // prime-ish step to avoid clustering
    }

    // Sort suggestions chronologically for display aesthetics
    suggestions.sort((a,b)=>a-b);

    return suggestions.slice(0, SUGGESTION_COUNT);
  }

  formatTimeBadge(date) {
    try {
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      const h = date.getHours();
      const m = String(date.getMinutes()).padStart(2,'0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hr12 = h % 12 || 12;
      return `${hr12}:${m} ${ampm}`;
    }
  }

  /**
   * Insert a date divider before the first draft of each calendar date
   */
  addDateDividers() {
    if (this.drafts.length === 0) return;

    const firstEl = this.drafts[0].element;
    if (!firstEl) return;
    const container = firstEl.parentElement;
    if (!container) return;

    // Remove any existing date dividers (safety)
    const existing = container.querySelectorAll('.threads-draftcraft-date-divider');
    existing.forEach(el => el.remove());

    // Build counts per date
    const dateCounts = new Map();
    this.drafts.forEach((d) => {
      const dt = d.scheduledTime instanceof Date ? d.scheduledTime : null;
      if (!dt) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      dateCounts.set(key, (dateCounts.get(key) || 0) + 1);
    });

    // Pre-compute scheduled times map once (not inside loop)
    const scheduledMap = this.collectScheduledByDate();
    const now = new Date();
    const todayKey = this.getDateKey(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowKey = this.getDateKey(tomorrow);

    let lastDateKey = null;

    this.drafts.forEach((draft) => {
      const dt = draft.scheduledTime instanceof Date ? draft.scheduledTime : null;
      if (!dt) return;

      const key = this.getDateKey(dt);
      if (key !== lastDateKey) {
        const divider = document.createElement('div');
        divider.className = 'threads-draftcraft-date-divider';

        const header = document.createElement('div');
        header.className = 'threads-draftcraft-date-header';

        const label = document.createElement('div');
        label.className = 'threads-draftcraft-date-label';
        let formattedDate = '';
        try {
          formattedDate = dt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
          formattedDate = key;
        }
        let prefix = '';
        if (key === todayKey) prefix = 'Today';
        else if (key === tomorrowKey) prefix = 'Tomorrow';
        label.textContent = prefix ? `${prefix}, ${formattedDate}` : formattedDate;

        const suggestionsWrap = document.createElement('div');
        suggestionsWrap.className = 'threads-draftcraft-date-suggestions';

        const count = dateCounts.get(key) || 0;
        const countEl = document.createElement('span');
        countEl.className = 'threads-draftcraft-date-count';
        countEl.textContent = String(count);
        countEl.setAttribute('aria-label', `${count} scheduled ${count === 1 ? 'post' : 'posts'} on ${label.textContent}`);

        header.appendChild(label);
        header.appendChild(suggestionsWrap);
        header.appendChild(countEl);

        const line = document.createElement('div');
        line.className = 'threads-draftcraft-date-line';

        // Generate suggestions using pre-computed map
        const existingTimes = scheduledMap.get(key) || [];
        const sugDates = this.generateSuggestionsForDate(dt, existingTimes);
        sugDates.forEach(sdate => {
          const b = document.createElement('span');
          b.className = 'threads-draftcraft-date-suggestion';
          b.textContent = this.formatTimeBadge(sdate);
          b.setAttribute('data-threads-draftcraft-suggestion', sdate.toISOString());
          suggestionsWrap.appendChild(b);
        });

        divider.appendChild(header);
        divider.appendChild(line);

        if (draft.element && draft.element.parentElement === container) {
          container.insertBefore(divider, draft.element);
        }

        lastDateKey = key;
      }
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

      // Also remove any integrated time info within this draft
      const integratedInfos = draft.element.querySelectorAll('.threads-draftcraft-time-info');
      integratedInfos.forEach(info => info.remove());

      // If any ancestor is already marked, skip to avoid duplicate flags on parent and child
      const ancestorProcessed = draft.element.parentElement ? draft.element.parentElement.closest('[data-threads-draftcraft-time-added]') : null;
      if (ancestorProcessed) {
        // Ensure this child is clean and not marked
        draft.element.removeAttribute('data-threads-draftcraft-time-added');
        return;
      }

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
        timeInfo.textContent = escapeText(draft.scheduledTimeStr);

        // Integrate the time info with the existing posting text
        postingTextNode.parentElement.appendChild(timeInfo);
      } else {
        // Fallback: if no "Posting" text found, add a subtle indicator at the top
        const timeIndicator = document.createElement('div');
        timeIndicator.className = 'threads-draftcraft-time-subtle';

        const innerDiv = document.createElement('div');
        innerDiv.className = 'threads-draftcraft-time-subtle-inner';
        innerDiv.textContent = escapeText(draft.scheduledTimeStr);
        timeIndicator.appendChild(innerDiv);

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

    // Find the header element (h1)
    const headerEl = dialogElement.querySelector('h1');
    // Determine a safe container (prefer the parent of h1)
    const headerContainer = headerEl ? (headerEl.parentElement || headerEl) : null;
    if (headerContainer) {
      const existingCount = headerContainer.querySelector('.threads-draftcraft-count-badge');
      if (existingCount) existingCount.remove();
    }

    if (!this.showDraftCount) {
      return; // Skip adding draft count if disabled
    }

    if (this.drafts.length === 0) return;

    // Verify we have the Drafts header
    if (!headerEl || !headerEl.textContent.includes('Drafts')) {
      // console.warn('[Threads DraftCraft] Could not find Drafts header for count integration');
      return;
    }

    // Create compact count badge to integrate into header
    const countBadge = document.createElement('span');
    countBadge.className = 'threads-draftcraft-count-badge';

    const innerBadge = document.createElement('span');
    innerBadge.className = 'threads-draftcraft-count-badge-inner';
    innerBadge.textContent = this.drafts.length;
    innerBadge.setAttribute('aria-label', `${this.drafts.length} drafts`);
    countBadge.appendChild(innerBadge);

    // Integrate the count into the header container (sibling to h1)
    headerContainer.appendChild(countBadge);
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
      content: next.content.substring(0, NEXT_DRAFT_PREVIEW_LENGTH) + '...',
      timeStr: next.scheduledTimeStr
    };
  }
}

// Initialize the extension when the script loads
const threadsDraftCraft = new ThreadsDraftCraft();
