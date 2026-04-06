import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Mic, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import type { ChatMessage } from '@/lib/mock-data';

const suggestions = [
  "What's the status of all active projects?",
  "Generate a project plan for a new feature",
  "Summarize today's tasks and priorities",
  "Create tasks from this meeting summary",
];

const mockResponses: Record<string, string> = {
  default: "I can help you with project management tasks. Try asking about project statuses, task creation, meeting summaries, or project planning!",
  status: `Here's a summary of your active projects:\n\n📊 **Website Redesign** — 68% complete, on track\n📱 **Mobile App v2** — 35% complete, on track\n⚠️ **Data Pipeline** — 22% complete, at risk (deadline approaching)\n⏸️ **Customer Portal** — 45% complete, on hold\n\nThe Data Pipeline project needs attention — would you like me to suggest action items?`,
  plan: `Here's a suggested project plan:\n\n**Phase 1 — Discovery (Week 1-2)**\n- Stakeholder interviews\n- Requirements gathering\n- Technical feasibility study\n\n**Phase 2 — Design (Week 3-4)**\n- Wireframes and prototypes\n- Design review sessions\n- Final UI/UX approval\n\n**Phase 3 — Development (Week 5-8)**\n- Sprint planning\n- Core feature development\n- Integration testing\n\n**Phase 4 — Launch (Week 9-10)**\n- UAT and bug fixes\n- Deployment and monitoring\n\nWould you like me to create tasks for each phase?`,
  tasks: `Based on priorities, here are today's focus areas:\n\n🔴 **Urgent:** Database schema migration (Data Pipeline) — Due Apr 8\n🔴 **Urgent:** Implement auth flow (Website Redesign) — Due Apr 10\n🟡 **High:** Performance optimization (Data Pipeline) — Due Apr 12\n🟡 **High:** Design new homepage layout (Website Redesign) — Due Apr 15\n\n**2 tasks are overdue** — shall I reschedule them?`,
};

const getResponse = (msg: string): string => {
  const lower = msg.toLowerCase();
  if (lower.includes('status') || lower.includes('project')) return mockResponses.status;
  if (lower.includes('plan') || lower.includes('generate')) return mockResponses.plan;
  if (lower.includes('task') || lower.includes('summar') || lower.includes('today')) return mockResponses.tasks;
  return mockResponses.default;
};

const AiChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'assistant', content: "Hi! I'm your AI Project Manager assistant. I can help you manage projects, create tasks, summarize meetings, and provide insights. What would you like to do?", timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: getResponse(text), timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <AppLayout>
      <AppHeader title="AI Assistant" subtitle="Powered by AI — ask anything about your projects." />
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 animate-fade-in ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <Card className={`max-w-[600px] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'glass'}`}>
                <div className="p-3 text-sm leading-relaxed whitespace-pre-line">{msg.content}</div>
              </Card>
              {msg.role === 'user' && (
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3 animate-fade-in">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <Card className="glass">
                <div className="p-3 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </Card>
            </div>
          )}

          {messages.length === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 max-w-2xl">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 text-left text-sm transition-all hover:shadow-md hover:-translate-y-0.5 flex items-start gap-2"
                >
                  <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-background/80 backdrop-blur-xl">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex items-center gap-2 max-w-3xl mx-auto"
          >
            <Button type="button" variant="outline" size="icon" className="shrink-0">
              <Mic className="h-4 w-4" />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the AI assistant..."
              className="flex-1"
              disabled={isTyping}
            />
            <Button type="submit" disabled={!input.trim() || isTyping} className="gradient-primary text-primary-foreground shadow-glow shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
};

export default AiChat;
