import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app/styles/global.css";
import "@knadh/oat/oat.min.js";
import App from "./app/app";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
