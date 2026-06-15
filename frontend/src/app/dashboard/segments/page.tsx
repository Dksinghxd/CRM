'use client';

import { useState, useEffect } from 'react';
import { segmentApi, aiApi } from '@/lib/api';
import { GitBranch, Plus, Zap, Users, Trash2, CheckCircle2, Wand2, Lightbulb, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SegmentsPage() {
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<any>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Segment form
  const [form, setForm] = useState({
    name: '',
    description: '',
    operator: 'AND',
    rules: [] as any[]
  });
  const [previewCustomers, setPreviewCustomers] = useState<any[]>([]);
  const [previewCount, setPreviewCount] = useState(0);

  const fetchSegments = async () => {
    try {
      const res = await segmentApi.list();
      setSegments(res.data.segments);
    } catch (err) {
      toast.error('Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await aiApi.audienceSuggestions();
      setSuggestions(res.data.suggestions);
    } catch (err) {
      console.error('Failed to load suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    fetchSegments();
    fetchSuggestions();
  }, []);

  const handleGenerate = async () => {
    if (!prompt) return toast.error('Please enter a description');
    setIsGenerating(true);
    try {
      const res = await aiApi.buildSegment(prompt);
      const generated = res.data.segment;
      setForm({
        name: generated.name || '',
        description: generated.description || '',
        operator: generated.operator || 'AND',
        rules: generated.rules || []
      });
      toast.success('Rules generated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    if (form.rules.length === 0) return toast.error('Add at least one rule');
    try {
      const res = await segmentApi.preview(form.rules, form.operator);
      setPreviewCustomers(res.data.preview);
      setPreviewCount(res.data.totalCount);
      toast.success(`Found ${res.data.totalCount} matching customers`);
    } catch (err) {
      toast.error('Preview failed');
    }
  };

  const handleSave = async () => {
    if (!form.name || form.rules.length === 0) return toast.error('Name and rules are required');
    try {
      await segmentApi.create({
        ...form,
        isAIGenerated: mode === 'ai'
      });
      toast.success('Segment created');
      setIsModalOpen(false);
      fetchSegments();
    } catch (err) {
      toast.error('Failed to create segment');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await segmentApi.delete(id);
      toast.success('Segment deleted');
      if (selectedSegment?.id === id) setSelectedSegment(null);
      fetchSegments();
    } catch (err) {
      toast.error('Failed to delete segment');
    }
  };

  const handleEvaluate = async (id: string) => {
    try {
      const res = await segmentApi.evaluate(id);
      toast.success(`Segment evaluated: ${res.data.totalCount} customers match.`);
      fetchSegments(); // update the customer count on the cards
      
      // Update selected segment if it's the one we just evaluated
      if (selectedSegment?.id === id) {
        setSelectedSegment({ ...selectedSegment, customerCount: res.data.totalCount });
      }
    } catch (err) {
      toast.error('Evaluation failed');
    }
  };

  const useSuggestion = (suggestion: any) => {
    setPrompt(suggestion.reason || suggestion.description);
    setMode('ai');
    setIsModalOpen(true);
    setForm({ name: '', description: '', operator: 'AND', rules: [] });
    setPreviewCustomers([]);
  };

  const openModal = () => {
    setForm({ name: '', description: '', operator: 'AND', rules: [] });
    setPrompt('');
    setPreviewCustomers([]);
    setPreviewCount(0);
    setIsModalOpen(true);
  };

  // Rule editors
  const addRule = () => setForm({ ...form, rules: [...form.rules, { field: 'totalSpent', operator: 'gt', value: '' }] });
  const updateRule = (i: number, key: string, val: any) => {
    const newRules = [...form.rules];
    newRules[i][key] = val;
    setForm({ ...form, rules: newRules });
  };
  const removeRule = (i: number) => setForm({ ...form, rules: form.rules.filter((_, idx) => idx !== i) });

  const formatRule = (r: any) => `${r.field} ${r.operator} ${r.value}`;

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6">
      
      {/* ─── Left Panel: Segment List ────────────────────────────────────────── */}
      <div className="w-1/3 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Segments</h2>
          <button onClick={openModal} className="btn-ai text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Create
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {loading ? (
            Array(4).fill(0).map((_, i) => <div key={i} className="h-28 shimmer rounded-xl" />)
          ) : segments.length === 0 ? (
            <div className="text-center p-8 bg-card border border-border border-dashed rounded-xl text-muted-foreground text-sm">
              No segments yet. Create one to get started.
            </div>
          ) : (
            segments.map(s => (
              <div 
                key={s.id} 
                onClick={() => setSelectedSegment(s)}
                className={`bg-card p-4 rounded-xl border transition-all cursor-pointer ${selectedSegment?.id === s.id ? 'border-primary ring-1 ring-primary/50' : 'border-border hover:border-primary/50'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{s.name}</h3>
                    {s.isAIGenerated && (
                      <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                        <Zap className="w-3 h-3" /> AI
                      </span>
                    )}
                  </div>
                  <button onClick={(e) => handleDelete(s.id, e)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{s.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium bg-secondary/50 p-2 rounded-lg">
                  <div className="flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5" /> {s.rules.length} rules</div>
                  <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {s.customerCount} customers</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Right Panel: Detail or Suggestions ─────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
        {selectedSegment ? (
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col h-full animate-fade-in">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  {selectedSegment.name}
                  {selectedSegment.isAIGenerated && (
                    <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-md flex items-center gap-1 font-bold">
                      <Zap className="w-3.5 h-3.5" /> Generated by AI
                    </span>
                  )}
                </h2>
                <p className="text-muted-foreground mt-2">{selectedSegment.description}</p>
              </div>
              <button 
                onClick={() => handleEvaluate(selectedSegment.id)}
                className="px-4 py-2 bg-secondary border border-border hover:bg-secondary/80 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Evaluate Now
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-secondary p-5 rounded-xl border border-border">
                <div className="text-sm text-muted-foreground mb-1">Matching Customers</div>
                <div className="text-3xl font-bold text-primary flex items-center gap-3">
                  <Users className="w-6 h-6 opacity-50" />
                  {selectedSegment.customerCount}
                </div>
              </div>
              <div className="bg-secondary p-5 rounded-xl border border-border">
                <div className="text-sm text-muted-foreground mb-1">Operator Logic</div>
                <div className="text-xl font-bold font-mono tracking-widest text-accent">
                  {selectedSegment.operator}
                </div>
              </div>
            </div>

            <h3 className="font-semibold mb-4 text-lg">Filter Rules</h3>
            <div className="space-y-3">
              {selectedSegment.rules.map((rule: any, i: number) => (
                <div key={i} className="flex items-center gap-3 bg-secondary/30 p-3 rounded-lg border border-border/50">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">{i + 1}</div>
                  <div className="font-mono text-sm">
                    <span className="text-primary font-bold">{rule.field}</span>
                    <span className="mx-2 text-muted-foreground">{rule.operator}</span>
                    <span className="text-accent font-bold">{typeof rule.value === 'object' ? JSON.stringify(rule.value) : rule.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="glass p-6 rounded-xl border border-border flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <Lightbulb className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">AI Audience Suggestions</h3>
                <p className="text-sm text-muted-foreground">Select a segment on the left, or try one of these AI-recommended audiences based on your store data.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loadingSuggestions ? (
                Array(4).fill(0).map((_, i) => <div key={i} className="h-32 shimmer rounded-xl" />)
              ) : suggestions.map((s, i) => (
                <div key={i} className="bg-card p-5 rounded-xl border border-border hover:border-primary/50 transition-colors group cursor-pointer" onClick={() => useSuggestion(s)}>
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-primary" /> {s.name}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{s.reason || s.description}</p>
                  <div className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to build this segment →
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Create Modal ────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-border overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-border flex justify-between items-center bg-secondary/30">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-primary" /> Create Segment
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-8">
              
              {/* Left Column: Builder */}
              <div className="space-y-6">
                
                {/* Tabs */}
                <div className="flex p-1 bg-secondary rounded-lg">
                  <button onClick={() => setMode('ai')} className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 ${mode === 'ai' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
                    <Zap className="w-4 h-4" /> AI Builder
                  </button>
                  <button onClick={() => setMode('manual')} className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 ${mode === 'manual' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
                    <Plus className="w-4 h-4" /> Manual
                  </button>
                </div>

                {mode === 'ai' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Describe your audience in plain English</label>
                      <textarea 
                        rows={4}
                        placeholder="e.g., Find inactive customers from Delhi who spent more than ₹5000"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm input-focus resize-none"
                      />
                    </div>
                    <button 
                      onClick={handleGenerate}
                      disabled={isGenerating || !prompt}
                      className="w-full btn-ai py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isGenerating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Generating...</> : <><Wand2 className="w-4 h-4" /> Generate Rules</>}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button onClick={addRule} className="w-full py-2 bg-secondary border border-border border-dashed rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors">
                      + Add Rule
                    </button>
                  </div>
                )}

                {/* Form fields (always visible if rules exist) */}
                {form.rules.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-border">
                    <div>
                      <label className="block text-sm font-medium mb-1">Segment Name *</label>
                      <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="High Value Inactive" className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <input type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Match Type</label>
                      <select value={form.operator} onChange={e => setForm({...form, operator: e.target.value})} className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm input-focus">
                        <option value="AND">Match ALL rules (AND)</option>
                        <option value="OR">Match ANY rule (OR)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Rules Preview & Customers */}
              <div className="bg-secondary/30 rounded-xl p-5 border border-border flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-sm">Rules ({form.rules.length})</h4>
                  <button onClick={handlePreview} disabled={form.rules.length === 0} className="text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-lg font-bold hover:bg-primary/30 disabled:opacity-50">
                    Preview Customers
                  </button>
                </div>
                
                <div className="space-y-2 mb-6">
                  {form.rules.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                      No rules added yet
                    </div>
                  ) : form.rules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-2 bg-card border border-border rounded-lg p-2 text-sm font-mono relative group">
                      <div className="truncate flex-1">
                        <span className="text-primary">{rule.field}</span> <span className="text-muted-foreground">{rule.operator}</span> <span className="text-accent">{typeof rule.value === 'object' ? JSON.stringify(rule.value) : rule.value}</span>
                      </div>
                      <button onClick={() => removeRule(i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>

                {previewCustomers.length > 0 && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="text-sm font-medium mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Matches {previewCount} customers
                    </div>
                    <div className="flex-1 overflow-y-auto border border-border rounded-lg bg-card text-sm">
                      {previewCustomers.map(c => (
                        <div key={c.id} className="p-2 border-b border-border last:border-0 flex justify-between items-center">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.city || 'No City'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border bg-secondary/30 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm font-medium">Cancel</button>
              <button onClick={handleSave} disabled={form.rules.length === 0} className="px-4 py-2 btn-ai rounded-lg text-sm font-medium disabled:opacity-50">Save Segment</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
