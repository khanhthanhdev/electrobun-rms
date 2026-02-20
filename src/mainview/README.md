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
