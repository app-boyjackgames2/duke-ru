import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply theme before render to avoid flash
const stored = localStorage.getItem("duke-theme") || "dark";
if (stored === "light") {
  document.documentElement.classList.add("light");
} else if (stored === "system") {
  if (!window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.classList.add("light");
  }
}

createRoot(document.getElementById("root")!).render(<App />);
