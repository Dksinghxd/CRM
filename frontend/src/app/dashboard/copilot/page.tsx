'use client';

import { useState, useRef, useEffect } from 'react';
import { aiApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { getInitials } from '@/lib/utils';
import { Zap, Send, Bot, User as UserIcon, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CopilotPage() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    "Show me my top 5 customers by revenue",
    "Which campaign had the highest conversion rate?",
    "Write a catchy email subject for a summer sale",
    "How many active campaigns do I have right now?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;
    
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await aiApi.chat(newMessages);
      setMessages([...newMessages, { role: 'assistant', content: res.data.response }]);
    } catch (err) {
      toast.error('Failed to get response from Copilot');
      // Remove the user message if the API failed, or add an error message.
      setMessages([...newMessages, { role: 'assistant', content: "I'm sorry, I encountered an error while processing your request. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessage = (content: string) => {
    // Basic markdown formatting
    let formatted = content
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Lists
      .replace(/^- (.*)$/gm, '<li class="ml-4 list-disc">$1</li>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-secondary p-3 rounded-md my-2 overflow-x-auto text-xs font-mono border border-border"><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-secondary px-1.5 py-0.5 rounded text-primary text-xs font-mono">$1</code>')
      // Line breaks
      .replace(/\n/g, '<br/>');

    // Wrap adjacent list items in a ul
    formatted = formatted.replace(/(<li.*<\/li>\s*<br\/>\s*)+/g, (match) => `<ul class="my-2 space-y-1">${match.replace(/<br\/>/g, '')}</ul>`);
    // Cleanup trailing br after ul
    formatted = formatted.replace(/<\/ul><br\/>/g, '</ul>');

    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col sm:flex-row gap-6">
      
      {/* ─── Sidebar (History/Suggestions) ─────────────────────────────────── */}
      <div className="hidden lg:flex w-1/4 flex-col gap-4">
        <div className="bg-gradient-to-br from-[hsl(217_91%_60%)] to-[hsl(256_91%_65%)] rounded-xl p-5 text-white shadow-lg shadow-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
          <Zap className="w-8 h-8 mb-3" />
          <h2 className="text-xl font-bold mb-1">AI Copilot</h2>
          <p className="text-sm opacity-90">Your intelligent CRM assistant. Ask me anything about your data.</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 flex-1 flex flex-col">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> Suggested Prompts
          </h3>
          <div className="space-y-2">
            {suggestedPrompts.map((prompt, i) => (
              <button 
                key={i}
                onClick={() => handleSend(prompt)}
                className="w-full text-left p-3 rounded-lg border border-border bg-secondary/50 hover:bg-secondary hover:border-primary/50 transition-colors text-sm font-medium text-foreground/80"
              >
                "{prompt}"
              </button>
            ))}
          </div>
          
          <div className="mt-auto pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">Powered by GPT-4o-mini</div>
                <div className="text-[10px] text-muted-foreground">Connected to live DB</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Chat Area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden relative shadow-sm">
        
        {/* Chat Header (Mobile only) */}
        <div className="lg:hidden p-4 border-b border-border flex items-center gap-3 bg-secondary/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-bold">AI Copilot</h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">How can I help you today?</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                I'm connected to your entire CRM database. I can analyze campaigns, create segments, find specific customers, or write marketing copy.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:hidden">
                {suggestedPrompts.slice(0, 2).map((prompt, i) => (
                  <button 
                    key={i}
                    onClick={() => handleSend(prompt)}
                    className="p-3 rounded-lg border border-border bg-secondary hover:border-primary/50 transition-colors text-xs font-medium text-left"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                
                {/* Assistant Avatar */}
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                    : 'bg-secondary border border-border rounded-tl-sm'
                }`}>
                  {msg.role === 'assistant' ? formatMessage(msg.content) : msg.content}
                </div>

                {/* User Avatar */}
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0 mt-1 font-bold text-xs">
                    {user ? getInitials(user.name) : <UserIcon className="w-4 h-4" />}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex gap-4 justify-start animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-secondary border border-border rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-card border-t border-border">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="relative flex items-center max-w-4xl mx-auto"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your customers, orders, or campaigns..."
              disabled={isLoading}
              className="w-full pl-5 pr-14 py-4 bg-secondary border border-border rounded-2xl text-sm shadow-inner input-focus disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-center mt-3 text-[10px] text-muted-foreground font-medium">
            AI Copilot can make mistakes. Consider verifying important metrics on the Analytics dashboard.
          </div>
        </div>

      </div>
    </div>
  );
}
