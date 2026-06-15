'use client';

import { useState, useEffect, useCallback } from 'react';
import { orderApi, customerApi } from '@/lib/api';
import { formatCurrency, formatDate, debounce } from '@/lib/utils';
import { ShoppingBag, TrendingUp, Filter, Plus, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['hsl(217 91% 60%)', 'hsl(256 91% 65%)', 'hsl(142 76% 45%)', 'hsl(38 92% 50%)', 'hsl(0 72% 51%)'];

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Filters
  const [category, setCategory] = useState('');
  const [channel, setChannel] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Form
  const [formData, setFormData] = useState({
    customerId: '', amount: '', category: 'Electronics', channel: 'ONLINE', purchaseDate: new Date().toISOString().split('T')[0]
  });

  const fetchOrders = useCallback(async (params: any = {}) => {
    setLoading(true);
    try {
      const res = await orderApi.list({
        page: params.page || page,
        limit,
        category: params.category !== undefined ? params.category : category,
        channel: params.channel !== undefined ? params.channel : channel,
      });
      setOrders(res.data.orders);
      setTotal(res.data.pagination.total);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page, limit, category, channel]);

  const fetchStats = async () => {
    try {
      const res = await orderApi.stats();
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [fetchOrders]);

  const handleFilterChange = (type: string, val: string) => {
    setPage(1);
    if (type === 'category') {
      setCategory(val);
      fetchOrders({ category: val, page: 1 });
    } else if (type === 'channel') {
      setChannel(val);
      fetchOrders({ channel: val, page: 1 });
    }
  };

  const debouncedCustomerSearch = useCallback(
    debounce(async (val: string) => {
      if (!val) return;
      try {
        const res = await customerApi.list({ search: val, limit: 10 });
        setCustomers(res.data.customers);
      } catch (err) {
        console.error(err);
      }
    }, 300),
    []
  );

  const handleCustomerSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomerSearch(val);
    debouncedCustomerSearch(val);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await orderApi.create({
        ...formData,
        amount: parseFloat(formData.amount),
        purchaseDate: new Date(formData.purchaseDate).toISOString()
      });
      toast.success('Order created successfully');
      setIsAddModalOpen(false);
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create order');
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass rounded-xl p-3 shadow-xl border border-border">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-sm font-semibold" style={{ color: payload[0].color }}>
            Revenue: {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Orders</h2>
          <p className="text-sm text-muted-foreground">
            Track purchases and analyze revenue
          </p>
        </div>
        <button 
          onClick={() => {
            setFormData({ customerId: '', amount: '', category: 'Electronics', channel: 'ONLINE', purchaseDate: new Date().toISOString().split('T')[0] });
            setIsAddModalOpen(true);
            debouncedCustomerSearch('a'); // load initial customers
          }}
          className="px-4 py-2 btn-ai rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Order
        </button>
      </div>

      {/* Stats & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="stat-card">
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-10 bg-primary" />
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
                <div className="text-3xl font-bold">{stats ? formatCurrency(stats.totalRevenue) : '—'}</div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Total Orders</div>
              <div className="text-xl font-bold">{stats ? stats.totalOrders : '—'}</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-xs text-muted-foreground mb-1">Avg Order Value</div>
              <div className="text-xl font-bold text-primary">{stats ? formatCurrency(stats.avgOrderValue) : '—'}</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Revenue by Category
            </h3>
          </div>
          <div className="h-40">
            {stats && stats.revenueByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.revenueByCategory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `₹${(v/1000)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(222 47% 14%)' }} />
                  <Bar dataKey="_sum.amount" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {stats.revenueByCategory.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Not enough data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-full sm:w-auto">
          <Filter className="w-4 h-4" /> Filters:
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select 
            value={category} 
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none input-focus appearance-none"
          >
            <option value="">All Categories</option>
            <option value="Electronics">Electronics</option>
            <option value="Apparel">Apparel</option>
            <option value="Home">Home</option>
            <option value="Beauty">Beauty</option>
            <option value="Sports">Sports</option>
            <option value="Grocery">Grocery</option>
          </select>
          <select 
            value={channel} 
            onChange={(e) => handleFilterChange('channel', e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none input-focus appearance-none"
          >
            <option value="">All Channels</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline (Store)</option>
            <option value="MOBILE_APP">Mobile App</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Order ID</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Channel</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-6 py-4"><div className="h-8 shimmer rounded w-full"></div></td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    No orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-secondary/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{o.id.substring(o.id.length - 8)}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{o.customer?.name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{o.customer?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md bg-secondary border border-border text-xs font-medium">
                        {o.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                      {o.channel}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDate(o.purchaseDate)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        o.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-primary">
                      {formatCurrency(o.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && orders.length > 0 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(page - 1) * limit + 1}</span> to <span className="font-medium text-foreground">{Math.min(page * limit, total)}</span> of <span className="font-medium text-foreground">{total}</span> orders
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-border rounded-lg bg-secondary text-foreground disabled:opacity-50 hover:bg-secondary/80"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= total}
                className="p-2 border border-border rounded-lg bg-secondary text-foreground disabled:opacity-50 hover:bg-secondary/80"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Order Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in border border-border">
            <h3 className="text-xl font-bold mb-4">Add New Order</h3>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium mb-1">Select Customer *</label>
                <input 
                  type="text" 
                  placeholder="Search customer..." 
                  value={customerSearch} 
                  onChange={handleCustomerSearch} 
                  className="w-full px-3 py-2 mb-2 bg-secondary/50 border border-border rounded-lg text-sm input-focus" 
                />
                <select 
                  required 
                  value={formData.customerId} 
                  onChange={e => setFormData({...formData, customerId: e.target.value})} 
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus appearance-none"
                >
                  <option value="">-- Select from results --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
                <input required type="number" min="1" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus appearance-none">
                    <option value="Electronics">Electronics</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Home">Home</option>
                    <option value="Beauty">Beauty</option>
                    <option value="Sports">Sports</option>
                    <option value="Grocery">Grocery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Channel</label>
                  <select required value={formData.channel} onChange={e => setFormData({...formData, channel: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus appearance-none">
                    <option value="ONLINE">Online</option>
                    <option value="OFFLINE">Offline</option>
                    <option value="MOBILE_APP">Mobile App</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input required type="date" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus" />
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 btn-ai rounded-lg text-sm font-medium">Create Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
