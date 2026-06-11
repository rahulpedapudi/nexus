import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Switch } from '../components/ui/Switch';
import { useStore } from '../store';
import { Check, Copy, Eye, EyeOff, Bot, BrainCircuit, Mail, Calendar, DollarSign, Bell } from 'lucide-react';
import { toast } from 'sonner';

export const Onboarding = () => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const setHasOnboarded = useStore((state) => state.setHasOnboarded);

  // Step 1 State
  const [token, setToken] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(600);
  const [isLinked, setIsLinked] = useState(false);

  // Step 2 State
  const [llmType, setLlmType] = useState<'local' | 'cloud'>('cloud');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [cloudProvider, setCloudProvider] = useState<'openai' | 'groq'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Step 3 State
  const [integrations, setIntegrations] = useState({
    calendar: false,
    gmail: false,
    expenses: true,
    reminders: true,
  });

  const handleGenerateToken = () => {
    // Mock API call
    setToken('NEXUS-8A2F');
    setCountdown(600);
  };

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(`/link ${token}`);
      toast.success('Command copied to clipboard');
    }
  };

  // Mock Polling
  useEffect(() => {
    if (step === 1 && token && !isLinked) {
      const interval = setInterval(() => {
        // Mock successful link after 5 seconds
        setIsLinked(true);
        toast.success('Telegram successfully linked!');
        setTimeout(() => setStep(2), 1500);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [step, token, isLinked]);

  const testConnection = () => {
    setIsTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult('success');
    }, 1000);
  };

  const finishOnboarding = () => {
    setHasOnboarded(true);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[600px] relative z-10">
        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-12">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'bg-secondary'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center space-y-6"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl tracking-wide font-light">Connect Telegram</h1>
              <p className="text-muted-foreground max-w-md">
                Nexus lives in Telegram. Link your account to start chatting with your personal assistant.
              </p>

              <Card className="w-full p-8 mt-4 flex flex-col items-center space-y-6 border-border/50 bg-card/50 backdrop-blur-sm">
                {!token ? (
                  <Button onClick={handleGenerateToken} size="lg" className="w-full sm:w-auto">
                    Generate Link Token
                  </Button>
                ) : (
                  <div className="flex flex-col items-center space-y-4 w-full">
                    <p className="text-sm text-muted-foreground">Send this command to the Nexus bot:</p>
                    <div className="flex items-center justify-between w-full max-w-sm bg-background border border-border rounded-lg p-3">
                      <code className="font-mono text-primary font-medium tracking-wider">/link {token}</code>
                      <Button variant="ghost" size="sm" onClick={handleCopyToken} className="h-8 w-8 p-0">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Waiting for connection... (expires in {Math.floor(countdown / 60)}:
                      {(countdown % 60).toString().padStart(2, '0')})
                    </div>
                  </div>
                )}
              </Card>
              {/* Skip for mock purposes */}
              <Button variant="ghost" onClick={() => setStep(2)} className="mt-4 text-muted-foreground text-xs">
                Skip for now (Dev)
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col space-y-6"
            >
              <div className="text-center mb-4">
                <h1 className="text-3xl tracking-wide font-light">Choose your LLM</h1>
                <p className="text-muted-foreground mt-2">Where should Nexus process your requests?</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card
                  hoverable
                  className={`p-6 cursor-pointer transition-colors ${llmType === 'local' ? 'border-primary bg-primary/5' : ''}`}
                  onClick={() => setLlmType('local')}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Local (Ollama)</h3>
                    <div className={`w-4 h-4 rounded-full border ${llmType === 'local' ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                  </div>
                  <p className="text-xs text-muted-foreground">Run models on your own hardware. Maximum privacy.</p>
                </Card>
                <Card
                  hoverable
                  className={`p-6 cursor-pointer transition-colors ${llmType === 'cloud' ? 'border-primary bg-primary/5' : ''}`}
                  onClick={() => setLlmType('cloud')}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Cloud</h3>
                    <div className={`w-4 h-4 rounded-full border ${llmType === 'cloud' ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
                  </div>
                  <p className="text-xs text-muted-foreground">Fastest responses. Hosted by OpenAI or Groq.</p>
                </Card>
              </div>

              <AnimatePresence mode="popLayout">
                {llmType === 'local' ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ollama Base URL</label>
                      <Input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Model Name</label>
                      <select className="flex h-10 w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <option>llama3</option>
                        <option>mistral</option>
                        <option>phi3</option>
                      </select>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex gap-4">
                      <Button
                        variant={cloudProvider === 'openai' ? 'primary' : 'secondary'}
                        className="flex-1"
                        onClick={() => setCloudProvider('openai')}
                      >
                        OpenAI
                      </Button>
                      <Button
                        variant={cloudProvider === 'groq' ? 'primary' : 'secondary'}
                        className="flex-1"
                        onClick={() => setCloudProvider('groq')}
                      >
                        Groq
                      </Button>
                    </div>
                    <div className="space-y-2 relative">
                      <label className="text-sm font-medium">API Key</label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="sk-..."
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between pt-4">
                <Button variant="outline" onClick={testConnection} disabled={isTesting}>
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>
                {testResult === 'success' && (
                  <span className="flex items-center gap-2 text-success text-sm">
                    <Check className="w-4 h-4" /> Connection successful
                  </span>
                )}
              </div>

              <div className="flex justify-end pt-8">
                <Button onClick={() => setStep(3)} size="lg">Continue</Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col space-y-6"
            >
              <div className="text-center mb-4">
                <h1 className="text-3xl tracking-wide font-light">Enable Integrations</h1>
                <p className="text-muted-foreground mt-2">Give Nexus access to your digital life.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">Gmail</h4>
                      <p className="text-xs text-muted-foreground">Send and summarize</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm">Connect</Button>
                </Card>

                <Card className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">Google Calendar</h4>
                      <p className="text-xs text-muted-foreground">Manage events</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm">Connect</Button>
                </Card>

                <Card className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">Expenses</h4>
                      <p className="text-xs text-muted-foreground">Built-in tracking</p>
                    </div>
                  </div>
                  <Switch
                    checked={integrations.expenses}
                    onCheckedChange={(c) => setIntegrations({ ...integrations, expenses: c })}
                  />
                </Card>

                <Card className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">Reminders</h4>
                      <p className="text-xs text-muted-foreground">Built-in reminders</p>
                    </div>
                  </div>
                  <Switch
                    checked={integrations.reminders}
                    onCheckedChange={(c) => setIntegrations({ ...integrations, reminders: c })}
                  />
                </Card>
              </div>

              <div className="flex justify-between items-center pt-8">
                <Button variant="ghost" onClick={() => setStep(4)}>Skip for now</Button>
                <Button onClick={() => setStep(4)} size="lg">Continue</Button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex flex-col items-center text-center space-y-6"
            >
              <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-2">
                <Check className="w-10 h-10 text-success" />
              </div>
              <h1 className="text-3xl tracking-wide font-light">Nexus is ready.</h1>
              <p className="text-muted-foreground">
                Your personal assistant is fully configured.
              </p>
              
              <div className="pt-8 flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={finishOnboarding} variant="secondary">
                  Go to Dashboard
                </Button>
                <Button size="lg" onClick={() => window.open('tg://resolve?domain=NexusBot', '_blank')}>
                  Open Telegram
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
