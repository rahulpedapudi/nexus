import { useState } from 'react';
import { PageTransition } from '../components/ui/PageTransition';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Switch } from '../components/ui/Switch';
import { Input } from '../components/ui/Input';
import { Mail, Calendar, DollarSign, Bell, Cpu, X, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const mockIntegrations = [
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Read and create events via Telegram',
    icon: Calendar,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    connected: true,
    type: 'oauth',
    lastSync: '10 mins ago',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send emails and read summaries',
    icon: Mail,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    connected: false,
    type: 'oauth',
  },
  {
    id: 'expenses',
    name: 'Expense Tracking',
    description: 'Built-in. Log and categorize spending.',
    icon: DollarSign,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    connected: true,
    type: 'internal',
  },
  {
    id: 'reminders',
    name: 'Reminders',
    description: 'Built-in. Natural language reminders.',
    icon: Bell,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    connected: true,
    type: 'internal',
  },
];

export const Integrations = () => {
  const [integrations, setIntegrations] = useState(mockIntegrations);
  const [isLlmDrawerOpen, setIsLlmDrawerOpen] = useState(false);
  
  // Drawer state
  const [llmType, setLlmType] = useState<'local' | 'cloud'>('cloud');
  const [cloudProvider, setCloudProvider] = useState<'openai' | 'groq'>('openai');
  const [showApiKey, setShowApiKey] = useState(false);

  const toggleConnection = (id: string) => {
    setIntegrations(integrations.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i)));
  };

  return (
    <PageTransition className="space-y-10 pb-12">
      <div>
        <h1 className="text-3xl font-light tracking-wide">Connected Tools</h1>
        <p className="text-muted-foreground mt-2">Everything Nexus can reach on your behalf.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.id} className="p-6 flex flex-col h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${integration.bg} flex items-center justify-center ${integration.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg">{integration.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${integration.connected ? 'bg-success' : 'bg-muted-foreground/50'}`} />
                      <span className="text-xs text-muted-foreground">
                        {integration.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>
                {integration.type === 'oauth' ? (
                  integration.connected ? (
                    <Button variant="outline" size="sm" onClick={() => toggleConnection(integration.id)}>
                      Disconnect
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => toggleConnection(integration.id)}>
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
              <p className="text-sm text-muted-foreground mb-6 flex-grow">{integration.description}</p>
              {integration.connected && integration.lastSync && (
                <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                  Last synced: {integration.lastSync}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="pt-8 border-t border-border">
        <h2 className="text-xl font-medium mb-2 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" /> Core Intelligence
        </h2>
        <Card className="p-6 mt-4 flex items-center justify-between">
          <div>
            <h3 className="font-medium">Language Model Configuration</h3>
            <p className="text-sm text-muted-foreground mt-1">Currently using <span className="font-medium text-foreground">Cloud (OpenAI)</span></p>
          </div>
          <Button variant="outline" onClick={() => setIsLlmDrawerOpen(true)}>Edit Configuration</Button>
        </Card>
      </div>

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
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-border z-50 p-6 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-medium">LLM Configuration</h2>
                <Button variant="ghost" size="sm" onClick={() => setIsLlmDrawerOpen(false)} className="h-8 w-8 p-0">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-6 flex-grow">
                <div className="grid grid-cols-2 gap-4">
                  <Card
                    hoverable
                    className={`p-4 cursor-pointer transition-colors ${llmType === 'local' ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => setLlmType('local')}
                  >
                    <h3 className="font-medium text-sm text-center">Local (Ollama)</h3>
                  </Card>
                  <Card
                    hoverable
                    className={`p-4 cursor-pointer transition-colors ${llmType === 'cloud' ? 'border-primary bg-primary/5' : ''}`}
                    onClick={() => setLlmType('cloud')}
                  >
                    <h3 className="font-medium text-sm text-center">Cloud</h3>
                  </Card>
                </div>

                {llmType === 'local' ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ollama Base URL</label>
                      <Input defaultValue="http://localhost:11434" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Model Name</label>
                      <select className="flex h-10 w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <option>llama3</option>
                        <option>mistral</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
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
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-border mt-auto">
                <Button className="w-full" onClick={() => setIsLlmDrawerOpen(false)}>Save Changes</Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};
