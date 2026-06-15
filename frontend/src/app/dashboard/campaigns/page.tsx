'use client';

import { useState, useEffect } from 'react';
import { campaignApi, segmentApi, aiApi } from '@/lib/api';
import { formatDate, getChannelIcon, getStatusColor } from '@/lib/utils';
import { 
  Megaphone, Plus, Rocket, BarChart3, Users, Clock, ArrowRight, CheckCircle2, 
  Wand2, X, Play, RefreshCw, Zap, TrendingUp, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  // Multi-step Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', channel: 'EMAIL', segmentId: '', 
    subject: '', message: '',
    // AI gen fields
    goal: 'Boost weekend sales', tone: 'Professional'
  });
  const [generatedVariants, setGeneratedVariants] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);

  // Detail Modal
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchData = async () => {
    try {
      const [campRes, segRes] = await Promise.all([
        campaignApi.list(),
        segmentApi.list()
      ]);
      setCampaigns(campRes.data.campaigns);
      setSegments(segRes.data.segments);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleGenerateMessage = async () => {
    if (!form.goal) return toast.error('Goal is required');
    setIsGenerating(true);
    try {
      const selectedSeg = segments.find(s => s.id === form.segmentId);
      const res = await aiApi.generateMessage({
        goal: form.goal,
        audience: selectedSeg ? selectedSeg.name : 'All customers',
        tone: form.tone,
        channel: form.channel
      });
      setGeneratedVariants(res.data.variants);
      
      // Auto-select first variant
      if (res.data.variants.length > 0) {
        setForm({
          ...form,
          subject: res.data.variants[0].subject || '',
          message: res.data.variants[0].message
        });
      }
    } catch (err) {
      toast.error('Failed to generate message');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVariantSelect = (idx: number) => {
    setSelectedVariantIndex(idx);
    setForm({
      ...form,
      subject: generatedVariants[idx].subject || '',
      message: generatedVariants[idx].message
    });
  };

  const handleCreate = async () => {
    try {
      await campaignApi.create({
        name: form.name,
        channel: form.channel,
        segmentId: form.segmentId,
        subject: form.subject,
        message: form.message
      });
      toast.success('Campaign created in Draft status');
      setIsCreateOpen(false);
      setStep(1);
      fetchData();
    } catch (err) {
      toast.error('Failed to create campaign');
    }
  };

  const openDetail = async (c: any) => {
    setSelectedCampaign(c);
    setIsDetailOpen(true);
    setAiAnalysis(null);
    try {
      const res = await campaignApi.get(c.id);
      setSelectedCampaign(res.data.campaign);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLaunch = async () => {
    if (!selectedCampaign) return;
    try {
      await campaignApi.launch(selectedCampaign.id);
      toast.success('Campaign launched! Messages are being queued.');
      setIsDetailOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to launch campaign');
    }
  };

  const handleAnalyze = async () => {
    if (!selectedCampaign) return;
    setIsAnalyzing(true);
    try {
      const res = await aiApi.analyzePerformance(selectedCampaign.id);
      setAiAnalysis(res.data.analysis);
      toast.success('Analysis complete');
    } catch (err) {
      toast.error('Failed to analyze performance');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredCampaigns = filter === 'ALL' ? campaigns : campaigns.filter(c => c.status === filter);

  // Helper for progress bar
  const getProgress = (count: number, total: number) => {
    if (!total) return 0;
    return Math.round((count / total) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-sm text-muted-foreground">Orchestrate and analyze your marketing efforts</p>
        </div>
        <button 
          onClick={() => { setForm({ name: '', channel: 'EMAIL', segmentId: '', subject: '', message: '', goal: 'Boost weekend sales', tone: 'Professional' }); setStep(1); setGeneratedVariants([]); setIsCreateOpen(true); }}
          className="btn-ai px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Campaign
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-secondary w-max rounded-lg">
        {['ALL', 'DRAFT', 'RUNNING', 'COMPLETED'].map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === f ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {f === 'ALL' ? 'All Campaigns' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Campaign Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => <div key={i} className="h-48 shimmer rounded-xl" />)}
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="text-center p-12 bg-card border border-border border-dashed rounded-xl">
          <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold">No campaigns found</h3>
          <p className="text-muted-foreground text-sm mt-1">Create your first campaign to start engaging customers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCampaigns.map(c => {
            const isCompleted = c.status === 'COMPLETED';
            return (
              <div 
                key={c.id} 
                onClick={() => openDetail(c)}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-all cursor-pointer card-hover relative overflow-hidden flex flex-col"
              >
                {/* Status indicator line */}
                <div className={`absolute top-0 left-0 w-full h-1 ${c.status === 'RUNNING' ? 'bg-blue-500' : isCompleted ? 'bg-emerald-500' : 'bg-muted'}`} />
                
                <div className="flex justify-between items-start mb-4 mt-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl shadow-sm">
                      {getChannelIcon(c.channel)}
                    </div>
                    <div>
                      <h3 className="font-bold text-base truncate max-w-[150px]" title={c.name}>{c.name}</h3>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> {formatDate(c.createdAt)}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-bold rounded-md uppercase border ${getStatusColor(c.status)}`}>
                    {c.status}
                  </span>
                </div>

                <div className="bg-secondary/50 rounded-lg p-3 mb-4 flex-1">
                  <div className="flex justify-between items-center text-xs mb-2">
                    <span className="text-muted-foreground">Target Segment</span>
                    <span className="font-semibold text-primary truncate max-w-[120px]">{c.segment?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Audience Size</span>
                    <span className="font-semibold">{c.segment?.customerCount || 0}</span>
                  </div>
                </div>

                {isCompleted || c.status === 'RUNNING' ? (
                  <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-4">
                    <div>
                      <div className="text-lg font-bold text-primary">{c.totalSent}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Sent</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-emerald-400">{getProgress(c.totalOpened, c.totalDelivered)}%</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Open Rate</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-accent">{getProgress(c.totalConverted, c.totalSent)}%</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Conv. Rate</div>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-border pt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground italic">Ready to launch</span>
                    <button className="text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-md font-bold flex items-center gap-1 hover:bg-primary/30">
                      View <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create Campaign Multi-step Modal ───────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-2xl shadow-2xl border border-border overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Rocket className="w-5 h-5 text-primary" /> Create Campaign
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
            </div>

            {/* Stepper */}
            <div className="flex px-8 py-4 bg-secondary/20 border-b border-border">
              {['Basic Info', 'Segment', 'AI Content', 'Review'].map((label, i) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-2 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10 ${step > i + 1 ? 'bg-primary text-primary-foreground' : step === i + 1 ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' : 'bg-secondary border border-border text-muted-foreground'}`}>
                    {step > i + 1 ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className={`text-xs font-semibold ${step >= i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</div>
                  {i < 3 && <div className={`absolute top-4 left-[50%] w-full h-[2px] ${step > i + 1 ? 'bg-primary' : 'bg-border'}`} />}
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8">
              {/* Step 1: Basics */}
              {step === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <label className="block text-sm font-medium mb-2">Campaign Name *</label>
                    <input autoFocus type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Summer Flash Sale" className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-sm input-focus" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-3">Channel *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'EMAIL', icon: '📧', label: 'Email' },
                        { id: 'SMS', icon: '💬', label: 'SMS' },
                        { id: 'WHATSAPP', icon: '💚', label: 'WhatsApp' },
                        { id: 'PUSH', icon: '🔔', label: 'Push Notify' }
                      ].map(ch => (
                        <div 
                          key={ch.id} 
                          onClick={() => setForm({...form, channel: ch.id})}
                          className={`p-4 border rounded-xl flex items-center gap-3 cursor-pointer transition-all ${form.channel === ch.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-card hover:bg-secondary'}`}
                        >
                          <span className="text-2xl">{ch.icon}</span>
                          <span className="font-semibold text-sm">{ch.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Segment */}
              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">Select Target Segment *</label>
                    <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                      {segments.find(s => s.id === form.segmentId)?.customerCount || 0} customers
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {segments.map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => setForm({...form, segmentId: s.id})}
                        className={`p-4 border rounded-xl cursor-pointer transition-all flex justify-between items-center ${form.segmentId === s.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-secondary'}`}
                      >
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            {s.name} 
                            {s.isAIGenerated && <Zap className="w-3 h-3 text-primary" />}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{s.description}</div>
                        </div>
                        <div className="text-sm font-medium flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" /> {s.customerCount}
                        </div>
                      </div>
                    ))}
                    {segments.length === 0 && (
                      <div className="text-center p-8 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                        No segments available. Please create one first.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: AI Generation */}
              {step === 3 && (
                <div className="space-y-6 animate-fade-in flex flex-col h-full">
                  {!generatedVariants.length ? (
                    <>
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                        <Wand2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-sm">AI Message Generator</h4>
                          <p className="text-xs text-muted-foreground mt-1">Let AI craft high-converting copy based on your goal and audience.</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Campaign Goal</label>
                          <input type="text" value={form.goal} onChange={e => setForm({...form, goal: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus" placeholder="e.g. Announce new summer collection" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Tone of Voice</label>
                          <select value={form.tone} onChange={e => setForm({...form, tone: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus appearance-none">
                            <option>Professional</option>
                            <option>Casual</option>
                            <option>Festive</option>
                            <option>Urgent</option>
                            <option>Humorous</option>
                          </select>
                        </div>
                        <button 
                          onClick={handleGenerateMessage}
                          disabled={isGenerating}
                          className="w-full btn-ai py-3 rounded-xl font-bold flex justify-center items-center gap-2 mt-4"
                        >
                          {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Wand2 className="w-5 h-5" />}
                          {isGenerating ? 'Drafting Variations...' : 'Generate Messages'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-sm">Select a Variant</h4>
                        <button onClick={() => setGeneratedVariants([])} className="text-xs text-primary hover:underline">Regenerate</button>
                      </div>
                      <div className="space-y-3 overflow-y-auto pr-2">
                        {generatedVariants.map((v, i) => (
                          <div 
                            key={i} 
                            onClick={() => handleVariantSelect(i)}
                            className={`p-4 border rounded-xl cursor-pointer transition-all ${selectedVariantIndex === i ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-secondary hover:border-primary/50'}`}
                          >
                            {form.channel === 'EMAIL' && v.subject && (
                              <div className="font-bold text-sm mb-2 pb-2 border-b border-border">Subject: {v.subject}</div>
                            )}
                            <div className="text-sm whitespace-pre-wrap font-medium">{v.message}</div>
                            {v.cta && <div className="mt-3 inline-block bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded">{v.cta}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Review */}
              {step === 4 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-secondary rounded-xl p-5 border border-border">
                    <h4 className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mb-4">Campaign Summary</h4>
                    <div className="grid grid-cols-2 gap-y-4 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Name</div>
                        <div className="font-bold">{form.name}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs mb-1">Channel</div>
                        <div className="font-bold flex items-center gap-2">
                          {getChannelIcon(form.channel)} {form.channel}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-muted-foreground text-xs mb-1">Segment</div>
                        <div className="font-bold bg-primary/10 text-primary px-3 py-1.5 rounded-lg inline-block">
                          {segments.find(s => s.id === form.segmentId)?.name} 
                          ({segments.find(s => s.id === form.segmentId)?.customerCount} customers)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="bg-secondary/50 p-3 text-xs font-bold text-muted-foreground border-b border-border uppercase">
                      Message Preview
                    </div>
                    <div className="p-5">
                      {form.channel === 'EMAIL' && (
                        <div className="mb-4 text-lg font-bold border-b border-border pb-3">{form.subject}</div>
                      )}
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{form.message}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-secondary/30 flex justify-between">
              <button 
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
                className="px-4 py-2 border border-border rounded-lg bg-card hover:bg-secondary transition-colors text-sm font-medium disabled:opacity-0"
              >
                Back
              </button>
              
              {step < 4 ? (
                <button 
                  onClick={() => setStep(step + 1)}
                  disabled={(step === 1 && !form.name) || (step === 2 && !form.segmentId) || (step === 3 && !form.message)}
                  className="px-6 py-2 btn-ai rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button 
                  onClick={handleCreate}
                  className="px-6 py-2 btn-ai rounded-lg text-sm font-bold flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Create Campaign
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Campaign Detail Modal ──────────────────────────────────────────── */}
      {isDetailOpen && selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl border border-border overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-6 border-b border-border flex justify-between items-start bg-secondary/20 shrink-0">
              <div className="flex gap-4 items-start">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl shadow-lg">
                  {getChannelIcon(selectedCampaign.channel)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">{selectedCampaign.name}</h2>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getStatusColor(selectedCampaign.status)}`}>
                      {selectedCampaign.status}
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {selectedCampaign.segment?.name} ({selectedCampaign.segment?.customerCount})
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedCampaign.status === 'DRAFT' && (
                  <button onClick={handleLaunch} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all">
                    <Play className="w-4 h-4" /> Launch Now
                  </button>
                )}
                {selectedCampaign.status === 'COMPLETED' && (
                  <button onClick={handleAnalyze} disabled={isAnalyzing} className="px-4 py-2 btn-ai rounded-lg font-bold flex items-center gap-2">
                    {isAnalyzing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <BarChart3 className="w-4 h-4" />}
                    Analyze Performance
                  </button>
                )}
                <button onClick={() => setIsDetailOpen(false)} className="p-2 bg-secondary rounded-lg text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-background">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Col: Stats & Message */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Progress Funnel */}
                  <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="font-semibold mb-6 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" /> Delivery Funnel
                    </h3>
                    
                    <div className="space-y-5">
                      {[
                        { label: 'Sent', count: selectedCampaign.totalSent, total: selectedCampaign.totalSent, color: 'bg-blue-500' },
                        { label: 'Delivered', count: selectedCampaign.totalDelivered, total: selectedCampaign.totalSent, color: 'bg-emerald-500' },
                        { label: 'Opened', count: selectedCampaign.totalOpened, total: selectedCampaign.totalDelivered, color: 'bg-purple-500' },
                        { label: 'Clicked', count: selectedCampaign.totalClicked, total: selectedCampaign.totalOpened, color: 'bg-amber-500' },
                        { label: 'Converted', count: selectedCampaign.totalConverted, total: selectedCampaign.totalClicked, color: 'bg-primary' },
                      ].map((stat, i) => {
                        const percent = getProgress(stat.count, stat.total);
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-sm mb-1.5">
                              <span className="font-medium">{stat.label}</span>
                              <span className="text-muted-foreground"><strong className="text-foreground">{stat.count}</strong> {percent > 0 ? `(${percent}%)` : ''}</span>
                            </div>
                            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                              <div className={`h-full ${stat.color} transition-all duration-1000`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="bg-secondary/50 p-4 border-b border-border flex justify-between items-center">
                      <h3 className="font-semibold">Message Content</h3>
                      <span className="text-xs bg-secondary px-2 py-1 rounded font-mono">{selectedCampaign.channel}</span>
                    </div>
                    <div className="p-6">
                      {selectedCampaign.channel === 'EMAIL' && selectedCampaign.subject && (
                        <div className="font-bold text-lg mb-4 pb-4 border-b border-border">Subj: {selectedCampaign.subject}</div>
                      )}
                      <div className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed font-medium">
                        {selectedCampaign.message}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Col: AI Analysis & Timeline */}
                <div className="space-y-6 flex flex-col">
                  
                  {/* AI Analysis Panel */}
                  {aiAnalysis && (
                    <div className="bg-card border border-primary/40 rounded-xl overflow-hidden animate-fade-in shadow-lg shadow-primary/10">
                      <div className="bg-gradient-to-r from-primary to-accent p-4 text-white">
                        <h3 className="font-bold flex items-center gap-2">
                          <Zap className="w-4 h-4 text-yellow-300" /> AI Insights
                        </h3>
                      </div>
                      <div className="p-5 space-y-4 text-sm">
                        <div>
                          <div className="text-emerald-500 font-bold mb-1 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> What Worked
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{aiAnalysis.whatWorked}</p>
                        </div>
                        <div>
                          <div className="text-red-400 font-bold mb-1 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" /> Areas for Improvement
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{aiAnalysis.whatFailed}</p>
                        </div>
                        <div className="bg-secondary/50 p-3 rounded-lg border border-border">
                          <div className="font-bold text-primary mb-1 text-xs uppercase tracking-wider">Next Step Suggestion</div>
                          <p className="font-medium">{aiAnalysis.suggestions}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timeline (if we had detailed comm logs fetched) */}
                  <div className="bg-card border border-border rounded-xl p-5 flex-1 min-h-[300px]">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <ActivityIcon className="w-4 h-4 text-muted-foreground" /> Recent Activity
                    </h3>
                    <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                        <RefreshCw className={`w-5 h-5 text-muted-foreground ${selectedCampaign.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {selectedCampaign.status === 'RUNNING' ? 'Delivery in progress...' : 
                         selectedCampaign.status === 'DRAFT' ? 'Waiting for launch' : 'Delivery complete'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedCampaign.status === 'RUNNING' ? 'Simulating real-world delivery events. Stats update automatically.' : 
                         'Full communication logs are tracked in the database.'}
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ActivityIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
  );
}
