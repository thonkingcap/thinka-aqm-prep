import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./components/components.css";
import App from "./App.tsx";
import { SessionProvider } from "./session.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
