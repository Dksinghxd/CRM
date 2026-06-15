'use client';

import { usePathname } from 'next/navigation';
import { Bell, Search, Zap } from 'lucide-react';

const PAGE_TITLES: Record<string, { title: string; desc: string }> = {
  '/dashboard': { title: 'Dashboard', desc: 'Overview of your CRM activity' },
  '/dashboard/customers': { title: 'Customers', desc: 'Manage your customer base' },
  '/dashboard/orders': { title: 'Orders', desc: 'Track purchases and revenue' },
  '/dashboard/segments': { title: 'Segments', desc: 'Dynamic audience segmentation' },
  '/dashboard/campaigns': { title: 'Campaigns', desc: 'Create and launch campaigns' },
  '/dashboard/analytics': { title: 'Analytics', desc: 'Performance insights and metrics' },
  '/dashboard/copilot': { title: 'AI Copilot', desc: 'Chat with your AI assistant' },
  '/dashboard/settings': { title: 'Settings', desc: 'Manage your account' },
};

export default function Header() {
  const pathname = usePathname();

  // Find best matching route
  const matchedKey = Object.keys(PAGE_TITLES)
    .filter(k => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];

  const { title, desc } = PAGE_TITLES[matchedKey] || { title: 'SmartReach', desc: '' };

  return (
    <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border px-6 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* AI Status indicator */}
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 text-xs font-medium text-primary">
          <Zap className="w-3 h-3" />
          AI Active
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center hover:bg-secondary/80 transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
        </button>
      </div>
    </header>
  );
}
