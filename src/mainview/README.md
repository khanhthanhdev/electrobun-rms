# Frontend Structure

This frontend uses a layered structure to keep concerns isolated and easy to scale.

- `app/`: App shell and global styles.
- `pages/`: Page-level composition.
- `widgets/`: Cross-feature UI sections.
- `features/`: Feature modules with local hooks, services, and components.
- `shared/`: Reusable primitives (types, API helpers, constants, utils, UI).

Rules used in this structure:
- Keep API calls in `services/`, not directly in UI components.
- Keep feature state in feature hooks (`hooks/`).
- Keep shared types and utilities framework-agnostic.
- Avoid barrel files; import directly from module files.

## CSS Structure

This frontend uses Oat UI as the styling baseline and a layered CSS structure
for project-specific styles:

- `app/styles/index.css`: Single stylesheet entry imported by `main.tsx`.
- `app/styles/tokens.css`: Theme and design-token overrides.
- `app/styles/base.css`: Global element defaults and shared text helpers.
- `app/styles/layout.css`: Reusable layout primitives (page shell, surface card,
  stacks, form grid, table wrappers).
- `app/styles/components/*.css`: Component-specific styles (`site-header`,
  `events`, `forms`, `tables`, `event-card`).

Guidelines:

- Prefer semantic HTML and Oat defaults before adding custom classes.
- Prefer Oat component patterns (`card`, `button`, `[data-field]`, etc.) over
  custom UI primitives.
- Use reusable layout primitives (`page-shell`, `surface-card`, `stack`) for
  consistency.
- Keep component-specific styling in the matching `components/*.css` file.
- Add new tokens in `tokens.css` and consume them in component styles instead
  of hard-coding colors and spacing repeatedly.
- Keep interactions visually static: no animations and no hover-only style
  changes.
