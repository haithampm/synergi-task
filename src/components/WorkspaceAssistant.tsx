import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Compass, Link2, MessageSquareText, Search, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { streamAgentChat } from "@/lib/ai-agent";
import {
  getNavigationAssistantCommonActions,
  getNavigationAssistantContext,
  getNavigationAssistantPrompts,
} from "@/lib/navigation-assistant";
import { getAssistantLinkSuggestions, getWorkspaceSearchResults, type WorkspaceSearchResult } from "@/lib/workspace-search";
import { toast } from "sonner";

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  links?: WorkspaceSearchResult[];
};

interface WorkspaceAssistantProps {
  isArabic?: boolean;
}

const WorkspaceAssistant = ({ isArabic = false }: WorkspaceAssistantProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const context = getNavigationAssistantContext(location.pathname);
  const promptSuggestions = getNavigationAssistantPrompts(location.pathname);
  const searchResults = useMemo(
    () => (navQuery.trim() ? getWorkspaceSearchResults(navQuery).slice(0, 10) : []),
    [navQuery],
  );

  const openPath = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const attachLinks = useCallback((query: string) => {
    const links = getAssistantLinkSuggestions(query, 6);
    setChatMessages((prev) => {
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

  const buildAssistantSystemContext = useCallback(
    (question: string) =>
      [
        "You are the in-app workspace assistant for the Synergi project management application.",
        `Current screen path: ${location.pathname}`,
        `Current screen title: ${context.title}`,
        `Current screen guidance: ${context.description}`,
        `Current screen actions: ${context.actions.map((action) => `${action.label} -> ${action.path}`).join(" | ")}`,
        "Respond like a live application assistant that understands the workspace data and navigation.",
        "When useful, mention the screens, records, or next actions the user should open.",
        `User question: ${question}`,
      ].join("\n"),
    [context, location.pathname],
  );

  useEffect(() => {
    if (!open) return;

    setChatMessages((prev) => {
      const introMessage: AssistantMessage = {
        role: "assistant",
        content: [
          `You are in **${context.title}**.`,
          context.description,
          "",
          "Ask me about this screen, project data, tasks, tickets, schedules, documents, or where to navigate next.",
        ].join("\n"),
        links: context.actions.map((action) => ({
          id: action.id,
          title: action.label,
          subtitle: action.description,
          section: "Assistant",
          path: action.path,
          keywords: [action.label, action.description],
        })),
      };

      if (!prev.length) {
        return [introMessage];
      }

      const [first, ...rest] = prev;
      if (first?.role === "assistant" && first.content.includes("You are in **")) {
        return [introMessage, ...rest];
      }

      return [introMessage, ...prev];
    });
  }, [context, open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const trimmed = text.trim();
    const userMessage: AssistantMessage = { role: "user", content: trimmed };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((message, index) => (index === prev.length - 1 ? { ...message, content: assistantSoFar } : message));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamAgentChat({
        messages: [
          { role: "user", content: buildAssistantSystemContext(trimmed) },
          ...nextMessages.map(({ role, content }) => ({ role, content })),
        ],
        onDelta: upsertAssistant,
        onDone: () => {
          attachLinks(trimmed);
          setIsLoading(false);
        },
        onError: (error) => {
          toast.info(error);
          attachLinks(trimmed);
          setIsLoading(false);
        },
      });
    } catch {
      toast.error("Failed to connect to the workspace copilot");
      attachLinks(trimmed);
      setIsLoading(false);
    }
  }, [attachLinks, buildAssistantSystemContext, chatMessages, isLoading]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
        >
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">Assistant</span>
        </Button>
      </SheetTrigger>
      <SheetContent side={isArabic ? "left" : "right"} className="w-full border-l bg-background/95 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Workspace Assistant
          </SheetTitle>
          <SheetDescription>
            Navigate any screen, open related records, or ask questions about live project and portfolio data.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="ask" className="flex h-full flex-col">
          <div className="border-b px-6 py-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="navigate" className="gap-2">
                <Compass className="h-4 w-4" />
                Navigate
              </TabsTrigger>
              <TabsTrigger value="ask" className="gap-2">
                <MessageSquareText className="h-4 w-4" />
                System Chat
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="navigate" className="mt-0 flex min-h-0 flex-1 flex-col px-6 pb-6">
            <div className="space-y-4 py-4">
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Current Screen</p>
                <h3 className="mt-2 text-lg font-semibold">{context.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{context.description}</p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={navQuery}
                  onChange={(event) => setNavQuery(event.target.value)}
                  placeholder="Search screens, projects, tasks, documents, or chat channels..."
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 pr-2">
              {navQuery.trim() ? (
                <div className="space-y-2 pb-4">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => openPath(result.path)}
                      className="w-full rounded-2xl border border-border bg-card/70 px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                    >
                      <p className="text-sm font-semibold text-foreground">{result.title}</p>
                      <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-5 pb-4">
                  <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Screen Actions</p>
                    <div className="grid gap-2">
                      {context.actions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => openPath(action.path)}
                          className="w-full rounded-2xl border border-border bg-card/70 px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                        >
                          <p className="text-sm font-semibold">{action.label}</p>
                          <p className="text-xs text-muted-foreground">{action.description}</p>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Common Shortcuts</p>
                    <div className="grid gap-2">
                      {getNavigationAssistantCommonActions().map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => openPath(action.path)}
                          className="w-full rounded-2xl border border-border bg-card/70 px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                        >
                          <p className="text-sm font-semibold">{action.label}</p>
                          <p className="text-xs text-muted-foreground">{action.description}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ask" className="mt-0 flex min-h-0 flex-1 flex-col px-6 pb-6">
            <div className="space-y-3 py-4">
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <p className="text-sm font-medium">Ask about this screen or the full workspace.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chat with the live system assistant about projects, tasks, tickets, schedules, documents, meetings, channels, and the right next screen to open.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {promptSuggestions.map((prompt) => (
                  <Button key={prompt} type="button" variant="outline" size="sm" onClick={() => void sendMessage(prompt)}>
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-border bg-muted/10 px-3">
              <div className="space-y-4 py-4">
                {chatMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
                    Start with a question like “show me the most at-risk project and open links,” or “find all PMI sign-off documents.”
                  </div>
                ) : (
                  chatMessages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`space-y-2 ${message.role === "user" ? "text-right" : ""}`}>
                      <div className={`inline-block max-w-[92%] rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}>
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p>{message.content}</p>
                        )}
                      </div>
                      {message.role === "assistant" && message.links?.length ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {message.links.map((link) => (
                            <button
                              key={link.id}
                              type="button"
                              onClick={() => openPath(link.path)}
                              className="rounded-xl border border-border bg-background/80 px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                            >
                              <div className="flex items-start gap-2">
                                <Link2 className="mt-0.5 h-3.5 w-3.5 text-primary" />
                                <div>
                                  <p className="text-sm font-medium">{link.title}</p>
                                  <p className="text-xs text-muted-foreground">{link.subtitle}</p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(chatInput);
              }}
              className="mt-4 flex items-center gap-2"
            >
              <Input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Chat with the system about projects, links, risks, tasks, or any record..."
                disabled={isLoading}
              />
              <Button type="submit" disabled={!chatInput.trim() || isLoading} className="gradient-primary text-primary-foreground">
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <Button type="button" variant="ghost" className="mt-2 justify-start" onClick={() => openPath("/ai-chat")}>
              Open full AI workspace
            </Button>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default WorkspaceAssistant;
