import { useState, useEffect } from "react";
import { PageTransition } from "../components/ui/PageTransition";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Switch } from "../components/ui/Switch";
import { Input } from "../components/ui/Input";
import {
  Mail,
  Calendar,
  DollarSign,
  Bell,
  Cpu,
  X,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useListKeys, useCreateKey } from "../../hooks/useKey";

const STATIC_INTEGRATIONS = [
  {
    id: "calendar",
    name: "Google Calendar",
    description: "Read and create events via Telegram",
    icon: Calendar,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    connected: false,
    type: "oauth",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Send emails and read summaries",
    icon: Mail,
    color: "text-red-500",
    bg: "bg-red-500/10",
    connected: false,
    type: "oauth",
  },
  {
    id: "expenses",
    name: "Expense Tracking",
    description: "Built-in. Log and categorize spending.",
    icon: DollarSign,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    connected: true,
    type: "internal",
  },
  {
    id: "reminders",
    name: "Reminders",
    description: "Built-in. Natural language reminders.",
    icon: Bell,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    connected: true,
    type: "internal",
  },
];

// Providers the backend currently supports
const CLOUD_PROVIDERS = ["groq"] as const;
type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

const PROVIDER_LABELS: Record<CloudProvider, string> = {
  groq: "Groq",
};

export const Integrations = () => {
  const [integrations, setIntegrations] = useState(STATIC_INTEGRATIONS);
  const [isLlmDrawerOpen, setIsLlmDrawerOpen] = useState(false);

  // ── Backend state ────────────────────────────────────────────────────
  const { data: configuredProviders = [], isLoading: isLoadingKeys } =
    useListKeys();
  const { mutateAsync: saveKey, isPending: isSaving } = useCreateKey();

  // Derive the active provider from what the backend returns
  const activeProvider = (configuredProviders.find((p) =>
    CLOUD_PROVIDERS.includes(p as CloudProvider),
  ) ?? null) as CloudProvider | null;

  // ── Drawer local state ───────────────────────────────────────────────
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>("groq");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // Sync drawer defaults when it opens
  useEffect(() => {
    if (isLlmDrawerOpen) {
      setCloudProvider(activeProvider ?? "groq");
      setApiKey(""); // never pre-fill the actual key for security
      setShowApiKey(false);
    }
  }, [isLlmDrawerOpen, activeProvider]);

  const toggleConnection = (id: string) => {
    setIntegrations(
      integrations.map((i) =>
        i.id === id ? { ...i, connected: !i.connected } : i,
      ),
    );
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    await saveKey({ key: apiKey, provider: cloudProvider });
    setIsLlmDrawerOpen(false);
  };

  // ── Derived display label ────────────────────────────────────────────
  const configLabel = isLoadingKeys
    ? "Loading…"
    : activeProvider
      ? `Cloud · ${PROVIDER_LABELS[activeProvider]}`
      : "Not configured";

  return (
    <PageTransition className="space-y-10 pb-12">
      <div>
        <h1 className="text-3xl font-light tracking-wide">Connected Tools</h1>
        <p className="text-muted-foreground mt-2">
          Everything Nexus can reach on your behalf.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.id} className="p-6 flex flex-col h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl ${integration.bg} flex items-center justify-center ${integration.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg">{integration.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className={`w-2 h-2 rounded-full ${integration.connected ? "bg-success" : "bg-muted-foreground/50"}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {integration.connected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                  </div>
                </div>
                {integration.type === "oauth" ? (
                  integration.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleConnection(integration.id)}>
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => toggleConnection(integration.id)}>
                      Connect
                    </Button>
                  )
                ) : (
                  <Switch
                    checked={integration.connected}
                    onCheckedChange={() => toggleConnection(integration.id)}
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-6 flex-grow">
                {integration.description}
              </p>
            </Card>
          );
        })}
      </div>

      {/* ── LLM Section ──────────────────────────────────────────────── */}
      <div className="pt-8 border-t border-border">
        <h2 className="text-xl font-medium mb-2 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" /> Core Intelligence
        </h2>
        <Card className="p-6 mt-4 flex items-center justify-between">
          <div>
            <h3 className="font-medium">Language Model Configuration</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Currently using{" "}
              <span
                className={`font-medium ${activeProvider ? "text-foreground" : "text-muted-foreground"}`}>
                {configLabel}
              </span>
            </p>
          </div>
          <Button variant="outline" onClick={() => setIsLlmDrawerOpen(true)}>
            {activeProvider ? "Edit Configuration" : "Configure"}
          </Button>
        </Card>
      </div>

      {/* ── Drawer ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isLlmDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              onClick={() => setIsLlmDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-border z-50 p-6 flex flex-col shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-medium">LLM Configuration</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsLlmDrawerOpen(false)}
                  className="h-8 w-8 p0">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-6 flex-grow">
                {/* Provider selector */}
                <div className="grid grid-cols-2 gap-4">
                  {CLOUD_PROVIDERS.map((p) => (
                    <Card
                      key={p}
                      hoverable
                      className={`p-4 cursor-pointer transition-colors ${cloudProvider === p ? "border-primary bg-primary/5" : ""}`}
                      onClick={() => setCloudProvider(p)}>
                      <h3 className="font-medium text-sm text-center">
                        {PROVIDER_LABELS[p]}
                      </h3>
                    </Card>
                  ))}
                  <Card className="p-4 opacity-50 cursor-not-allowed">
                    <h3 className="font-medium text-sm text-center text-muted-foreground">
                      More soon…
                    </h3>
                  </Card>
                </div>

                {/* API key input */}
                <div className="space-y-2 relative">
                  <label className="text-sm font-medium">API Key</label>
                  {activeProvider === cloudProvider && !apiKey && (
                    <p className="text-md text-muted-foreground">
                      A key for{" "}
                      <span className="text-foreground font-medium">
                        {PROVIDER_LABELS[cloudProvider]}
                      </span>{" "}
                      is already saved. Enter a new key to replace it.
                    </p>
                  )}
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        cloudProvider === "groq" ? "gsk_..." : "sk-..."
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border mt-auto">
                <Button
                  className="w-full"
                  onClick={handleSaveKey}
                  disabled={!apiKey.trim() || isSaving}>
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};
