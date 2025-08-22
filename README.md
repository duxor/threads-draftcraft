# Threads Drafter

A Chrome extension designed to enhance the organization and management of scheduled posts in the Threads.com drafts section.

## 🎯 Overview

**Threads Drafter** is an open-source Chrome extension that improves the user experience when working with scheduled drafts on [Threads.com](https://www.threads.com). The extension focuses on better organization, sorting, and management of draft posts that are scheduled for future publication.

## ✨ Features

### Current Planned Features
- **📅 Smart Sorting**: Automatically sort drafts by scheduled publication time (earliest first)
- **🔍 Enhanced Visibility**: Improve the visual presentation of draft information
- **⏰ Time Display**: Clear display of scheduled publication times
- **📊 Draft Statistics**: Overview of total drafts and upcoming publications
- **🎨 UI Improvements**: Enhanced interface for better draft management

### Future Enhancements
- **🏷️ Tagging System**: Add custom tags to drafts for better categorization
- **📝 Draft Notes**: Add private notes to drafts
- **🔔 Notifications**: Reminders before scheduled publications
- **📱 Quick Actions**: Bulk operations for draft management
- **📈 Analytics**: Insights into posting patterns and engagement

## 🛠️ Technical Specification

### Architecture
- **Extension Type**: Chrome Extension (Manifest V3)
- **Target Platform**: threads.com
- **Technology Stack**: 
  - JavaScript (ES6+)
  - HTML5/CSS3
  - Chrome Extension APIs

### Core Components

#### 1. Content Script (`content.js`)
- Detects and analyzes the drafts dialog on threads.com
- Extracts draft information (content, scheduled time, etc.)
- Implements sorting algorithms
- Modifies the DOM to display improved draft organization

#### 2. Background Script (`background.js`)
- Handles extension lifecycle events
- Manages storage and preferences
- Coordinates between different extension components

#### 3. Popup Interface (`popup.html/js`)
- Extension settings and preferences
- Quick access to draft statistics
- Toggle extension features on/off

#### 4. Manifest (`manifest.json`)
- Extension configuration
- Permissions and content script registration
- Version and metadata information

### DOM Analysis
Based on the analysis of the threads.com drafts dialog:
- Drafts are contained within a modal dialog structure
- Each draft appears to be wrapped in complex nested `<div>` elements
- Draft content is partially visible with truncated text
- Scheduled time information needs to be extracted from DOM attributes or text content

### Key Algorithms

#### Draft Detection
```javascript
// Pseudocode for draft detection
function detectDrafts() {
    // Identify the drafts container
    // Extract individual draft elements
    // Parse draft content and metadata
    // Return structured draft data
}
```

#### Sorting Algorithm
```javascript
// Pseudocode for sorting by scheduled time
function sortDraftsByTime(drafts) {
    // Extract scheduled timestamps
    // Sort drafts chronologically (earliest first)
    // Update DOM order
}
```

## 🚀 Installation

### For Users

1. **Download from Chrome Web Store** (Coming Soon)
   - Visit the Chrome Web Store
   - Search for "Threads Drafter"
   - Click "Add to Chrome"

2. **Manual Installation** (Development)
   - Download or clone this repository
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the extension folder
   - Navigate to threads.com and open your drafts

### For Developers

```bash
# Clone the repository
git clone https://github.com/username/threads-scheduler-extension.git
cd threads-scheduler-extension

# Install dependencies (if any)
npm install

# Load the extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the project directory
```

## 📖 Usage

1. **Activate Extension**: Navigate to threads.com and log into your account
2. **Access Drafts**: Open your drafts section as usual
3. **Automatic Enhancement**: The extension automatically detects and improves the drafts display
4. **Sorting**: Drafts are automatically sorted by scheduled publication time
5. **Settings**: Click the extension icon to access settings and preferences

## 🔧 Development Setup

### Prerequisites
- Chrome browser (latest version)
- Basic knowledge of JavaScript, HTML, CSS
- Understanding of Chrome Extension development

### Project Structure
```
threads-scheduler-extension/
├── manifest.json          # Extension manifest
├── content/
│   ├── content.js         # Main content script
│   └── content.css        # Styling for improvements
├── popup/
│   ├── popup.html         # Extension popup interface
│   ├── popup.js           # Popup functionality
│   └── popup.css          # Popup styling
├── background/
│   └── background.js      # Background script
├── icons/
│   ├── icon16.png         # Extension icons
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── dev-docs/
│   └── example.html       # Example of threads.com draft dialog
└── README.md
```

### Development Workflow

1. **Setup**: Clone the repository and load it as an unpacked extension
2. **Development**: Make changes to the source code
3. **Testing**: Reload the extension and test on threads.com
4. **Debugging**: Use Chrome DevTools for debugging
5. **Documentation**: Update README.md and code comments

### Testing Guidelines

- Test on different screen sizes and resolutions
- Verify functionality with various numbers of drafts
- Test with drafts scheduled at different times
- Ensure compatibility with threads.com UI updates
- Test extension performance with large numbers of drafts

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Ways to Contribute
- 🐛 **Bug Reports**: Report issues you encounter
- 💡 **Feature Requests**: Suggest new features or improvements
- 🔧 **Code Contributions**: Submit pull requests with fixes or enhancements
- 📚 **Documentation**: Improve documentation and examples
- 🧪 **Testing**: Help test the extension on different configurations

### Contribution Guidelines

1. **Fork the Repository**: Create your own fork of the project
2. **Create a Branch**: Make a new branch for your feature/fix
3. **Make Changes**: Implement your improvements
4. **Test Thoroughly**: Ensure your changes work correctly
5. **Submit Pull Request**: Open a PR with a clear description

### Code Standards
- Use modern JavaScript (ES6+)
- Follow consistent indentation (2 spaces)
- Include meaningful comments
- Write descriptive commit messages
- Test your changes before submitting

### Development Environment
```bash
# Example development commands
npm run lint          # Check code style
npm run test          # Run tests
npm run build         # Build for production
```

## 📋 Roadmap

### Version 1.0 (Initial Release) ✅ COMPLETED
- [x] Project setup and documentation
- [x] Basic draft detection and parsing
- [x] Sorting by scheduled time
- [x] Simple UI improvements
- [x] Comprehensive popup interface
- [x] Background script coordination
- [x] Settings management system
- [x] Icon creation and implementation
- [ ] Chrome Web Store submission

### Version 1.1 (Enhanced Features)
- [ ] Advanced sorting options
- [ ] Draft statistics display
- [ ] Settings panel
- [ ] Performance optimizations

### Version 2.0 (Major Features)
- [ ] Tagging system
- [ ] Draft notes
- [ ] Bulk operations
- [ ] Notification system

## 🐛 Known Issues

- Extension is currently in development phase
- Compatibility depends on threads.com's current DOM structure
- Performance with very large numbers of drafts needs testing

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to the Threads.com team for creating an engaging social platform
- Chrome Extension developers community for best practices and examples
- All contributors who help improve this extension

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/username/threads-scheduler-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/username/threads-scheduler-extension/discussions)
- **Email**: support@threadsdrafter.com (if applicable)

## 🔗 Links

- [Chrome Web Store](https://chrome.google.com/webstore) (Coming Soon)
- [Threads.com](https://www.threads.com)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)

---

**Note**: This extension is not officially affiliated with Threads.com or Meta. It's an independent open-source project designed to enhance user experience.
