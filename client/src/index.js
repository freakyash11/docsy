import React from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./styles.css"
import './index.css';
import { ThemeProvider } from "./context/ThemeContext"; // Import the provider

const container = document.getElementById("root")
const root = createRoot(container)

root.render(
  <React.StrictMode>
    {/* Wrap App with ThemeProvider */}
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)