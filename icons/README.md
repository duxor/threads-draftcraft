# Extension Icons

This directory should contain the following icon files for the Threads Drafter extension:

## Required Icon Sizes

- **icon16.png** - 16x16px - Used in the extension toolbar
- **icon32.png** - 32x32px - Used in the extension management page
- **icon48.png** - 48x48px - Used in the extension management page and installation dialog
- **icon128.png** - 128x128px - Used in the Chrome Web Store and extension management page

## Icon Design Guidelines

### Visual Style
- **Primary Color**: #1DA1F2 (Twitter/Threads blue)
- **Secondary Color**: #4CAF50 (Success green)
- **Background**: White or transparent
- **Style**: Modern, clean, minimalist

### Design Elements
The icon should incorporate elements that represent:
1. **Drafts/Documents**: A document or notepad symbol
2. **Scheduling/Time**: A clock or calendar element
3. **Organization/Sorting**: Arrows or lines suggesting order
4. **Threads Branding**: Colors that complement Threads.com

### Suggested Design Concepts

#### Option 1: Document with Clock
- A stylized document/paper icon with a small clock overlay
- Primary blue background with white document
- Green clock hands or accent

#### Option 2: Sorted List with Time
- Three horizontal lines (representing a list) with a clock icon
- Lines arranged in ascending/descending order
- Blue primary color with green accents

#### Option 3: Calendar Grid
- A simplified calendar grid with a few highlighted squares
- One square could have a small document icon
- Clean blue and green color scheme

### Implementation Status ✅ PLACEHOLDER FILES CREATED

**Current Status**: Detailed placeholder specification files have been created for all required icon sizes:

- `icon16.txt` - Contains specifications for 16x16px icon
- `icon32.txt` - Contains specifications for 32x32px icon  
- `icon48.txt` - Contains specifications for 48x48px icon
- `icon128.txt` - Contains specifications for 128x128px icon

### Next Steps for Developers

To complete the icon implementation:

1. **Review Specifications**: Read each `.txt` file for detailed design requirements
2. **Create Actual PNG Files**: Use image editing software (Photoshop, GIMP, Figma, etc.)
3. **Replace Placeholder Files**: Delete `.txt` files and create actual PNG files with exact names
4. **Ensure Proper Dimensions**: Follow the exact pixel dimensions specified
5. **Test All Sizes**: Verify visibility and consistency across all icon sizes
6. **Consider Accessibility**: Ensure compatibility with light/dark themes

### File Naming Convention

Files must be named exactly as specified in manifest.json:
- `icon16.png`
- `icon32.png` (note: manifest references this but it's not in the standard requirement)
- `icon48.png`
- `icon128.png`

### Legal Considerations

- Icons should be original or use properly licensed assets
- Avoid copying existing Threads.com or Meta icons directly
- Ensure icons comply with Chrome Web Store policies
- Consider trademark and copyright implications

### Quality Checklist

Before finalizing icons:
- [ ] All required sizes present (16, 32, 48, 128px)
- [ ] Consistent visual style across sizes
- [ ] Clear visibility at smallest size (16px)
- [ ] Appropriate file size (keep under 100KB each)
- [ ] PNG format with transparency if needed
- [ ] Test in light and dark browser themes
- [ ] Verify colors match brand guidelines
