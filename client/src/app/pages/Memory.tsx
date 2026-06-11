import { useState, useMemo } from 'react';
import { PageTransition } from '../components/ui/PageTransition';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Search, Trash2, Download, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

type Memory = {
  id: string;
  text: string;
  category: 'preference' | 'fact' | 'pattern';
  date: string;
};

const initialMemories: Memory[] = [
  { id: '1', text: 'User prefers dark mode on all apps', category: 'preference', date: '2023-10-15' },
  { id: '2', text: 'Lives in San Francisco, CA', category: 'fact', date: '2023-10-16' },
  { id: '3', text: 'Works as a Software Engineer', category: 'fact', date: '2023-10-16' },
  { id: '4', text: 'Usually books meetings in the afternoon', category: 'pattern', date: '2023-10-20' },
  { id: '5', text: 'Allergic to peanuts', category: 'fact', date: '2023-10-25' },
  { id: '6', text: 'Likes concise, bulleted summaries for emails', category: 'preference', date: '2023-11-02' },
];

export const Memory = () => {
  const [memories, setMemories] = useState<Memory[]>(initialMemories);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);

  const filteredMemories = useMemo(() => {
    return memories.filter((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [memories, searchQuery]);

  const handleDelete = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    setDeletingId(null);
    toast.success('Memory deleted');
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(memories, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "nexus_memories.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleClearAll = () => {
    setMemories([]);
    setIsWipeModalOpen(false);
    toast.success('All memories cleared');
  };

  return (
    <PageTransition className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-wide">{memories.length} memories</h1>
          <p className="text-muted-foreground mt-2">Everything Nexus remembers about you.</p>
        </div>
        {memories.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" /> Export All
            </Button>
            <Button variant="danger" size="sm" onClick={() => setIsWipeModalOpen(true)}>
              Clear All
            </Button>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search memories..."
          className="pl-10 max-w-md bg-card border-border/50"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredMemories.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center border-dashed">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">
            {memories.length === 0 ? "Nexus hasn't learned anything yet" : "No memories found"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {memories.length === 0
              ? "Start chatting in Telegram and Nexus will automatically extract important context."
              : "Try adjusting your search query to find what you're looking for."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredMemories.map((memory) => (
              <motion.div
                key={memory.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-5 h-full flex flex-col group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground uppercase tracking-wider font-medium`}>
                      {memory.category}
                    </span>
                    <button
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setDeletingId(memory.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm flex-grow mb-4">{memory.text}</p>
                  <div className="text-xs text-muted-foreground mt-auto">Added {memory.date}</div>

                  {deletingId === memory.id && (
                    <div className="absolute inset-0 bg-card/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                      <p className="text-sm font-medium mb-3">Delete this memory?</p>
                      <div className="flex gap-2">
                        <Button variant="danger" size="sm" onClick={() => handleDelete(memory.id)}>Yes</Button>
                        <Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Wipe Confirmation Modal */}
      <AnimatePresence>
        {isWipeModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-center justify-center"
              onClick={() => setIsWipeModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl z-50 relative"
              >
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-medium mb-2">Clear all memories?</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  This will permanently delete all {memories.length} memories Nexus has collected about you. This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setIsWipeModalOpen(false)}>Cancel</Button>
                  <Button variant="danger" onClick={handleClearAll}>Yes, clear all</Button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};
