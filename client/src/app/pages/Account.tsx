import { useState } from "react";
import { PageTransition } from "../components/ui/PageTransition";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useStore } from "../store";
import {
  Bot,
  Download,
  AlertTriangle,
  Check,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { useMe } from "../../hooks/useMe";

export const Account = () => {
  const { data: user } = useMe();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(user?.username || "");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Danger zone modals
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleExportData = () => {
    toast.success("Data compilation started. Check your email shortly.");
  };

  return (
    <PageTransition className="max-w-2xl space-y-12 pb-24">
      <div>
        <h1 className="text-3xl font-light tracking-wide">Account</h1>
        <p className="text-muted-foreground mt-2">
          Manage your profile, data, and connection settings.
        </p>
      </div>

      <div className="space-y-12 divide-y divide-border">
        {/* Profile Section */}
        <section className="space-y-6">
          <h2 className="text-xl font-medium">Profile</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Name
              </label>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="max-w-xs"
                    autoFocus
                  />
                  <Button size="sm">Save</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingName(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="text-lg">{user?.username}</span>
                  <button
                    className="text-sm text-primary hover:underline"
                    onClick={() => setIsEditingName(true)}>
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Email
              </label>
              <div className="text-lg">{user?.email}</div>
            </div>

            <div className="pt-2">
              {isChangingPassword ? (
                <div className="space-y-4 max-w-xs p-4 bg-secondary/50 rounded-lg border border-border">
                  <Input type="password" placeholder="Current Password" />
                  <Input type="password" placeholder="New Password" />
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setIsChangingPassword(false);
                        toast.success("Password updated");
                      }}>
                      Update
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsChangingPassword(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangingPassword(true)}>
                  Change Password
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Subscription Section */}
        {/* <section className="space-y-6 pt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium">Subscription</h2>
            <div className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Nexus Pro
            </div>
          </div>
          <div className="flex justify-between items-center bg-card border border-border p-5 rounded-xl">
            <div>
              <p className="font-medium">Yearly Plan</p>
              <p className="text-sm text-muted-foreground mt-1">
                Renews on Oct 15, 2026
              </p>
            </div>
            <Button variant="secondary">Manage Billing</Button>
          </div>
        </section> */}

        {/* Telegram Section */}
        {/* <section className="space-y-6 pt-12">
          <h2 className="text-xl font-medium">Telegram Connection</h2>
          <div className="flex items-center justify-between p-5 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <p className="font-medium">@alex_nexus</p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  ID: 849302844
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                toast("Nexus bot will stop responding if you disconnect.")
              }>
              Disconnect
            </Button>
          </div>
        </section> */}

        {/* Data Section */}
        <section className="space-y-6 pt-12">
          <h2 className="text-xl font-medium">Your Data</h2>
          <p className="text-sm text-muted-foreground">
            Nexus is privacy-first. Your data is stored only on your server. You
            can export a copy of all your expenses, memories, reminders, and
            activity logs at any time.
          </p>
          <Button
            variant="secondary"
            onClick={handleExportData}
            className="gap-2">
            <Download className="w-4 h-4" /> Export All Data as JSON
          </Button>
        </section>

        {/* Danger Zone */}
        <section className="space-y-6 pt-12">
          <h2 className="text-xl font-medium text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Danger Zone
          </h2>
          <div className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium">Wipe All Data</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Clears all memories, expenses, and reminders. Your account and
                  configurations remain.
                </p>
              </div>
              <Button
                variant="danger"
                onClick={() => toast.success("Data wipe initiated")}>
                Wipe Data
              </Button>
            </div>

            <div className="h-px bg-destructive/10" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium">Delete Account</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently remove your account and all associated data. This
                  action is irreversible.
                </p>
              </div>
              <Button
                variant="danger"
                onClick={() => setIsDeleteModalOpen(true)}>
                Delete Account
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsDeleteModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-destructive/30 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-medium mb-2">Delete Account</h2>
              <p className="text-sm text-muted-foreground mb-6">
                This action cannot be undone. All your data, settings, and
                memories will be permanently deleted.
              </p>

              <div className="mb-6 space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Type <span className="text-foreground font-mono">DELETE</span>{" "}
                  to confirm
                </label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setIsDeleteModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={deleteConfirmText !== "DELETE"}
                  onClick={() => {
                    toast.success("Account deleted");
                    setIsDeleteModalOpen(false);
                  }}>
                  Permanently Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};
