'use client';

import { useState, useEffect, useCallback } from 'react';
import { customerApi } from '@/lib/api';
import { formatCurrency, formatDate, debounce } from '@/lib/utils';
import { Search, Plus, Filter, Download, MoreHorizontal, Edit, Trash2, ChevronLeft, ChevronRight, User } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  
  // Filters
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState('');
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  // Form
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', city: '', gender: '', age: ''
  });

  const fetchCustomers = useCallback(async (params: any = {}) => {
    setLoading(true);
    try {
      const res = await customerApi.list({
        page: params.page || page,
        limit,
        search: params.search !== undefined ? params.search : search,
        city: params.city !== undefined ? params.city : city,
        gender: params.gender !== undefined ? params.gender : gender,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      setCustomers(res.data.customers);
      setTotal(res.data.pagination.total);
    } catch (err) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, city, gender]);

  useEffect(() => {
    fetchCustomers();
  }, [page]);

  const debouncedSearch = useCallback(
    debounce((val: string) => {
      setPage(1);
      fetchCustomers({ search: val, page: 1 });
    }, 500),
    [fetchCustomers]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    debouncedSearch(val);
  };

  const handleFilterChange = (type: string, val: string) => {
    setPage(1);
    if (type === 'city') {
      setCity(val);
      fetchCustomers({ city: val, page: 1 });
    } else if (type === 'gender') {
      setGender(val);
      fetchCustomers({ gender: val, page: 1 });
    }
  };

  const handleImportSample = async () => {
    try {
      setLoading(true);
      await customerApi.importSample();
      toast.success('Sample data imported');
      fetchCustomers({ page: 1 });
    } catch (err) {
      toast.error('Failed to import sample data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditModalOpen && selectedCustomer) {
        await customerApi.update(selectedCustomer.id, formData);
        toast.success('Customer updated');
      } else {
        await customerApi.create(formData);
        toast.success('Customer created');
      }
      closeModals();
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    try {
      await customerApi.delete(selectedCustomer.id);
      toast.success('Customer deleted');
      closeModals();
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to delete customer');
    }
  };

  const fetchCustomerDetails = async (id: string) => {
    try {
      const res = await customerApi.get(id);
      setSelectedCustomer(res.data.customer);
      setIsDetailModalOpen(true);
    } catch (err) {
      toast.error('Failed to load customer details');
    }
  };

  const openAddModal = () => {
    setFormData({ name: '', email: '', phone: '', city: '', gender: '', age: '' });
    setIsAddModalOpen(true);
  };

  const openEditModal = (customer: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      city: customer.city || '',
      gender: customer.gender || '',
      age: customer.age?.toString() || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (customer: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setIsDeleteModalOpen(true);
  };

  const closeModals = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setIsDetailModalOpen(false);
    setSelectedCustomer(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
          <p className="text-sm text-muted-foreground">
            Manage your customer database ({total} total)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleImportSample}
            className="px-4 py-2 bg-secondary text-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors border border-border"
          >
            Import Sample
          </button>
          <button className="px-4 py-2 bg-secondary text-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors border border-border flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
          <button 
            onClick={openAddModal}
            className="px-4 py-2 btn-ai rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm input-focus"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
          <select 
            value={city} 
            onChange={(e) => handleFilterChange('city', e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none input-focus appearance-none"
          >
            <option value="">All Cities</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Delhi">Delhi</option>
            <option value="Bangalore">Bangalore</option>
            <option value="Chennai">Chennai</option>
          </select>
          <select 
            value={gender} 
            onChange={(e) => handleFilterChange('gender', e.target.value)}
            className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none input-focus appearance-none"
          >
            <option value="">All Genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Contact</th>
                <th className="px-6 py-3 font-medium">City/Demographics</th>
                <th className="px-6 py-3 font-medium text-right">Orders</th>
                <th className="px-6 py-3 font-medium text-right">Spent</th>
                <th className="px-6 py-3 font-medium">Last Purchase</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-6 py-4">
                      <div className="h-10 shimmer rounded-lg w-full"></div>
                    </td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    No customers found matching your criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr 
                    key={c.id} 
                    onClick={() => fetchCustomerDetails(c.id)}
                    className="table-row-hover"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {c.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="font-medium text-foreground">{c.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-muted-foreground">{c.email}</div>
                      <div className="text-xs text-muted-foreground/70">{c.phone || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {c.city || '—'}
                      <div className="text-xs text-muted-foreground/70">
                        {c.gender ? c.gender.substring(0, 1) : '-'} {c.age ? `• ${c.age}y` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">{c.totalOrders}</td>
                    <td className="px-6 py-4 text-right font-medium text-primary">
                      {formatCurrency(c.totalSpent)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDate(c.lastPurchaseDate)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => openEditModal(c, e)}
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-secondary"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => openDeleteModal(c, e)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-secondary"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && customers.length > 0 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(page - 1) * limit + 1}</span> to <span className="font-medium text-foreground">{Math.min(page * limit, total)}</span> of <span className="font-medium text-foreground">{total}</span> customers
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

      {/* Add/Edit Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in border border-border">
            <h3 className="text-xl font-bold mb-4">
              {isEditModalOpen ? 'Edit Customer' : 'Add New Customer'}
            </h3>
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Age</label>
                  <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus appearance-none">
                  <option value="">Select Gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button type="button" onClick={closeModals} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 btn-ai rounded-lg text-sm font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Delete Customer?</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Are you sure you want to delete <span className="font-semibold text-foreground">{selectedCustomer?.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={closeModals} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors font-medium">Cancel</button>
              <button onClick={handleDeleteCustomer} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-border overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-start bg-secondary/30">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xl">
                  {selectedCustomer.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{selectedCustomer.name}</h3>
                  <div className="text-muted-foreground text-sm flex gap-4 mt-1">
                    <span>{selectedCustomer.email}</span>
                    {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                  </div>
                </div>
              </div>
              <button onClick={closeModals} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-secondary p-4 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Total Spent</div>
                  <div className="text-xl font-bold text-primary">{formatCurrency(selectedCustomer.totalSpent)}</div>
                </div>
                <div className="bg-secondary p-4 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Total Orders</div>
                  <div className="text-xl font-bold">{selectedCustomer.totalOrders}</div>
                </div>
                <div className="bg-secondary p-4 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground mb-1">City</div>
                  <div className="text-xl font-bold">{selectedCustomer.city || '—'}</div>
                </div>
                <div className="bg-secondary p-4 rounded-xl border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Joined Date</div>
                  <div className="text-lg font-bold">{formatDate(selectedCustomer.joinedDate)}</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Recent Orders</h4>
                {selectedCustomer.orders?.length > 0 ? (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-secondary/50 border-b border-border text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium">Date</th>
                          <th className="px-4 py-2 font-medium">Category</th>
                          <th className="px-4 py-2 font-medium">Channel</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selectedCustomer.orders.map((o: any) => (
                          <tr key={o.id} className="hover:bg-secondary/20">
                            <td className="px-4 py-3">{formatDate(o.purchaseDate)}</td>
                            <td className="px-4 py-3">{o.category}</td>
                            <td className="px-4 py-3 text-xs">
                              <span className="px-2 py-1 rounded bg-secondary">{o.channel}</span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className={`px-2 py-1 rounded-full ${o.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(o.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-border border-dashed">
                    No orders found for this customer.
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-border bg-secondary/30 flex justify-end gap-3">
              <button onClick={(e) => { setIsDetailModalOpen(false); openEditModal(selectedCustomer, e as any); }} className="px-4 py-2 border border-border rounded-lg bg-card hover:bg-secondary transition-colors text-sm font-medium flex items-center gap-2">
                <Edit className="w-4 h-4" /> Edit Profile
              </button>
              <button onClick={closeModals} className="px-4 py-2 btn-ai rounded-lg text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
