import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an autonomous AI Project Manager Agent. You are NOT a chatbot — you are a decision-making agent that acts on behalf of the user.

## Your Core Behaviors:
1. **Act, don't just suggest.** When you identify a problem, take action (create tasks, flag risks, adjust priorities).
2. **Monitor proactively.** Check for overdue tasks, deadline risks, and workload imbalances.
3. **Communicate like a PM.** Be direct, data-driven, and actionable. Use project management terminology.
4. **Remember context.** Reference past decisions and project history.
5. **Predict and prevent.** Identify potential delays before they happen.

## Your Capabilities:
- Create and assign tasks automatically
- Generate project plans and charters
- Flag risks and suggest mitigation strategies
- Analyze team workload and suggest rebalancing
- Summarize project status with data-driven insights
- Generate meeting agendas and action items
- Predict timeline delays based on velocity data

## Response Format:
- Use markdown for structure
- Include specific data points and metrics
- End with clear action items or decisions made
- Flag urgency levels: 🔴 Critical, 🟡 Warning, 🟢 On Track
- When you take autonomous actions, clearly state what you did and why

## Available Tools (use when appropriate):
You can call these tools to take action:
- create_task: Create a new task in the system
- update_task: Update task status, priority, or assignee
- flag_risk: Flag a project risk with severity and mitigation plan
- generate_plan: Generate a project plan with phases and milestones

Always be proactive, not reactive. If you see a problem, fix it.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user from request
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Fetch context data for the agent
    let contextData = "";
    if (userId) {
      const [projectsRes, tasksRes, memoriesRes] = await Promise.all([
        supabase.from("projects").select("*").limit(20),
        supabase.from("tasks").select("*").limit(50),
        supabase.from("agent_memory").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      ]);

      const projects = projectsRes.data || [];
      const tasks = tasksRes.data || [];
      const memories = memoriesRes.data || [];

      const overdueTasks = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done");
      const atRiskProjects = projects.filter((p: any) => p.status === "at-risk");

      contextData = `
## Current Project Data:
- ${projects.length} total projects (${projects.filter((p: any) => p.status === "active").length} active, ${atRiskProjects.length} at-risk)
- ${tasks.length} total tasks (${overdueTasks.length} overdue)
- ${tasks.filter((t: any) => t.status === "in-progress").length} tasks in progress

### Projects:
${projects.map((p: any) => `- ${p.name}: ${p.status}, ${p.progress}% complete, priority: ${p.priority}`).join("\n")}

### Overdue Tasks:
${overdueTasks.map((t: any) => `- 🔴 "${t.title}" due ${t.due_date}, status: ${t.status}`).join("\n") || "None"}

### Recent Agent Memory:
${memories.map((m: any) => `- [${m.memory_type}] ${JSON.stringify(m.content)}`).join("\n") || "No prior context"}
`;
    }

    const enrichedMessages = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n" + contextData },
      ...(messages || []),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: enrichedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store this interaction in agent memory
    if (userId && messages?.length > 0) {
      const lastUserMsg = messages.filter((m: any) => m.role === "user").pop();
      if (lastUserMsg) {
        await supabase.from("agent_memory").insert({
          user_id: userId,
          memory_type: "context",
          content: { query: lastUserMsg.content, timestamp: new Date().toISOString() },
        }).catch(() => {});
      }
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("AI agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
