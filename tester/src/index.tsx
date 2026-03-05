import React from "react";
import ReactDOM from "react-dom/client";
import { initializeIcons } from "@fluentui/react";

import "./index.css";
import App from "./App";

initializeIcons();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
