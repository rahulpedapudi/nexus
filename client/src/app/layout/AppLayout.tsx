import { NavLink, Outlet, useLocation } from "react-router";
import {
  LayoutDashboard,
  Puzzle,
  BrainCircuit,
  User,
  Settings,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { useStore } from "../store";
import { useMe } from "../../hooks/useMe";

export function AppLayout() {
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();
  // const user = useStore(state => state.user);

  const { data: user } = useMe();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Puzzle, label: "Integrations", path: "/integrations" },
    { icon: BrainCircuit, label: "Memory", path: "/memory" },
    { icon: User, label: "Account", path: "/account" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <motion.aside
        initial={{ width: 60 }}
        animate={{ width: isHovered ? 200 : 60 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed left-0 top-0 bottom-0 z-50 bg-card border-r border-border flex flex-col overflow-hidden">
        <div className="flex items-center h-16 px-4 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <BrainCircuit className="w-5 h-5 text-primary" />
          </div>
          <span
            className="ml-3 font-medium tracking-wide whitespace-nowrap opacity-0 animate-in fade-in fill-mode-forwards"
            style={{
              animationDelay: "100ms",
              display: isHovered ? "block" : "none",
            }}>
            Nexus
          </span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center h-10 px-2 rounded-sm transition-colors relative group ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon
                  className={`w-5 h-5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground transition-colors"}`}
                />
                <AnimatePresence>
                  {isHovered && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="ml-3 whitespace-nowrap text-sm font-medium">
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border shrink-0">
          <NavLink
            to="/account"
            className="flex items-center h-12 px-2 rounded-sm text-muted-foreground hover:text-foreground transition-colors group">
            <div className="w-7 h-7 rounded-full bg-secondary shrink-0 flex items-center justify-center text-xs font-medium text-foreground">
              {user?.username.charAt(0)}
            </div>
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="ml-3 flex-1 overflow-hidden">
                  <div className="text-sm font-medium truncate text-foreground">
                    {user?.username}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="shrink-0 ml-1">
                  <Settings className="w-4 h-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </NavLink>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-[60px] flex flex-col min-h-screen relative overflow-hidden">
        {/* Page transitions wrapper */}
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex-1 flex flex-col p-8 max-w-5xl mx-auto w-full">
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
