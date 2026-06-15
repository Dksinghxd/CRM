'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { cn, getInitials } from '@/lib/utils';
import {
  LayoutDashboard, Users, ShoppingBag, GitBranch,
  Megaphone, BarChart3, MessageSquareMore, Settings,
  Zap, LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/dashboard/segments', label: 'Segments', icon: GitBranch },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/copilot', label: 'AI Copilot', icon: MessageSquareMore },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg group-hover:shadow-primary/30 transition-shadow">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm gradient-text">SmartReach AI</div>
            <div className="text-xs text-muted-foreground">CRM Platform</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest px-3 mb-3">
          Main Menu
        </div>
        {navItems.slice(0, 6).map(({ href, label, icon: Icon }) => {
          const isActive = href === '/dashboard'
            ? pathname === href
            : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={cn('sidebar-link', isActive && 'active')}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {label === 'AI Copilot' && (
                <span className="ml-auto text-[9px] font-bold bg-gradient-to-r from-primary to-accent text-white px-1.5 py-0.5 rounded-full">
                  AI
                </span>
              )}
            </Link>
          );
        })}

        <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest px-3 mb-3 mt-6">
          AI Tools
        </div>
        {navItems.slice(6).map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={cn('sidebar-link', isActive && 'active')}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {label === 'AI Copilot' && (
                <span className="ml-auto text-[9px] font-bold bg-gradient-to-r from-primary to-accent text-white px-1.5 py-0.5 rounded-full">
                  AI
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user ? getInitials(user.name) : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
