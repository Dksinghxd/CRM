'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap, BarChart3, Users, Target } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: '', email: 'admin@smartreach.ai', password: 'Admin@123' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (mode === 'login') {
        res = await authApi.login(form.email, form.password);
      } else {
        res = await authApi.register(form.name, form.email, form.password);
      }
      const { user, token } = res.data;
      setAuth(user, token);
      toast.success(`Welcome back, ${user.name}! 👋`);
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* ─── Left Panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(217_91%_10%)] via-background to-[hsl(256_91%_10%)]" />

        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 flex flex-col justify-center px-16">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">SmartReach AI</span>
          </div>

          <h1 className="text-5xl font-bold leading-tight mb-6">
            Intelligent
            <span className="block gradient-text">CRM for Shopper</span>
            Engagement
          </h1>

          <p className="text-lg text-muted-foreground mb-12 leading-relaxed">
            Identify segments, generate AI campaigns, track performance — all in one platform.
          </p>

          {/* Feature highlights */}
          <div className="space-y-5">
            {[
              { icon: Users, label: 'AI Segment Builder', desc: 'Natural language → customer filters' },
              { icon: Target, label: 'Campaign Generator', desc: 'AI-crafted personalized messages' },
              { icon: BarChart3, label: 'Performance Analyst', desc: 'Deep insights & next-step predictions' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-muted-foreground text-xs">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-4">
            {[
              { value: '100+', label: 'Customers' },
              { value: '5', label: 'Segments' },
              { value: '4', label: 'Campaigns' },
            ].map(({ value, label }) => (
              <div key={label} className="glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold gradient-text">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Right Panel (Form) ──────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">SmartReach AI</span>
          </div>

          <div className="glass rounded-2xl p-8 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-muted-foreground text-sm">
                {mode === 'login'
                  ? 'Sign in to your SmartReach dashboard'
                  : 'Start your AI-powered CRM journey'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Full Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required={mode === 'register'}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="admin@smartreach.ai"
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Demo hint */}
              {mode === 'login' && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground">
                  <span className="text-primary font-medium">Demo credentials</span> are pre-filled above.
                  Just click <span className="text-primary font-medium">Sign In</span>.
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-ai py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  mode === 'login' ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="text-primary font-medium hover:underline"
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
