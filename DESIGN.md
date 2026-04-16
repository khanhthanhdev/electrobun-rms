# Design System — ElevenLabs Structure × OctoAI/STEAM Colors

## 1. Visual Theme & Atmosphere

This design system merges ElevenLabs' structural elegance — refined typography, generous whitespace — with a vibrant **pink–blue–purple** color identity drawn from **OctoAI** and **STEAM for Vietnam**. The result is a clean, flat, near-white canvas (`#ffffff`, `#f8f7ff`) where color is used purposefully through solid brand accents and clear borders. No shadows, no gradients — just clean surfaces, crisp borders, and strong typography.

The typography system is built on a fascinating duality: Waldenburg at weight 300 (light) for display headings creates ethereal, whisper-thin titles — delicate, precise, and surprisingly impactful at large sizes. Inter handles all body and UI text with workmanlike reliability, using slight positive letter-spacing (0.14px–0.18px) that gives body text an airy, well-spaced quality. WaldenburgFH appears as a bold uppercase variant for specific button labels.

**Key Characteristics:**
- Near-white canvas with cool-purple undertones (`#f8f7ff`, `#f0eeff`)
- Waldenburg weight 300 (light) for display — ethereal, whisper-thin headings
- Inter with positive letter-spacing (0.14–0.18px) for body — airy readability
- **No shadows** — depth conveyed through borders and background color shifts
- **No gradients** — solid colors only
- Pill buttons (9999px) with solid brand-colored backgrounds
- WaldenburgFH bold uppercase for specific CTA labels
- Geist Mono / ui-monospace for code snippets
- **Brand triad**: Pink (`#ee46bc`), Blue (`#447aff`), Purple (`#7a5af8`)

## 2. Color Palette & Roles

### Brand Colors (from OctoAI × STEAM for Vietnam)
- **Purple** (`#7a5af8`): Primary brand accent, CTAs, active states, links
- **Purple Dark** (`#5925dc`): Hover states, dark emphasis, link hover
- **Blue** (`#447aff`): Secondary brand accent, informational, interactive elements
- **Blue Light** (`#9bb4ff`): Light accent surface, tag backgrounds, highlights
- **Pink** (`#ee46bc`): Tertiary accent, badges, alerts, decorative highlights
- **Dark Navy** (`#172b4d`): Primary text color, headings

### Surfaces
- **Pure White** (`#ffffff`): Primary background, card surfaces
- **Lavender Mist** (`#f8f7ff`): Secondary surface — subtle purple-tinted canvas
- **Light Violet** (`#f0eeff`): Tertiary surface, section differentiation
- **Information Light** (`#d7defa`): Accent surface for highlights, callouts

### Neutral Scale
- **Cool Gray 700** (`#475467`): Secondary text, descriptions
- **Cool Gray 500** (`#6b778c`): Tertiary text, muted links, placeholders
- **Cool Gray 400** (`#98a2b3`): Disabled text, decorative elements
- **Cool Gray 300** (`#d0d5dd`): Borders, dividers
- **Dark** (`#212121`): Highest contrast text alternative

### Interactive
- **Focus Ring** (`rgba(68, 122, 255, 0.4)`): Focus outline (STEAM blue at 40%)
- **Border Light** (`#d0d5dd`): Explicit borders
- **Border Subtle** (`rgba(0, 0, 0, 0.05)`): Ultra-subtle bottom borders

### Accent (from STEAM for Vietnam)
- **Teal** (`#54c9c2`): Success states, positive indicators
- **Teal Dark** (`#38b2ab`): Success hover
- **Warning** (`#ffc400`): Warning states
- **Negative** (`#d0021b`): Error states, destructive actions

## 3. Typography Rules

### Font Families
- **Display**: `Waldenburg`, fallback: `Waldenburg Fallback`
- **Display Bold**: `WaldenburgFH`, fallback: `WaldenburgFH Fallback`
- **Body / UI**: `Inter`, fallback: `Inter Fallback`
- **Monospace**: `Geist Mono` or `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display Hero | Waldenburg | 48px (3.00rem) | 300 | 1.08 (tight) | -0.96px | Whisper-thin, ethereal |
| Section Heading | Waldenburg | 36px (2.25rem) | 300 | 1.17 (tight) | normal | Light display |
| Card Heading | Waldenburg | 32px (2.00rem) | 300 | 1.13 (tight) | normal | Light card titles |
| Body Large | Inter | 20px (1.25rem) | 400 | 1.35 | normal | Introductions |
| Body | Inter | 18px (1.13rem) | 400 | 1.44–1.60 | 0.18px | Standard reading text |
| Body Standard | Inter | 16px (1.00rem) | 400 | 1.50 | 0.16px | UI text |
| Body Medium | Inter | 16px (1.00rem) | 500 | 1.50 | 0.16px | Emphasized body |
| Nav / UI | Inter | 15px (0.94rem) | 500 | 1.33–1.47 | 0.15px | Navigation links |
| Button | Inter | 15px (0.94rem) | 500 | 1.47 | normal | Button labels |
| Button Uppercase | WaldenburgFH | 14px (0.88rem) | 700 | 1.10 (tight) | 0.7px | `text-transform: uppercase` |
| Caption | Inter | 14px (0.88rem) | 400–500 | 1.43–1.50 | 0.14px | Metadata |
| Small | Inter | 13px (0.81rem) | 500 | 1.38 | normal | Tags, badges |
| Code | Geist Mono | 13px (0.81rem) | 400 | 1.85 (relaxed) | normal | Code blocks |
| Micro | Inter | 12px (0.75rem) | 500 | 1.33 | normal | Tiny labels |
| Tiny | Inter | 10px (0.63rem) | 400 | 1.60 (relaxed) | normal | Fine print |

### Principles
- **Light as the hero weight**: Waldenburg at 300 is the defining typographic choice. Where other design systems use bold for impact, this system uses lightness — thin strokes creating intrigue through restraint.
- **Positive letter-spacing on body**: Inter uses +0.14px to +0.18px tracking across body text, creating an airy, well-spaced reading rhythm that contrasts with the tight display tracking (-0.96px).
- **WaldenburgFH for emphasis**: A bold (700) uppercase variant of Waldenburg appears only in specific CTA button labels with 0.7px letter-spacing — the one place where the type system gets loud.
- **Monospace as ambient**: Geist Mono at relaxed line-height (1.85) for code blocks feels unhurried and readable.

## 4. Component Stylings

### Buttons

**Primary Purple Pill**
- Background: `#7a5af8`
- Text: `#ffffff`
- Padding: 12px 32px
- Radius: 9999px (full pill)
- Hover: background `#5925dc`, text `#ffffff`
- Use: Primary CTA

**Outlined Pill**
- Background: `#ffffff`
- Text: `#172b4d`
- Border: `1px solid #d0d5dd`
- Radius: 9999px
- Hover: background `#f0eeff`, text `#172b4d`
- Use: Secondary CTA

**Blue Pill (STEAM-style)**
- Background: `#447aff`
- Text: `#ffffff`
- Padding: 12px 32px
- Radius: 9999px
- Hover: background `#2f3a7e`, text `#ffffff`
- Use: Secondary branded CTA

**Soft Purple Pill**
- Background: `#f0eeff`
- Text: `#7a5af8`
- Padding: 12px 20px
- Radius: 30px
- Hover: background `#7a5af8`, text `#ffffff`
- Use: Tertiary CTA, subtle action

**Uppercase Waldenburg Button**
- Font: WaldenburgFH 14px weight 700
- Text-transform: uppercase
- Letter-spacing: 0.7px
- Use: Specific bold CTA labels

### Cards & Containers
- Background: `#ffffff`
- Border: `1px solid #d0d5dd`
- Radius: 16px–24px (30px, 48px for larger cards)
- No shadow — border defines the edge
- Accent border option: `2px solid #7a5af8` on left/top for featured cards
- Content: product screenshots, code examples, data visualizations

### Inputs & Forms
- Textarea: padding 12px 20px, `1px solid #d0d5dd` border
- Select: white background, `1px solid #d0d5dd` border
- Radio: standard styling
- Focus: `outline: 2px solid rgba(68, 122, 255, 0.4)`

### Navigation
- Clean white sticky header, `border-bottom: 1px solid #d0d5dd`
- Inter 15px weight 500 for nav links, `#172b4d` text
- Pill CTAs right-aligned (purple primary, outlined secondary)
- Active link accent: `#7a5af8` underline or `border-bottom: 2px solid #7a5af8`
- Mobile: hamburger collapse at 1024px

### Image Treatment
- Product screenshots and data visualizations
- 20px–24px radius on image containers
- Full-width sections alternating white (`#ffffff`) and lavender mist (`#f8f7ff`)

### Distinctive Components

**Accent Section**
- Background: `#f0eeff` (light violet) or `#d7defa` (information light)
- Text: `#172b4d`
- Border: none — background color alone differentiates from white sections

**Featured Card**
- Background: `#ffffff`
- Border-left: `3px solid #7a5af8`
- Radius: 16px
- Clean separation via accent border, no shadow

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: 1px, 3px, 4px, 8px, 9px, 10px, 11px, 12px, 16px, 18px, 20px, 24px, 28px, 32px, 40px

### Grid & Container
- Centered content with generous max-width
- Single-column hero, expanding to feature grids
- Full-width colored sections for product showcases
- White card grids on lavender mist backgrounds

### Whitespace Philosophy
- **Apple-like generosity**: Massive vertical spacing between sections creates a premium, unhurried pace. Each section is an exhibit.
- **Tinted emptiness**: Whitespace carries a faint purple-lavender tint (`#f8f7ff`) — not cold, not warm, but branded.
- **Typography-led rhythm**: The light-weight Waldenburg headings create visual "whispers" that draw the eye through vast clean space.

### Border Radius Scale
- Minimal (2px): Small links, inline elements
- Subtle (4px): Nav items, tab panels, tags
- Standard (8px): Small containers
- Comfortable (10px–12px): Medium cards, dropdowns
- Card (16px): Standard cards, articles
- Large (18px–20px): Featured cards, code panels
- Section (24px): Large panels, section containers
- Soft Button (30px): Soft CTAs, large cards
- Large (48px): Large card panels
- Pill (9999px): Primary buttons, navigation pills

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | No border | Page background, text blocks |
| Bordered (Level 1) | `1px solid #d0d5dd` | Cards, containers, inputs |
| Accent-bordered (Level 2) | `2px solid #7a5af8` (left or top) | Featured cards, active states |
| Surface shift (Level 3) | Background `#f8f7ff` or `#f0eeff` | Section differentiation |
| Focus (Accessibility) | `outline: 2px solid rgba(68, 122, 255, 0.4)` | Keyboard focus (STEAM blue) |

**Depth Philosophy**: This system uses **no shadows**. Depth is conveyed entirely through borders and background color shifts. Cards use `1px solid #d0d5dd` borders. Featured elements use `2px solid #7a5af8` accent borders. Sections differentiate via alternating white and lavender backgrounds. The result is maximally clean and easy to read — no visual noise, just clear structure.

## 7. Do's and Don'ts

### Do
- Use Waldenburg weight 300 for all display headings — the lightness IS the brand
- Use brand triad (purple `#7a5af8`, blue `#447aff`, pink `#ee46bc`) for accents and CTAs
- Apply positive letter-spacing (+0.14px to +0.18px) on Inter body text
- Use 9999px radius for primary buttons — pill shape is standard
- Use `1px solid #d0d5dd` borders for card/container edges
- Keep the page predominantly white/lavender with subtle section differentiation
- Use WaldenburgFH bold uppercase ONLY for specific CTA button labels
- Use `#172b4d` (dark navy) as primary text — not pure black
- Use solid background colors (`#f8f7ff`, `#f0eeff`) for section differentiation
- Use accent borders (`#7a5af8`) to highlight featured elements

### Don't
- Don't use shadows — depth comes from borders and background shifts only
- Don't use gradients — solid colors only, everywhere
- Don't use glassmorphism, blur, or translucent overlays
- Don't use bold (700) Waldenburg for headings — weight 300 is non-negotiable
- Don't use warm/brown-tinted colors — the system is cool-tinted (purple/blue) throughout
- Don't apply negative letter-spacing to body text — Inter uses positive tracking
- Don't use sharp corners (<8px) on cards — the generous radius is structural
- Don't use colors outside the brand triad for accents — pink, blue, purple only
- Don't use pure `#000000` for body text — use dark navy `#172b4d` or `#212121`

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <1024px | Single column, hamburger nav, stacked sections |
| Desktop | >1024px | Full layout, horizontal nav, multi-column grids |

### Touch Targets
- Pill buttons with generous padding (12px–20px)
- Navigation links at 15px with adequate spacing
- Select dropdowns maintain comfortable sizing

### Collapsing Strategy
- Navigation: horizontal → hamburger at 1024px
- Feature grids: multi-column → stacked
- Hero: maintains centered layout, font scales proportionally
- Colored sections: full-width maintained, content stacks
- Spacing compresses proportionally

### Image Behavior
- Product screenshots scale responsively
- Rounded corners maintained across breakpoints

## 9. Agent Prompt Guide

### Quick Color Reference
- Background: Pure White (`#ffffff`) or Lavender Mist (`#f8f7ff`)
- Text: Dark Navy (`#172b4d`)
- Secondary text: Cool Gray 700 (`#475467`)
- Muted text: Cool Gray 500 (`#6b778c`)
- Primary accent: Purple (`#7a5af8`)
- Secondary accent: Blue (`#447aff`)
- Tertiary accent: Pink (`#ee46bc`)
- Border: `#d0d5dd`
- Accent border: `#7a5af8`
- Section bg: `#f8f7ff` or `#f0eeff`

### Example Component Prompts
- "Create a hero on white background. Headline at 48px Waldenburg weight 300, line-height 1.08, letter-spacing -0.96px, #172b4d text. Subtitle at 18px Inter weight 400, line-height 1.60, letter-spacing 0.18px, #475467 text. Two pill buttons: purple #7a5af8 (9999px, 12px 32px padding, white text) and outlined (white bg, 1px solid #d0d5dd, 9999px)."
- "Design a card: white background, 20px radius, 1px solid #d0d5dd border. No shadow. Title at 32px Waldenburg weight 300 #172b4d, body at 16px Inter weight 400 letter-spacing 0.16px, #475467."
- "Build an outlined pill button: white bg, 9999px radius, 1px solid #d0d5dd border. Text at 15px Inter weight 500 #172b4d. Hover: bg #f0eeff, text #172b4d."
- "Create an uppercase CTA label: 14px WaldenburgFH weight 700, text-transform uppercase, letter-spacing 0.7px, #7a5af8 color."
- "Design navigation: white sticky header, border-bottom 1px solid #d0d5dd. Inter 15px weight 500 #172b4d. Purple pill CTA right-aligned (#7a5af8). Active link: border-bottom 2px solid #7a5af8."

### Iteration Guide
1. Start with white — use `#f8f7ff` or `#f0eeff` for section alternation, never gradients
2. Waldenburg 300 for headings — never bold, the lightness is the identity
3. Borders only — `1px solid #d0d5dd` for edges, `2px solid #7a5af8` for accent
4. Positive letter-spacing on Inter body (+0.14px to +0.18px) — the airy reading quality
5. Solid purple pill is the primary CTA — `#7a5af8` bg, white text
6. Pill (9999px) for buttons, generous radius (16px–24px) for cards
7. No shadows, no gradients, no blur — clean and clear always
