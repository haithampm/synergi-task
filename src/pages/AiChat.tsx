import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Link2, RotateCcw, Send, User, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import AppHeader from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { streamAgentChat } from "@/lib/ai-agent";
import { getAssistantLinkSuggestions, type WorkspaceSearchResult } from "@/lib/workspace-search";
import { toast } from "sonner";

type Msg = {
  role: "user" | "assistant";
  content: string;
  links?: WorkspaceSearchResult[];
};

const suggestions = [
  { icon: "PI", text: "What's the status of all active projects?" },
  { icon: "RK", text: "Analyze risks across all projects and suggest mitigations" },
  { icon: "DC", text: "Find all project charter and BRD documents in the system" },
  { icon: "TS", text: "Search tasks and tickets related to finance or ERP" },
];

const AiChat = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledPromptRef = useRef<string | null>(null);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => undefined);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const attachAssistantLinks = useCallback((query: string) => {
    const links = getAssistantLinkSuggestions(query, 8);
    setMessages((prev) => {
      const next = [...prev];
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (next[index]?.role === "assistant") {
          next[index] = { ...next[index], links };
          break;
        }
      }
      return next;
    });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const trimmed = text.trim();
    const userMsg: Msg = { role: "user", content: trimmed };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((message, index) => (index === prev.length - 1 ? { ...message, content: assistantSoFar } : message));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamAgentChat({
        messages: allMessages.map(({ role, content }) => ({ role, content })),
        onDelta: upsertAssistant,
        onDone: () => {
          attachAssistantLinks(trimmed);
          setIsLoading(false);
        },
        onError: (error) => {
          toast.info(error);
          attachAssistantLinks(trimmed);
          setIsLoading(false);
        },
      });
    } catch {
      toast.error("Failed to connect to the workspace copilot");
      attachAssistantLinks(trimmed);
      setIsLoading(false);
    }
  }, [attachAssistantLinks, isLoading, messages]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (!prompt || handledPromptRef.current === prompt) return;
    handledPromptRef.current = prompt;
    void sendMessageRef.current(prompt);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("prompt");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <AppLayout>
      <div className="flex h-screen flex-col">
        <AppHeader title="AI Agent" subtitle="Workspace copilot for portfolio status, system-wide search, reports, documents, and planning." />

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 pb-20">
              <div className="gradient-primary mb-6 flex h-16 w-16 items-center justify-center rounded-2xl shadow-glow">
                <Zap className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="mb-2 text-2xl font-bold">Synergi Project Copilot</h2>
              <p className="mb-8 max-w-md text-center text-muted-foreground">
                Ask for project status, delivery risks, system-wide search results, document lookups, workload insights, or a recommended execution plan based on the workspace data.
              </p>
              <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.text}
                    onClick={() => void sendMessage(suggestion.text)}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left text-sm transition-all hover:-translate-y-0.5 hover:bg-muted/50 hover:shadow-md"
                  >
                    <span className="min-w-8 rounded-md bg-primary/10 px-2 py-1 text-center text-xs font-bold text-primary">
                      {suggestion.icon}
                    </span>
                    <span className="text-foreground/80 transition-colors group-hover:text-foreground">{suggestion.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-6 p-6">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex gap-3 animate-fade-in ${message.role === "user" ? "justify-end" : ""}`}>
                  {message.role === "assistant" && (
                    <div className="gradient-primary mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`max-w-[88%] space-y-3 ${message.role === "user" ? "rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground" : ""}`}>
                    {message.role === "assistant" ? (
                      <>
                        <div className="prose prose-sm max-w-none text-sm leading-relaxed dark:prose-invert">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                        {message.links?.length ? (
                          <div className="rounded-2xl border border-border/70 bg-card/70 p-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              <Link2 className="h-3.5 w-3.5" />
                              Related Links
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {message.links.map((link) => (
                                <button
                                  key={link.id}
                                  type="button"
                                  onClick={() => navigate(link.path)}
                                  className="rounded-xl border border-border bg-background/80 px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                                >
                                  <p className="text-sm font-medium text-foreground">{link.title}</p>
                                  <p className="text-xs text-muted-foreground">{link.subtitle}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-background/80 p-4 backdrop-blur-xl">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(input);
            }}
            className="mx-auto flex max-w-4xl items-center gap-2"
          >
            {messages.length > 0 ? (
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setMessages([])}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : null}
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Search projects, tasks, tickets, documents, tags, or ask for portfolio guidance..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={!input.trim() || isLoading} className="gradient-primary shrink-0 text-primary-foreground shadow-glow">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            AI responses may contain inaccuracies. Verify important delivery decisions before acting on them.
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default AiChat;
