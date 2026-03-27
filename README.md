# STEAM For Vietnam - Robotics Team

## National Robotics Competition

A desktop application for managing robotics competition matches, built with Electrobun for cross-platform deployment (Windows, macOS, Linux).

## Purpose

This system is designed for the **National Robotics Competition** to handle:

- **Match scheduling & execution** - Qualification, playoff, and practice matches
- **Live scoring** - Real-time score entry with audience display sync
- **Team inspection** - Robot inspection workflow for competition eligibility
- **Rankings & alliances** - Auto-generated qualification rankings and alliance selection
- **Audience displays** - Match previews, live timers, and results broadcasting

The app runs as a **desktop application** using Electrobun (Bun runtime + embedded browser) and serves a web-based UI that can also be accessed remotely via LAN for distributed operator stations.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Electrobun Desktop App                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   React UI      │  │   Hono Server   │  │   SQLite DB     │  │
│  │   (Webview)     │◄─┤   (Port 3002)   │◄─┤   (bun:sqlite)  │  │
│  │   Port 5173     │  │   REST + SSE    │  │   Local storage │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│         ▲                      │                                 │
│         │ HMR (dev)            │ LAN access                      │
│         │                      ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Remote Clients (Tablets, Scorekeepers, Audience Displays)  ││
│  │  Access via http://<local-ip>:3002                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Deployment Model

1. **Desktop App (Primary)** - Runs on event server machine with embedded webview
2. **LAN Access** - Operator tablets and displays access via `http://<local-ip>:3002`
3. **Auto-Update** - Built-in updater pulls releases from GitHub

### Tech Stack

- **Runtime**: Bun + Electrobun
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Hono (lightweight HTTP framework)
- **Database**: bun:sqlite with Drizzle ORM
- **Realtime**: SSE (Server-Sent Events) for live sync
- **State**: TinyBase for reactive client state

## Getting Started

```bash
# Install dependencies
bun install

# Development without HMR (uses bundled assets)
bun run dev

# Development with HMR (recommended)
bun run dev:hmr

# Build for production
bun run build

# Build for production release
bun run build:prod
```

## How HMR Works

When you run `bun run dev:hmr`:

1. **Vite dev server** starts on `http://localhost:5173` with HMR enabled
2. **Electrobun** starts and detects the running Vite server
3. The app loads from the Vite dev server instead of bundled assets
4. Changes to React components update instantly without full page reload

When you run `bun run dev` (without HMR):

1. Electrobun starts and loads from `views://mainview/index.html`
2. You need to rebuild (`bun run build`) to see changes

## Project Structure

```
├── src/
│   ├── bun/
│   │   ├── index.ts            # Main process (Electrobun/Bun entry)
│   │   ├── db/                 # Database migrations & seeding
│   │   └── server/
│   │       ├── api/            # REST API routes (Hono)
│   │       ├── application/    # Use cases & business logic
│   │       ├── domain/         # Domain models & interfaces
│   │       └── infrastructure/ # Adapters, repositories, services
│   └── mainview/
│       ├── App.tsx             # React app component
│       ├── main.tsx            # React entry point
│       ├── index.html          # HTML template
│       ├── features/           # Feature modules (inspection, scoring, etc.)
│       └── components/         # Shared UI components
├── docs/
│   ├── realtime-sync-architecture.md  # SSE sync pattern
│   ├── match-control.md               # Match control workflow
│   └── display-control.md             # Audience display docs
├── electrobun.config.ts        # Electrobun configuration
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
└── package.json
```

## Customizing

- **React components**: Edit files in `src/mainview/`
- **Tailwind theme**: Edit `tailwind.config.js`
- **Vite settings**: Edit `vite.config.ts`
- **Window settings**: Edit `src/bun/index.ts`
- **App metadata**: Edit `electrobun.config.ts`
- **Database schema**: Edit files in `src/bun/db/`

## Documentation

- [Realtime Sync Architecture](./docs/realtime-sync-architecture.md) - SSE pattern for live data
- [Match Control Workflow](./docs/match-control.md) - Match execution flow
- [Display Control](./docs/display-control.md) - Audience display configuration
- [Match Scheduling Algorithms](./docs/match-scheduling-algorithms.md) - Schedule generation

## License

MIT
