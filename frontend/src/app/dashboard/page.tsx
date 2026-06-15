'use client';

import { useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api';
import { formatCurrency, formatNumber, formatDate, getChannelIcon } from '@/lib/utils';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Users, ShoppingBag, Megaphone, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Zap, Activity, Target,
} from 'lucide-react';
import Link from 'next/link';

const COLORS = ['hsl(217 91% 60%)', 'hsl(256 91% 65%)', 'hsl(142 76% 45%)', 'hsl(38 92% 50%)', 'hsl(0 72% 51%)', 'hsl(199 89% 48%)'];

function StatCard({
  title, value, subtitle, icon: Icon, trend, color = 'primary',
}: {
  title: string; value: string; subtitle?: string;
  icon: any; trend?: { value: number; label: string }; color?: string;
}) {
  const isPositive = (trend?.value || 0) >= 0;
  return (
    <div className="stat-card">
      {/* Gradient orb */}
      <div className={`absolute -top-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-10 bg-${color === 'accent' ? 'accent' : 'primary'}`} />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color === 'accent' ? 'bg-accent/15' : 'bg-primary/15'}`}>
            <Icon className={`w-5 h-5 ${color === 'accent' ? 'text-accent' : 'text-primary'}`} />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-3xl font-bold mb-1">{value}</div>
        <div className="text-sm font-medium text-foreground/80">{title}</div>
        {(subtitle || trend) && (
          <div className="text-xs text-muted-foreground mt-1">
            {subtitle || trend?.label}
          </div>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-xl p-3 shadow-xl border border-border">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {entry.name === 'Revenue' ? formatCurrency(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.dashboard()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-5">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-36 rounded-xl shimmer" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 h-72 rounded-xl shimmer" />
          <div className="h-72 rounded-xl shimmer" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { overview, campaignStats, topCampaigns, recentCampaigns, topCities, monthlyRevenue } = data;

  return (
    <div className="space-y-6">
      {/* ─── Stats Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Customers"
          value={formatNumber(overview.totalCustomers)}
          subtitle={`+${overview.newCustomersThisMonth} this month`}
          icon={Users}
          trend={{ value: overview.customerGrowth, label: 'vs last month' }}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(overview.totalRevenue)}
          subtitle={`Avg ${formatCurrency(overview.avgOrderValue)} per order`}
          icon={TrendingUp}
          trend={{ value: overview.revenueGrowth, label: 'vs last month' }}
          color="accent"
        />
        <StatCard
          title="Campaigns"
          value={overview.totalCampaigns.toString()}
          subtitle={`${overview.activeCampaigns} active now`}
          icon={Megaphone}
        />
        <StatCard
          title="Conversion Rate"
          value={`${campaignStats.conversionRate}%`}
          subtitle={`${campaignStats.totalConverted} conversions`}
          icon={Target}
          trend={{ value: campaignStats.conversionRate - 2, label: 'vs benchmark' }}
          color="accent"
        />
      </div>

      {/* ─── Campaign Performance Mini Stats ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Messages Sent', value: formatNumber(campaignStats.totalSent), icon: '📤' },
          { label: 'Open Rate', value: `${campaignStats.openRate}%`, icon: '📬' },
          { label: 'Click Rate', value: `${campaignStats.clickRate}%`, icon: '👆' },
          { label: 'Total Delivered', value: formatNumber(campaignStats.totalDelivered), icon: '✅' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-card rounded-xl p-4 border border-border flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Charts Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-5">
        {/* Revenue Chart */}
        <div className="col-span-2 bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold">Revenue Trend</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full font-medium">
              <TrendingUp className="w-3 h-3" />
              +{overview.revenueGrowth.toFixed(1)}%
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₹${formatNumber(v)}`} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="hsl(217 91% 60%)"
                strokeWidth={2}
                fill="url(#revenueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Cities */}
        <div className="bg-card rounded-xl p-6 border border-border">
          <h3 className="font-semibold mb-1">Customers by City</h3>
          <p className="text-xs text-muted-foreground mb-4">Top performing cities</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={topCities.slice(0, 6)}
                dataKey="count"
                nameKey="city"
                cx="50%"
                cy="50%"
                outerRadius={75}
                strokeWidth={0}
              >
                {topCities.slice(0, 6).map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => [v, 'Customers']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {topCities.slice(0, 4).map((c: any, i: number) => (
              <div key={c.city} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-muted-foreground">{c.city}</span>
                </div>
                <span className="font-medium">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Bottom Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">
        {/* Top Campaigns */}
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold">Top Campaigns</h3>
              <p className="text-xs text-muted-foreground">By conversions</p>
            </div>
            <Link href="/dashboard/campaigns" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {topCampaigns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No campaigns launched yet.{' '}
                <Link href="/dashboard/campaigns" className="text-primary hover:underline">Create one</Link>
              </div>
            ) : topCampaigns.map((c: any, i: number) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: COLORS[i % COLORS.length] + '20', color: COLORS[i % COLORS.length] }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {getChannelIcon(c.channel)} {c.segment} • {c.totalSent} sent
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-primary">{c.conversionRate}%</div>
                  <div className="text-xs text-muted-foreground">conversion</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold">Recent Campaigns</h3>
              <p className="text-xs text-muted-foreground">Latest activity</p>
            </div>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {recentCampaigns.map((c: any) => {
              const statusColors: Record<string, string> = {
                COMPLETED: 'text-emerald-400',
                RUNNING: 'text-blue-400',
                DRAFT: 'text-muted-foreground',
                FAILED: 'text-red-400',
                SCHEDULED: 'text-amber-400',
              };
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors group">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
                    {getChannelIcon(c.channel)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</div>
                  </div>
                  <div className={`text-xs font-semibold ${statusColors[c.status] || 'text-muted-foreground'}`}>
                    {c.status}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Action */}
          <Link
            href="/dashboard/campaigns"
            className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            Create New Campaign
          </Link>
        </div>
      </div>
    </div>
  );
}
