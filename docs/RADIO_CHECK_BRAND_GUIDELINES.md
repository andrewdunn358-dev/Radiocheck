# Radio Check - Brand Guidelines

## Version 1.0 | February 2026

---

## Brand Overview

### Mission Statement
Radio Check provides immediate, accessible mental health and peer support for UK military veterans through innovative AI-powered early intervention and a network of trained veteran supporters.

### Brand Personality
- **Supportive** - Always there when needed
- **Understanding** - Military culture aware
- **Trustworthy** - Reliable and confidential
- **Accessible** - No barriers to support
- **Professional** - Serious about safety

### Tagline
*"Never Walk Alone"*

---

## Logo

### Primary Logo
The Radio Check logo features a compass/radar design that symbolizes:
- **Navigation** - Helping veterans find their path
- **Detection** - Our safeguarding radar watching for distress
- **Connection** - The compass needle pointing toward support
- **Direction** - Guiding to the right resources

### Logo Usage
- Maintain clear space around the logo
- Do not distort or rotate the logo
- Minimum size: 40px height for digital
- Use only approved color variations

### Logo Files
- `/assets/logo.png` - Full color
- `/assets/logo-white.png` - White version for dark backgrounds
- `/assets/favicon.png` - Icon only

---

## Color Palette

### Primary Colors

| Color | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| ![#1E3A5F](https://via.placeholder.com/20/1E3A5F/1E3A5F.png) | Navy Blue | `#1E3A5F` | 30, 58, 95 | Headers, primary backgrounds |
| ![#0D9488](https://via.placeholder.com/20/0D9488/0D9488.png) | Teal | `#0D9488` | 13, 148, 136 | Primary buttons, links, accents |
| ![#F8FAFC](https://via.placeholder.com/20/F8FAFC/F8FAFC.png) | Off White | `#F8FAFC` | 248, 250, 252 | Page backgrounds |

### Secondary Colors

| Color | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| ![#334155](https://via.placeholder.com/20/334155/334155.png) | Slate Dark | `#334155` | 51, 65, 85 | Secondary text, borders |
| ![#64748B](https://via.placeholder.com/20/64748B/64748B.png) | Slate | `#64748B` | 100, 116, 139 | Muted text, placeholders |
| ![#E2E8F0](https://via.placeholder.com/20/E2E8F0/E2E8F0.png) | Slate Light | `#E2E8F0` | 226, 232, 240 | Borders, dividers |

### Alert/Status Colors

| Color | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| ![#DC2626](https://via.placeholder.com/20/DC2626/DC2626.png) | Red | `#DC2626` | 220, 38, 38 | RED alerts, errors, danger |
| ![#F59E0B](https://via.placeholder.com/20/F59E0B/F59E0B.png) | Amber | `#F59E0B` | 245, 158, 11 | AMBER alerts, warnings |
| ![#D97706](https://via.placeholder.com/20/D97706/D97706.png) | Orange | `#D97706` | 217, 119, 6 | YELLOW status, caution |
| ![#16A34A](https://via.placeholder.com/20/16A34A/16A34A.png) | Green | `#16A34A` | 22, 163, 74 | Success, safe, confirmed |
| ![#3B82F6](https://via.placeholder.com/20/3B82F6/3B82F6.png) | Blue | `#3B82F6` | 59, 130, 246 | Information, links |

### Gradient Definitions

**Primary Gradient**
```css
background: linear-gradient(135deg, #1E3A5F 0%, #0D9488 100%);
```

**Alert Gradient (RED)**
```css
background: linear-gradient(90deg, #FEE2E2 0%, #FFFFFF 15%);
```

**Alert Gradient (AMBER)**
```css
background: linear-gradient(90deg, #FEF3C7 0%, #FFFFFF 15%);
```

**Success Gradient**
```css
background: linear-gradient(90deg, #DCFCE7 0%, #FFFFFF 15%);
```

---

## Typography

### Font Stack
Radio Check uses system fonts for optimal performance and accessibility:

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
             Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', 
             sans-serif;
```

### Type Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| H1 | 32px / 2rem | Bold (700) | 1.2 | Page titles |
| H2 | 24px / 1.5rem | Semibold (600) | 1.3 | Section headings |
| H3 | 20px / 1.25rem | Semibold (600) | 1.4 | Subsections |
| H4 | 18px / 1.125rem | Medium (500) | 1.4 | Card titles |
| Body | 16px / 1rem | Regular (400) | 1.5 | Main content |
| Small | 14px / 0.875rem | Regular (400) | 1.4 | Supporting text |
| Caption | 12px / 0.75rem | Medium (500) | 1.3 | Labels, badges |

### Mobile Typography

| Level | Mobile Size | Desktop Size |
|-------|-------------|--------------|
| H1 | 28px | 32px |
| H2 | 20px | 24px |
| H3 | 18px | 20px |
| Body | 14px | 16px |

---

## Iconography

### Icon Library
Radio Check uses **FontAwesome** icons for consistency.

### Common Icons

| Icon | Class | Usage |
|------|-------|-------|
| Phone | `fa-phone-alt` | Call actions |
| Chat | `fa-comments` | Chat/messaging |
| Shield | `fa-shield-alt` | Safeguarding |
| User | `fa-user` | Profile |
| Home | `fa-home` | Home/dashboard |
| Settings | `fa-cog` | Settings |
| Alert | `fa-exclamation-triangle` | Warnings |
| Check | `fa-check` | Success/confirm |
| Times | `fa-times` | Close/cancel |
| Sync | `fa-sync` | Refresh |

### Icon Sizing

| Context | Size |
|---------|------|
| Inline text | 1em |
| Buttons | 16px |
| Nav items | 20px |
| Feature icons | 24px |
| Hero icons | 48px |

---

## Component Styling

### Buttons

**Primary Button**
```css
background: #0D9488;
color: white;
padding: 12px 24px;
border-radius: 8px;
font-weight: 600;
```

**Secondary Button**
```css
background: #334155;
color: white;
padding: 12px 24px;
border-radius: 8px;
```

**Outline Button**
```css
background: transparent;
border: 2px solid #0D9488;
color: #0D9488;
padding: 10px 22px;
border-radius: 8px;
```

**Danger Button**
```css
background: #DC2626;
color: white;
padding: 12px 24px;
border-radius: 8px;
```

### Cards

```css
background: white;
border-radius: 12px;
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
padding: 20px;
border: 1px solid #E2E8F0;
```

### Input Fields

```css
background: white;
border: 2px solid #E2E8F0;
border-radius: 8px;
padding: 12px 16px;
font-size: 16px;

/* Focus state */
border-color: #0D9488;
outline: none;
box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
```

### Badges

**Status Badge**
```css
padding: 4px 12px;
border-radius: 20px;
font-size: 12px;
font-weight: 600;
text-transform: uppercase;
```

### Alerts/Notifications

```css
border-radius: 8px;
padding: 16px;
border-left: 4px solid [color];
```

---

## Spacing System

### Base Unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight spacing |
| sm | 8px | Icon gaps |
| md | 16px | Element padding |
| lg | 24px | Section spacing |
| xl | 32px | Major sections |
| 2xl | 48px | Page margins |
| 3xl | 64px | Hero spacing |

---

## Imagery

### Photography Style
- **Authentic** - Real veterans, not stock photos
- **Warm** - Welcoming and approachable
- **Diverse** - Representing all services and backgrounds
- **Active** - Veterans engaged in positive activities

### Illustration Style
- Simple, flat design
- Use brand colors
- Supportive and calming themes
- Avoid military imagery that could trigger

### Image Treatment
- Subtle rounded corners (8px)
- Soft shadows when elevated
- Responsive sizing
- Alt text for accessibility

---

## Voice & Tone

### Writing Guidelines

**DO:**
- Use warm, supportive language
- Be direct and clear
- Use "we" and "our" to build community
- Acknowledge military culture and experience
- Provide clear action steps
- Be honest about what we can and can't do

**DON'T:**
- Use clinical or bureaucratic language
- Make assumptions about experience
- Use triggering terminology unnecessarily
- Sound preachy or judgmental
- Over-promise outcomes
- Use excessive jargon

### Example Phrases

**Instead of:** "Click here to access mental health resources"
**Use:** "Find support that works for you"

**Instead of:** "Warning: Suicidal content detected"
**Use:** "We noticed you might be struggling"

**Instead of:** "Error: Operation failed"
**Use:** "Something went wrong. Let's try again."

---

## Accessibility

### Color Contrast
- All text meets WCAG 2.1 AA standards
- 4.5:1 minimum for normal text
- 3:1 minimum for large text

### Focus States
- Visible focus indicators on all interactive elements
- 3px solid outline with brand color
- Focus order follows logical reading

### Motion
- Respect `prefers-reduced-motion`
- No auto-playing animations
- Transitions under 300ms

### Screen Readers
- Semantic HTML structure
- ARIA labels where needed
- Alt text for all images
- Skip links for navigation

---

## Application Examples

### User App Screenshots

**Home Screen**
- Clean, welcoming layout
- Clear emergency reminder (999)
- Easy access to "Need to Talk?" button
- Calm color palette

**AI Chat**
- Message bubbles with clear sender indication
- Typing indicator
- Warm, conversational interface
- Safety warning banner when appropriate

### Staff Portal Screenshots

**Dashboard**
- Professional, efficient layout
- Clear status indicators
- Alert priority visible
- Quick action buttons

**Safeguarding Alert**
- Red/Amber color coding
- Clear risk level badge
- Action buttons prominent
- Triggered phrases visible

### Admin Portal Screenshots

**Management Dashboard**
- Data-focused layout
- Clean charts and metrics
- Navigation sidebar
- Quick actions accessible

---

## File Assets

### Available Assets

```
/assets/
├── logo.png           # Full color logo
├── logo-white.png     # White logo for dark backgrounds
├── favicon.png        # Browser favicon
├── favicon.ico        # ICO format favicon
├── og-image.png       # Social media preview
└── icons/
    ├── app-icon.png   # App store icon
    └── notification.png # Notification icon
```

---

## Contact

For brand-related queries:
- Technical: [Development Team]
- Marketing: [Marketing Team]

---

*Brand Guidelines Version 1.0*
*Last Updated: February 2026*
*© Radio Check 2026*
