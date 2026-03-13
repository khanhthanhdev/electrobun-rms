import "@knadh/oat/oat.min.js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app/styles/index.css";
import App from "./app/app";

const CHUNK_RELOAD_KEY = "rtms_chunk_reload";
const CHUNK_RELOAD_WINDOW_MS = 10_000;

interface ChunkReloadState {
  path: string;
  timestamp: number;
}

const removeChunkReloadState = (): void => {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // Ignore storage access failures.
  }
};

const readChunkReloadState = (): ChunkReloadState | null => {
  let rawState: string | null = null;

  try {
    rawState = sessionStorage.getItem(CHUNK_RELOAD_KEY);
  } catch {
    return null;
  }

  if (!rawState) {
    return null;
  }

  try {
    const parsedState = JSON.parse(rawState) as Partial<ChunkReloadState>;
    if (
      typeof parsedState.path !== "string" ||
      typeof parsedState.timestamp !== "number"
    ) {
      removeChunkReloadState();
      return null;
    }

    if (Date.now() - parsedState.timestamp > CHUNK_RELOAD_WINDOW_MS) {
      removeChunkReloadState();
      return null;
    }

    return {
      path: parsedState.path,
      timestamp: parsedState.timestamp,
    };
  } catch {
    removeChunkReloadState();
    return null;
  }
};

const writeChunkReloadState = (path: string): boolean => {
  try {
    sessionStorage.setItem(
      CHUNK_RELOAD_KEY,
      JSON.stringify({ path, timestamp: Date.now() })
    );
    return true;
  } catch {
    return false;
  }
};

const installChunkLoadRecovery = (): void => {
  window.addEventListener("vite:preloadError", (event) => {
    const preloadErrorEvent = event as Event & { payload?: unknown };
    const error = preloadErrorEvent.payload;
    const message =
      error instanceof Error ? error.message : String(error ?? "");
    const isChunkLoadError =
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Unable to preload CSS");

    if (!isChunkLoadError) {
      return;
    }

    const currentPath = window.location.pathname;
    const previousReload = readChunkReloadState();
    if (previousReload?.path === currentPath) {
      return;
    }

    event.preventDefault();
    if (!writeChunkReloadState(currentPath)) {
      return;
    }

    window.location.reload();
  });
};

installChunkLoadRecovery();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
