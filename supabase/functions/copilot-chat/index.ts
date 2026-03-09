import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Sos un copiloto pedagógico especializado en educación secundaria argentina (provincia de Buenos Aires).
Tu rol es asistir al docente en la preparación de clases. Respondé en español rioplatense, de forma clara, concreta y pedagógicamente fundamentada.

Tenés acceso al contexto completo de la clase que el docente está preparando. Usalo para dar respuestas contextualizadas.

Lineamientos:
- Priorizá respuestas accionables y breves (máximo 300 palabras salvo que te pidan más).
- Citá la bibliografía y los contenidos curriculares del contexto cuando sea pertinente.
- Si te preguntan algo fuera del ámbito pedagógico/curricular, redirigí amablemente.
- Podés sugerir ajustes al enfoque, la dinámica, las observaciones o la profundidad.
- Podés explicar conceptos curriculares, sugerir actividades, proponer formas de evaluar.
- Nunca inventes bibliografía que no esté en el contexto.
- Usá formato markdown para estructurar tus respuestas.`;

function buildContextBlock(ctx: Record<string, unknown>): string {
  const lines: string[] = ["## Contexto de la clase actual\n"];

  if (ctx.subject) lines.push(`**Materia:** ${ctx.subject}`);
  if (ctx.yearLevel) lines.push(`**Año:** ${ctx.yearLevel}°`);
  if (ctx.theme) lines.push(`**Tema:** ${ctx.theme}`);
  if (ctx.learningOutcome) lines.push(`**Resultado esperado:** ${ctx.learningOutcome}`);
  if (ctx.canonOperation) lines.push(`**Operación canon:** ${ctx.canonOperation}`);
  if (ctx.canonEvidence) lines.push(`**Evidencia mínima:** ${ctx.canonEvidence}`);
  if (ctx.depthLevel) lines.push(`**Profundidad:** ${ctx.depthLevel}`);
  if (ctx.briefFocus) lines.push(`**Enfoque docente:** ${ctx.briefFocus}`);
  if (ctx.briefDynamic) lines.push(`**Dinámica sugerida:** ${ctx.briefDynamic}`);
  if (ctx.teachingStatus) lines.push(`**Estado material didáctico:** ${ctx.teachingStatus}`);
  if (ctx.readingStatus) lines.push(`**Estado material de lectura:** ${ctx.readingStatus}`);

  const currNodes = ctx.curriculumNodeNames as string[] | undefined;
  if (currNodes?.length) lines.push(`**Contenidos curriculares:** ${currNodes.join("; ")}`);

  const bibNodes = ctx.bibliographyNames as string[] | undefined;
  if (bibNodes?.length) lines.push(`**Bibliografía confirmada:** ${bibNodes.join("; ")}`);

  const authSources = ctx.authorizedSourceTitles as string[] | undefined;
  if (authSources?.length) lines.push(`**Fuentes del docente:** ${authSources.join("; ")}`);

  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, lessonContext } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Se requiere al menos un mensaje" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const contextBlock = lessonContext ? buildContextBlock(lessonContext) : "";
    const systemContent = contextBlock
      ? `${SYSTEM_PROMPT}\n\n${contextBlock}`
      : SYSTEM_PROMPT;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Esperá un momento e intentá de nuevo." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados. Recargá tu workspace para continuar." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("copilot-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
