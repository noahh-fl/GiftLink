import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ToastProvider } from "./contexts/ToastContext";
import { SpaceProvider } from "./contexts/SpaceContext";
import "./ui/tokens/tokens.css";
import "./ui/styles/base.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <SpaceProvider>
          <App />
        </SpaceProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
