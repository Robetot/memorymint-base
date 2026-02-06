import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@farcaster/auth-kit/styles.css";
import "./index.css";

// Remove the initial loader once React mounts
const removeLoader = () => {
  const loader = document.getElementById('game-loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 500);
  }
};

createRoot(document.getElementById("root")!).render(<App />);

// Remove loader after a brief delay to ensure React has rendered
setTimeout(removeLoader, 100);
