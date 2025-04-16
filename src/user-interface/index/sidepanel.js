import React from "react";
import { createRoot } from "react-dom/client";
import AppController from "../controllers/AppController";

// ReactDOM rendering
const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <AppController />
  </React.StrictMode>
);
