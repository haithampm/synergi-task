import { useEffect, useRef, useState } from 'react';
import { Bot, RotateCcw, Send, User, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/components/layout/AppLayout';
import AppHeader from '@/components/layout/AppHeader';
import { streamAgentChat } from '@/lib/ai-agent';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string };

const suggestions = [
  { icon: 'PI', text: "What's the status of all active projects?" },
  { icon: 'RK', text: 'Analyze risks across all projects and suggest mitigations' },
  { icon: 'DC', text: 'Find all project charter and BRD documents in the system' },
  { icon: 'TS', text: 'Search tasks and tickets related to finance or ERP' },
];

const AiChat = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((message, index) => index === prev.length - 1 ? { ...message, content: assistantSoFar } : message);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      await streamAgentChat({
        messages: allMessages,
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
        onError: (error) => {
          toast.info(error);
          setIsLoading(false);
        },
      });
    } catch {
      toast.error('Failed to connect to the workspace copilot');
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-screen">
        <AppHeader title="AI Agent" subtitle="Workspace copilot for portfolio status, system-wide search, reports, documents, and planning." />

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 pb-20">
              <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-6 shadow-glow">
                <Zap className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Synergi Project Copilot</h2>
              <p className="text-muted-foreground text-center max-w-md mb-8">
                Ask for project status, delivery risks, system-wide search results, document lookups, workload insights, or a recommended execution plan based on the workspace data.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.text}
                    onClick={() => sendMessage(suggestion.text)}
                    className="p-4 rounded-xl border border-border bg-card hover:bg-muted/50 text-left text-sm transition-all hover:shadow-md hover:-translate-y-0.5 flex items-start gap-3 group"
                  >
                    <span className="text-xs font-bold rounded-md bg-primary/10 text-primary px-2 py-1 min-w-8 text-center">
                      {suggestion.icon}
                    </span>
                    <span className="text-foreground/80 group-hover:text-foreground transition-colors">{suggestion.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto p-6 space-y-6">
              {messages.map((message, index) => (
                <div key={index} className={`flex gap-3 animate-fade-in ${message.role === 'user' ? 'justify-end' : ''}`}>
                  {message.role === 'assistant' && (
                    <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${message.role === 'user' ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3' : ''}`}>
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-background/80 backdrop-blur-xl">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex items-center gap-2 max-w-3xl mx-auto"
          >
            {messages.length > 0 && (
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setMessages([])}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search projects, tasks, tickets, documents, tags, or ask for portfolio guidance..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={!input.trim() || isLoading} className="gradient-primary text-primary-foreground shadow-glow shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            AI responses may contain inaccuracies. Verify important delivery decisions before acting on them.
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default AiChat;
