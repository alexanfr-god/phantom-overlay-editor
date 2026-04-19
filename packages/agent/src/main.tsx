import React from "react";
import { createRoot } from "react-dom/client";
import { AgentOverlay } from "./AgentOverlay";

const root = createRoot(document.getElementById("root")!);
root.render(<AgentOverlay />);
