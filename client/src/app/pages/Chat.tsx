import { useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  MessageSquare,
  Trash2,
  Pencil,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  useConversations,
  useDeleteConversation,
  useRenameConversation,
} from "../../hooks/useConversations";
import type { ConversationSummary } from "../../api/chat";

// ── Date grouping ─────────────────────────────────────────────────────────────

function groupByDate(conversations: ConversationSummary[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const groups: { label: string; items: ConversationSummary[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Last 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conv of conversations) {
    const d = new Date(conv.created_at);
    d.setHours(0, 0, 0, 0);
    if (d >= today) groups[0].items.push(conv);
    else if (d >= yesterday) groups[1].items.push(conv);
    else if (d >= lastWeek) groups[2].items.push(conv);
    else groups[3].items.push(conv);
  }

  return groups.filter((g) => g.items.length > 0);
}

// ── Single conversation row ───────────────────────────────────────────────────

interface ConvRowProps {
  conv: ConversationSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

function ConvRow({ conv, isActive, onSelect, onDelete, onRename }: ConvRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conv.title ?? "Untitled");
  const inputRef = useState<HTMLInputElement | null>(null);

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== conv.title) onRename(trimmed);
    setEditing(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.18 }}
      className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
      onClick={() => !editing && onSelect()}
    >
      <MessageSquare
        className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : ""}`}
      />

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 min-w-0 bg-transparent text-xs outline-none border-b border-primary"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 min-w-0 text-xs truncate">
          {conv.title ?? "Untitled"}
        </span>
      )}

      {!editing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDraft(conv.title ?? "Untitled");
              setEditing(true);
            }}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label="Rename conversation"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
            aria-label="Delete conversation"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {editing && (
        <button
          onClick={(e) => { e.stopPropagation(); commitRename(); }}
          className="p-1 rounded hover:bg-muted transition-colors text-primary"
        >
          <Check className="w-3 h-3" />
        </button>
      )}
    </motion.div>
  );
}

// ── Conversation Sidebar ──────────────────────────────────────────────────────

interface SidebarProps {
  activeConvId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onSelectConv: (convId: string) => void;
  onNewChat: () => void;
}

function ConversationSidebar({
  activeConvId,
  collapsed,
  onToggle,
  onSelectConv,
  onNewChat,
}: SidebarProps) {
  const { data: conversations = [], isLoading } = useConversations();
  const deleteConv = useDeleteConversation();
  const renameConv = useRenameConversation();
  const groups = groupByDate(conversations);

  return (
    <motion.aside
      animate={{ width: collapsed ? 0 : 256 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="relative flex-shrink-0 overflow-hidden border-r border-border bg-background flex flex-col"
      style={{ minWidth: 0 }}
    >
      <div className="w-64 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Conversations
          </span>
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat */}
        <div className="px-3 py-3 shrink-0">
          <button
            id="new-chat-btn"
            onClick={onNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && conversations.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8 px-4">
              No conversations yet. Start chatting!
            </p>
          )}
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-3 pb-1.5 pt-2">
                {group.label}
              </p>
              <AnimatePresence initial={false}>
                {group.items.map((conv) => (
                  <ConvRow
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === activeConvId}
                    onSelect={() => onSelectConv(conv.id)}
                    onDelete={() => deleteConv.mutate(conv.id)}
                    onRename={(title) => renameConv.mutate({ convId: conv.id, title })}
                  />
                ))}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}

// ── Chat Layout (sidebar + routed thread outlet) ──────────────────────────────

export const Chat = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { convId } = useParams<{ convId: string }>();

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <ConversationSidebar
        activeConvId={convId ?? null}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        onSelectConv={(id) => navigate(`/chat/${id}`)}
        onNewChat={() => navigate("/chat")}
      />

      {/* Expand toggle */}
      <AnimatePresence>
        {collapsed && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCollapsed(false)}
            className="absolute left-[60px] top-4 z-20 p-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Thread (rendered by child route) */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};
