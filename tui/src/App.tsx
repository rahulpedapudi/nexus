import React, { useState } from "react";
import { useInput } from "ink";

import { Chat } from "./screens/Chat.js";
import { MainMenu } from "./screens/MainMenu.js";
import { SetupWizard } from "./screens/SetupWizard.js";
import { Dashboard } from "./screens/Dashboard.js";
import { Integrations } from "./screens/Integrations.js";
import { ConfigEditor } from "./screens/ConfigEditor.js";
import type { Screen } from "./api/types.js";

interface AppProps {
  initialScreen: Screen;
  hasConfig: boolean;
}

export function App({ initialScreen, hasConfig }: AppProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [configReady, setConfigReady] = useState(hasConfig);

  const navigateTo = (next: Screen) => setScreen(next);
  const backToChat = () => setScreen("chat");
  const backToMenu = () => setScreen("main-menu");

  // if the screen is main-menu, q or ctrl+c should exit the app
  useInput((input, key) => {
    if (
      (input === "q" || (key.ctrl && input === "c")) &&
      screen === "main-menu"
    ) {
      process.exit(0);
    }
  });

  switch (screen) {
    case "chat":
      return <Chat onNavigate={navigateTo} />;

    case "main-menu":
      return (
        <MainMenu
          onNavigate={navigateTo}
          hasConfig={configReady}
          onBackToChat={backToChat}
        />
      );

    case "setup-wizard":
      return (
        <SetupWizard
          onComplete={() => {
            setConfigReady(true);
            setScreen("chat");
          }}
          onBack={() => setScreen(configReady ? "chat" : "main-menu")}
        />
      );

    case "dashboard":
      return <Dashboard onBack={backToChat} />;

    case "integrations":
      return <Integrations onBack={backToChat} />;

    case "config-editor":
      return <ConfigEditor onBack={backToChat} />;

    default:
      return <Chat onNavigate={navigateTo} />;
  }
}
