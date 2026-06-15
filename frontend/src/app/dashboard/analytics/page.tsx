'use client';

import { useState, useEffect } from 'react';
import { analyticsApi } from '@/lib/api';
import { formatCurrency, formatNumber, getChannelIcon } from '@/lib/utils';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart3, TrendingUp, Users, Target, MousePointer2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['hsl(217 91% 60%)', 'hsl(256 91% 65%)', 'hsl(142 76% 45%)', 'hsl(38 92% 50%)', 'hsl(0 72% 51%)', 'hsl(199 89% 48%)'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-xl p-3 shadow-xl border border-border z-50">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-sm font-semibold" style={{ color: entry.color || entry.fill }}>
            {entry.name}: {entry.name.includes('Revenue') ? formatCurrency(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    analyticsApi.dashboard()
      .then(res => setData(res.data))
      .catch(err => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-6">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-32 shimmer rounded-xl" />)}
        </div>
        <div className="h-[400px] shimmer rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const { overview, campaignStats, monthlyRevenue, categoryBreakdown, channelBreakdown, topCampaigns } = data;

  const getProgress = (count: number, total: number) => total ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-sm text-muted-foreground">Deep dive into your CRM performance metrics</p>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Total Messages Sent', value: formatNumber(campaignStats.totalSent), icon: Target, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Avg Open Rate', value: `${campaignStats.openRate}%`, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Avg Click Rate', value: `${campaignStats.clickRate}%`, icon: MousePointer2, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Avg Conversion Rate', value: `${campaignStats.conversionRate}%`, icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 card-hover">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
            </div>
            <div className="text-3xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'campaigns', label: 'Campaign Performance' },
          { id: 'revenue', label: 'Revenue Analysis' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: OVERVIEW ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-6">Revenue Growth (6 Months)</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(222 47% 16%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(215 20% 55%)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `₹${formatNumber(v)}`} tick={{ fontSize: 12, fill: 'hsl(215 20% 55%)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(217 91% 60%)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-6">Orders by Channel</h3>
            <div className="h-[300px]">
              {channelBreakdown?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelBreakdown}
                      cx="50%" cy="45%"
                      innerRadius={60} outerRadius={90}
                      paddingAngle={5}
                      dataKey="count" nameKey="channel"
                      stroke="none"
                    >
                      {channelBreakdown.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                 <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: CAMPAIGNS ────────────────────────────────────────────────── */}
      {activeTab === 'campaigns' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Campaign Name</th>
                  <th className="px-6 py-4 font-medium">Channel</th>
                  <th className="px-6 py-4 font-medium text-right">Sent</th>
                  <th className="px-6 py-4 font-medium w-48">Open Rate</th>
                  <th className="px-6 py-4 font-medium w-48">Click Rate</th>
                  <th className="px-6 py-4 font-medium w-48">Conv. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topCampaigns.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No campaign data available</td></tr>
                ) : topCampaigns.map((c: any) => {
                  const openRate = getProgress(c.totalOpened, c.totalDelivered);
                  const clickRate = getProgress(c.totalClicked, c.totalOpened);
                  const convRate = getProgress(c.totalConverted, c.totalClicked);
                  
                  return (
                    <tr key={c.id} className="hover:bg-secondary/30">
                      <td className="px-6 py-4 font-semibold">{c.name}</td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-xs bg-secondary px-2 py-1 rounded-md w-max border border-border">
                          {getChannelIcon(c.channel)} {c.channel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{formatNumber(c.totalSent)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 text-right font-bold text-emerald-400">{openRate}%</span>
                          <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${openRate}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 text-right font-bold text-amber-400">{clickRate}%</span>
                          <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{ width: `${clickRate}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 text-right font-bold text-primary">{convRate}%</span>
                          <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${convRate}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: REVENUE ──────────────────────────────────────────────────── */}
      {activeTab === 'revenue' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Revenue by Category
            </h3>
            <div className="h-[350px]">
              {categoryBreakdown?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBreakdown} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(222 47% 16%)" />
                    <XAxis type="number" tickFormatter={v => `₹${formatNumber(v)}`} tick={{ fontSize: 12, fill: 'hsl(215 20% 55%)' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 12, fill: 'hsl(213 31% 91%)' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(222 47% 14%)' }} />
                    <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]} barSize={24}>
                      {categoryBreakdown.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available</div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
            <h3 className="font-semibold mb-6">Key Insights</h3>
            <div className="space-y-4 flex-1">
              <div className="bg-secondary/50 rounded-xl p-4 border border-border flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Highest Grossing Category</h4>
                  <p className="text-sm text-muted-foreground">
                    {categoryBreakdown?.length > 0 ? (
                      <><strong className="text-foreground">{categoryBreakdown[0].category}</strong> generated the most revenue at {formatCurrency(categoryBreakdown[0].revenue)}.</>
                    ) : 'Not enough data.'}
                  </p>
                </div>
              </div>

              <div className="bg-secondary/50 rounded-xl p-4 border border-border flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Average Order Value</h4>
                  <p className="text-sm text-muted-foreground">
                    Your customers spend an average of <strong className="text-foreground">{formatCurrency(overview.avgOrderValue)}</strong> per order across all channels.
                  </p>
                </div>
              </div>
              
              <div className="bg-secondary/50 rounded-xl p-4 border border-border flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Channel Performance</h4>
                  <p className="text-sm text-muted-foreground">
                    {channelBreakdown?.length > 0 ? (
                      <><strong className="text-foreground">{channelBreakdown[0].channel}</strong> is your dominant sales channel with {channelBreakdown[0].count} orders.</>
                    ) : 'Not enough data.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      )}

    </div>
  );
}
