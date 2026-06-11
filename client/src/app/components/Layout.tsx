import { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Home, Layers, BrainCircuit, User as UserIcon, Settings } from 'lucide-react';
import { useStore } from '../store';

const SidebarItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-4 px-4 py-3 rounded-none border-l-2 transition-all duration-200 group ${
          isActive
            ? 'border-primary text-foreground bg-primary/5'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-primary' : 'group-hover:text-foreground'}`} />
          <span className="font-medium whitespace-nowrap overflow-hidden opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto transition-all duration-300">
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
};

export const Layout = () => {
  const user = useStore((state) => state.user);
  
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[60px] hover:w-[200px] flex-shrink-0 border-r border-border bg-background flex flex-col justify-between transition-[width] duration-300 z-10 overflow-hidden group">
        <div className="py-6 flex flex-col gap-2">
          <div className="px-4 mb-6 flex items-center gap-4">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
              <div className="w-2.5 h-2.5 bg-background rounded-sm" />
            </div>
            <span className="font-semibold text-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Nexus
            </span>
          </div>
          <nav className="flex flex-col gap-1">
            <SidebarItem to="/dashboard" icon={Home} label="Dashboard" />
            <SidebarItem to="/integrations" icon={Layers} label="Integrations" />
            <SidebarItem to="/memory" icon={BrainCircuit} label="Memory" />
            <SidebarItem to="/account" icon={UserIcon} label="Account" />
          </nav>
        </div>
        
        <div className="p-4 border-t border-border flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0 font-medium text-sm border border-border">
            {user?.name.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col whitespace-nowrap overflow-hidden opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto transition-all duration-300">
            <span className="text-sm font-medium leading-tight">{user?.name}</span>
            <span className="text-xs text-muted-foreground">Settings</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-background">
        <div className="max-w-5xl mx-auto p-8 lg:p-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
