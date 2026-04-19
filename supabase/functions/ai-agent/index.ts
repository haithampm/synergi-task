import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an autonomous AI project manager. Be direct, actionable, and data-driven.

Core behaviors:
1. Act, do not just suggest.
2. Monitor overdue work, risks, and workload imbalance.
3. Use project management terminology and specific data.
4. End with practical next steps when useful.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const apiKey = Deno.env.get("AI_GATEWAY_API_KEY");
    if (!apiKey) throw new Error("AI_GATEWAY_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    let contextData = "";
    if (userId) {
      const [projectsRes, tasksRes] = await Promise.all([
        supabase.from("projects").select("*").limit(20),
        supabase.from("tasks").select("*").limit(50),
      ]);

      const projects = projectsRes.data || [];
      const tasks = tasksRes.data || [];
      const overdueTasks = tasks.filter((task: any) => task.due_date && new Date(task.due_date) < new Date() && task.status !== "done");
      const atRiskProjects = projects.filter((project: any) => project.status === "at-risk");

      contextData = `Projects: ${projects.length}, active: ${projects.filter((project: any) => project.status === "active").length}, at-risk: ${atRiskProjects.length}
Tasks: ${tasks.length}, in progress: ${tasks.filter((task: any) => task.status === "in-progress").length}, overdue: ${overdueTasks.length}`;
    }

    const enrichedMessages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n${contextData}` },
      ...(messages || []),
    ];

    const response = await fetch("https://ai.gateway.example.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: enrichedMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI agent error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
