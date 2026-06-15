'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { getInitials } from '@/lib/utils';
import { User, Key, Palette, Server, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    // Simulate API call since we don't have update profile endpoint wired in frontend yet
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Profile updated successfully');
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your account settings and platform configurations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Navigation / Sidebar (visual only for large screens) */}
        <div className="hidden md:block col-span-1 space-y-1">
          {[
            { id: 'profile', icon: User, label: 'Profile' },
            { id: 'api', icon: Key, label: 'API & Integrations' },
            { id: 'appearance', icon: Palette, label: 'Appearance' },
            { id: 'system', icon: Server, label: 'System Info' },
          ].map(item => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary text-foreground text-sm font-medium">
              <item.icon className="w-4 h-4 text-primary" />
              {item.label}
            </div>
          ))}
        </div>

        <div className="col-span-1 md:col-span-3 space-y-8">
          
          {/* ─── Profile ────────────────────────────────────────────────────── */}
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="bg-secondary/50 p-5 border-b border-border flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Profile Settings</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                  {user ? getInitials(user.name) : 'U'}
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Profile Picture</div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-xs font-medium transition-colors">Change</button>
                    <button className="px-3 py-1.5 text-destructive hover:bg-destructive/10 rounded-md text-xs font-medium transition-colors">Remove</button>
                  </div>
                </div>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-5 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Full Name</label>
                  <input 
                    type="text" 
                    value={profileForm.name} 
                    onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm input-focus" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email Address</label>
                  <input 
                    type="email" 
                    value={profileForm.email} 
                    onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                    className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm input-focus" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Role</label>
                  <input 
                    type="text" 
                    value={user?.role || 'Admin'} 
                    disabled
                    className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-muted-foreground cursor-not-allowed" 
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Roles can only be changed by super administrators.</p>
                </div>
                
                <div className="pt-2">
                  <button type="submit" disabled={isSaving} className="btn-ai px-6 py-2.5 rounded-lg text-sm flex items-center gap-2">
                    {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* ─── API Keys ───────────────────────────────────────────────────── */}
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="bg-secondary/50 p-5 border-b border-border flex items-center gap-3">
              <Key className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">API & Integrations</h3>
            </div>
            <div className="p-6 space-y-6">
              
              <div>
                <label className="block text-sm font-medium mb-1.5">OpenAI API Key</label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    value="sk-proj-*******************************************************" 
                    disabled
                    className="flex-1 px-4 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-muted-foreground font-mono" 
                  />
                  <button className="px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm font-medium hover:bg-secondary/80">Edit</button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Used for AI Copilot, Segment Builder, and Message Generation. (Configured in backend .env)</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Channel Service URL</label>
                <input 
                  type="text" 
                  value="http://localhost:5000" 
                  disabled
                  className="w-full px-4 py-2.5 bg-secondary/50 border border-border rounded-lg text-sm text-muted-foreground font-mono" 
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">The microservice responsible for simulated message delivery.</p>
              </div>

            </div>
          </section>

          {/* ─── Appearance ─────────────────────────────────────────────────── */}
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="bg-secondary/50 p-5 border-b border-border flex items-center gap-3">
              <Palette className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Appearance</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between p-4 border border-primary/30 bg-primary/5 rounded-xl">
                <div>
                  <h4 className="font-medium text-sm">Dark Theme Active</h4>
                  <p className="text-xs text-muted-foreground mt-1">SmartReach CRM uses a high-contrast dark theme by default to reduce eye strain and provide a premium experience.</p>
                </div>
                <div className="w-12 h-6 bg-primary rounded-full relative opacity-80 cursor-not-allowed">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </section>

          {/* ─── Danger Zone ────────────────────────────────────────────────── */}
          <section className="bg-card border border-destructive/30 rounded-xl overflow-hidden">
            <div className="bg-destructive/10 p-5 border-b border-destructive/20 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <h3 className="font-semibold text-destructive">Danger Zone</h3>
            </div>
            <div className="p-6 flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">Sign Out</h4>
                <p className="text-xs text-muted-foreground mt-1">End your current session and return to the login screen.</p>
              </div>
              <button 
                onClick={() => setIsLogoutModalOpen(true)}
                className="px-4 py-2.5 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </section>

        </div>
      </div>

      {/* Logout Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border text-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6 ml-1" />
            </div>
            <h3 className="text-xl font-bold mb-2">Ready to leave?</h3>
            <p className="text-muted-foreground text-sm mb-6">
              You will be signed out of your account. You'll need to enter your credentials to access the CRM again.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setIsLogoutModalOpen(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors font-medium">Cancel</button>
              <button onClick={logout} className="px-4 py-2 bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors font-medium">Sign Out</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
