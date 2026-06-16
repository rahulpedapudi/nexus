import { useState, useMemo } from "react";
import { PageTransition } from "../components/ui/PageTransition";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import {
  Search,
  Trash2,
  Download,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  useMemories,
  useDeleteMemory,
  useWipeMemories,
} from "../../hooks/useMemory";
import type { MemoryItem } from "../../api/memory";

// ── Helpers ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  preference: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  fact: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  pattern: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
  habit: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

function getCategoryStyle(category: string) {
  return (
    CATEGORY_COLORS[category.toLowerCase()] ??
    "bg-secondary text-secondary-foreground"
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Sub-components ───────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/40 p-5 space-y-3 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="h-5 w-20 rounded-md bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
      </div>
      <div className="h-3 w-24 rounded bg-muted mt-auto" />
    </div>
  );
}

interface MemoryCardProps {
  memory: MemoryItem;
  isPending: boolean;
  onDelete: (id: string) => void;
}

function MemoryCard({ memory, isPending, onDelete }: MemoryCardProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}>
      <Card className="p-5 h-full flex flex-col group relative overflow-hidden">
        <div className="flex justify-between items-start mb-3">
          <span
            className={`text-xs px-2 py-1 rounded-md uppercase tracking-wider font-medium ${getCategoryStyle(memory.category)}`}>
            {memory.category}
          </span>
          <button
            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all duration-150 disabled:opacity-30"
            onClick={() => setConfirming(true)}
            disabled={isPending}
            aria-label="Delete memory">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm flex-grow mb-4 leading-relaxed">
          {memory.content}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <span className="text-xs text-muted-foreground">
            Added {formatDate(memory.created_at)}
          </span>
          {memory.source === "auto" && (
            <span className="text-xs text-muted-foreground/60 italic">
              auto-extracted
            </span>
          )}
        </div>

        <AnimatePresence>
          {confirming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-card/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 rounded-xl">
              <p className="text-sm font-medium mb-3">Delete this memory?</p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    onDelete(memory.id);
                    setConfirming(false);
                  }}
                  disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    "Yes"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export const Memory = () => {
  const { data: memories = [], isLoading, isError, refetch } = useMemories();
  const deleteMemory = useDeleteMemory();
  const wipeMemories = useWipeMemories();

  const [searchQuery, setSearchQuery] = useState("");
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);

  const filteredMemories = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return memories.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q),
    );
  }, [memories, searchQuery]);

  const handleDelete = (id: string) => {
    deleteMemory.mutate(id, {
      onSuccess: () => toast.success("Memory deleted"),
      onError: () => toast.error("Failed to delete memory"),
    });
  };

  const handleExport = () => {
    const exportData = memories.map(
      ({ id, content, category, source, created_at }) => ({
        id,
        content,
        category,
        source,
        created_at,
      }),
    );
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(exportData, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "nexus_memories.json");
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleClearAll = () => {
    wipeMemories.mutate(undefined, {
      onSuccess: () => {
        setIsWipeModalOpen(false);
        toast.success("All memories cleared");
      },
      onError: () => toast.error("Failed to clear memories"),
    });
  };

  // ── Render states ──────────────────────────────────────────────────

  if (isError) {
    return (
      <PageTransition className="space-y-8 pb-12">
        <Card className="p-12 flex flex-col items-center justify-center text-center border-dashed">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="text-lg font-medium mb-1">Couldn't load memories</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Something went wrong while fetching your memories.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2">
            <RefreshCw className="w-4 h-4" /> Try again
          </Button>
        </Card>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-wide">
            {isLoading ? (
              <span className="inline-block h-8 w-32 rounded-md bg-muted animate-pulse" />
            ) : (
              <>
                {memories.length}{" "}
                {memories.length === 1 ? "memory" : "memories"}
              </>
            )}
          </h1>
          <p className="text-muted-foreground mt-2">
            Everything Nexus remembers about you.
          </p>
        </div>

        {!isLoading && memories.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-2">
              <Download className="w-4 h-4" /> Export All
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsWipeModalOpen(true)}>
              Clear All
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      {!isLoading && memories.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search memories…"
            className="pl-10 max-w-md bg-card border-border/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredMemories.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center border-dashed">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">
            {memories.length === 0
              ? "Nexus hasn't learned anything yet"
              : "No memories found"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {memories.length === 0
              ? "Start chatting in Telegram and Nexus will automatically extract important context."
              : "Try adjusting your search query to find what you are looking for."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredMemories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                isPending={deleteMemory.isPending}
                onDelete={handleDelete}
              />
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
              onClick={() =>
                !wipeMemories.isPending && setIsWipeModalOpen(false)
              }>
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl z-50 relative">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-medium mb-2">
                  Clear all memories?
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  This will permanently delete all {memories.length}{" "}
                  {memories.length === 1 ? "memory" : "memories"} Nexus has
                  collected about you. This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setIsWipeModalOpen(false)}
                    disabled={wipeMemories.isPending}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleClearAll}
                    disabled={wipeMemories.isPending}
                    className="gap-2">
                    {wipeMemories.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Clearing…
                      </>
                    ) : (
                      "Yes, clear all"
                    )}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};
