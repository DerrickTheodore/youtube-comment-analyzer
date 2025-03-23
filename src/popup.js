import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Render the React component
const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);
