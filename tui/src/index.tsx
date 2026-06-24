#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./App.js";
import { hasValidConfig } from "./config.js";
import type { Screen } from "./api/types.js";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const configured = hasValidConfig();

// Always boot to chat if configured; setup wizard if first run.
const initialScreen: Screen = configured ? "chat" : "setup-wizard";

render(React.createElement(App, { initialScreen, hasConfig: configured }));
