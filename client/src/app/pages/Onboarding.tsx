import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Switch } from "../components/ui/Switch";
import Strands from "../components/ui/strands";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Bot,
  Mail,
  Calendar,
  DollarSign,
  Bell,
  ArrowRight,
  Lock,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/client";
import { useCreateKey } from "../../hooks/useKey";
import { authApi } from "../../api/auth";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

export const Onboarding = () => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Auth step state
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Telegram link token state
  const [token, setToken] = useState<string | undefined | null>(null);

  // LLM step state
  const [cloudProvider, setCloudProvider] = useState<"groq">("groq");

  const { mutateAsync: createKey } = useCreateKey();

  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // Integration step state
  const [integrations, setIntegrations] = useState({
    calendar: false,
    gmail: false,
    expenses: true,
    reminders: true,
  });

  // ── Auth mutations ─────────────────────────────────────────────
  const signupMutation = useMutation({
    mutationFn: () => authApi.setup({ email, username, password }),
    onSuccess: async () => {
      // Auto-login after signup
      const tokens = await authApi.login({ username, password });
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      toast.success("Welcome to Nexus!");
      setStep(3);
    },
    onError: (error: AxiosError<{ detail: string }>) => {
      const msg =
        error.response?.data?.detail ?? "Sign up failed. Please try again.";
      toast.error(msg);
    },
  });

  const loginMutation = useMutation({
    mutationFn: () => authApi.login({ username, password }),
    onSuccess: async (data) => {
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      const user = await authApi.me();
      if (user.is_setup_complete) {
        navigate("/dashboard");
      } else {
        toast.success("Welcome back!");
        setStep(3);
      }
    },
    onError: (error: AxiosError<{ detail: string }>) => {
      const msg =
        error.response?.data?.detail ?? "Login failed. Please try again.";
      toast.error(msg);
    },
  });

  const isPending = signupMutation.isPending || loginMutation.isPending;

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === "signup") {
      signupMutation.mutate();
    } else {
      loginMutation.mutate();
    }
  };

  // ── Other handlers ─────────────────────────────────────────────
  const handleGenerateToken = async () => {
    const res = await api.post("/auth/generate-link-token");
    setToken(res.data.token);
  };

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(`/link ${token}`);
      toast.success("Command copied to clipboard");
    }
  };

  const finishOnboarding = async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    navigate("/dashboard");
  };

  return (
    <div className="h-screen w-screen bg-background onboarding-theme relative overflow-hidden">
      {/* ─── Ambient glow (only visible on non-auth steps) ─── */}
      {step !== 2 && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-spin-slow" />
      )}

      {/* ─── Steps 1, 3-6: centered container ─── */}
      {step !== 2 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
          <AnimatePresence mode="wait">
            {/* ── STEP 1: Welcome ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center justify-center gap-8 text-center max-w-lg w-full">
                <div className="relative w-72 h-72 flex items-center justify-center">
                  <Strands />
                </div>
                <div className="space-y-4 max-w-md">
                  <h1 className="text-5xl tracking-tight text-foreground leading-tight font-sans">
                    Welcome to Nexus
                  </h1>
                  <p className="text-muted-foreground text-sm font-light px-4 leading-relaxed">
                    A human-centric workspace designed to simplify your digital
                    life. Let's get you set up in a few simple steps.
                  </p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="group flex items-center justify-center w-16 h-16 bg-foreground text-background rounded-full hover:opacity-90 transition-all duration-300 hover:scale-105 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  aria-label="Next screen">
                  <ArrowRight className="w-6 h-6 transition-transform duration-300 group-hover:translate-x-1 text-background" />
                </button>
              </motion.div>
            )}

            {/* ── STEP 3: Connect Telegram ── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center text-center space-y-6 w-full max-w-[520px]">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-3xl tracking-wide font-light">
                  Connect Telegram
                </h1>
                <p className="text-muted-foreground max-w-md">
                  Nexus lives in Telegram. Link your account to start chatting
                  with your personal assistant.
                </p>
                <Card className="w-full p-8 flex flex-col items-center space-y-6 border-border/50 bg-card/50 backdrop-blur-sm">
                  {!token ? (
                    <Button
                      onClick={handleGenerateToken}
                      size="lg"
                      className="w-full sm:w-auto">
                      Generate Link Token
                    </Button>
                  ) : (
                    <div className="flex flex-col items-center space-y-4 w-full">
                      <p className="text-sm text-muted-foreground">
                        Send this command to the Nexus bot:
                      </p>
                      <div className="flex items-center justify-between w-full p-6 bg-background border border-border rounded-lg">
                        <code className="font-mono text-primary font-medium tracking-wider">
                          /link {token}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyToken}
                          className="h-8 w-8 p-0">
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
                <Button
                  variant="outline"
                  onClick={() => setStep(4)}
                  className="cursor-pointer text-muted-foreground text-xs">
                  Continue
                </Button>
              </motion.div>
            )}

            {/* ── STEP 4: Choose LLM ── */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col space-y-6 w-full max-w-[520px]">
                <div className="text-center">
                  <h1 className="text-3xl tracking-wide font-light">
                    Choose your LLM
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    Where should Nexus process your requests?
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Card
                    hoverable
                    className={`p-6 cursor-pointer transition-colors ${cloudProvider === "groq" ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => setCloudProvider("groq")}>
                    <h3 className="font-medium mb-2">Groq</h3>
                    <p className="text-xs text-muted-foreground">
                      Fastest responses
                    </p>
                  </Card>
                  <Card hoverable={false} className="p-6 text-muted-foreground">
                    <h3 className="font-medium mb-2">More Coming Soon!</h3>
                    <p className="text-xs text-muted-foreground">
                      Open Source Models
                    </p>
                  </Card>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="gsk_..."
                      className="p-6 mt-2"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => {
                      createKey({ key: apiKey, provider: cloudProvider });
                      setStep(5);
                    }}
                    disabled={!apiKey}
                    size="lg">
                    Continue
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 5: Integrations ── */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col space-y-6 w-full max-w-[520px]">
                <div className="text-center">
                  <h1 className="text-3xl tracking-wide font-light">
                    Enable Integrations
                  </h1>
                  <p className="text-muted-foreground mt-2">
                    Give Nexus access to your digital life.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium">Gmail</h4>
                        <p className="text-xs text-muted-foreground">
                          Send and summarize
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm">
                      Connect
                    </Button>
                  </Card>
                  <Card className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium">Google Calendar</h4>
                        <p className="text-xs text-muted-foreground">
                          Manage events
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm">
                      Connect
                    </Button>
                  </Card>
                  <Card className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium">Expenses</h4>
                        <p className="text-xs text-muted-foreground">
                          Built-in tracking
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={integrations.expenses}
                      onCheckedChange={(c) =>
                        setIntegrations({ ...integrations, expenses: c })
                      }
                    />
                  </Card>
                  <Card className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium">Reminders</h4>
                        <p className="text-xs text-muted-foreground">
                          Built-in reminders
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={integrations.reminders}
                      onCheckedChange={(c) =>
                        setIntegrations({ ...integrations, reminders: c })
                      }
                    />
                  </Card>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <Button variant="ghost" onClick={() => setStep(6)}>
                    Skip for now
                  </Button>
                  <Button onClick={() => setStep(6)} size="lg">
                    Continue
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 6: All done ── */}
            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex flex-col items-center text-center space-y-6 max-w-[520px] w-full">
                <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center">
                  <Check className="w-10 h-10 text-success" />
                </div>
                <h1 className="text-3xl tracking-wide font-light">
                  Nexus is ready.
                </h1>
                <p className="text-muted-foreground">
                  Your personal assistant is fully configured.
                </p>
                <div className="pt-4 flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    onClick={finishOnboarding}
                    variant="secondary">
                    Go to Dashboard
                  </Button>
                  <Button
                    size="lg"
                    onClick={() =>
                      window.open("tg://resolve?domain=NexusBot", "_blank")
                    }>
                    Open Telegram
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Step 2: Full-screen auth panel ─── */}
      <AnimatePresence>
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-20 flex">
            {/* Left: dark animated panel */}
            <div
              className="relative hidden sm:flex w-[45%] flex-shrink-0 flex-col justify-between p-12 overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, #0e0b1a 0%, #16114a 40%, #0a1a3a 70%, #091520 100%)",
              }}>
              <div className="absolute inset-0">
                <Strands
                  colors={["#7C6AFF", "#a78bfa", "#38bdf8", "#818cf8"]}
                  count={5}
                  speed={0.18}
                  amplitude={0.7}
                  thickness={0.55}
                  glow={3.2}
                  taper={2.8}
                  spread={2.2}
                  intensity={0.55}
                  saturation={1.8}
                  opacity={0.95}
                  scale={1.2}
                />
              </div>
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                  <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-6">
                    Nexus
                  </p>
                  <h2 className="text-white text-4xl font-light leading-tight tracking-tight">
                    Your personal
                    <br />
                    AI, always
                    <br />
                    with you.
                  </h2>
                  <p className="mt-5 text-white/40 text-sm leading-relaxed max-w-xs">
                    Think less, do more. Nexus handles the context so you can
                    focus on what matters.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Telegram", "Memory", "Reminders", "Gmail"].map((tag) => (
                    <span
                      key={tag}
                      className="text-white/35 text-xs border border-white/10 rounded-full px-3 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: form panel */}
            <div className="flex-1 flex flex-col justify-center px-10 lg:px-10 bg-card overflow-y-auto">
              <div className="w-full max-w-md mx-auto">
                <div className="mb-7">
                  <h1 className="text-2xl font-normal tracking-tight text-foreground">
                    {authMode === "signup"
                      ? "Create your account"
                      : "Welcome back"}
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1.5">
                    {authMode === "signup"
                      ? "Set up Nexus in just a few minutes."
                      : "Sign in to continue to your workspace."}
                  </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                  <AnimatePresence mode="wait">
                    {authMode === "signup" && (
                      <motion.div
                        key="email-field"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Email
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                              type="email"
                              placeholder="you@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required={authMode === "signup"}
                              className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder={
                          authMode === "signup" ? "johndoe" : "your username"
                        }
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full h-11 pl-10 pr-11 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full h-11 mt-2 rounded-xl bg-foreground text-background font-medium text-sm hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isPending
                      ? authMode === "signup"
                        ? "Creating account…"
                        : "Signing in…"
                      : authMode === "signup"
                        ? "Create account"
                        : "Sign in"}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() =>
                    setAuthMode(authMode === "signup" ? "login" : "signup")
                  }
                  className="mt-5 text-xs text-muted-foreground hover:text-foreground transition-colors text-center w-full">
                  {authMode === "signup"
                    ? "Already have an account? Sign in →"
                    : "Don't have an account? Sign up →"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
