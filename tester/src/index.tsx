import React from "react";
import ReactDOM from "react-dom/client";
import { initializeIcons } from "@fluentui/react";

import "./index.css";
import App from "./App";
import Health from "./Health";

initializeIcons();

const path = window.location.pathname.replace(/\/+$/, "");
const Page = path === "/tester/health" ? Health : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <Page />
    </React.StrictMode>
);
