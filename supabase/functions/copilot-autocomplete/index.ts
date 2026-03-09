import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Sos un copiloto pedagógico especializado en educación secundaria argentina (provincia de Buenos Aires).
Tu tarea es generar indicaciones docentes concretas para una clase, basándote en el contexto curricular, la bibliografía disponible y el canon de la clase.

Reglas:
- Escribí en español rioplatense, tono profesional docente.
- El enfoque debe ser específico a la clase, no genérico.
- La dinámica debe ser realizable en un módulo de clase (40-80 min).
- Las observaciones deben ser útiles para el motor de IA que genera materiales.
- La profundidad debe reflejar la cantidad de contexto disponible.
- No inventes bibliografía que no esté en el contexto.`;

function buildPrompt(ctx: Record<string, unknown>): string {
  const lines: string[] = ["Generá las indicaciones docentes para esta clase:\n"];

  if (ctx.subject) lines.push(`Materia: ${ctx.subject}`);
  if (ctx.yearLevel) lines.push(`Año: ${ctx.yearLevel}°`);
  if (ctx.theme) lines.push(`Tema: ${ctx.theme}`);
  if (ctx.learningOutcome) lines.push(`Resultado esperado: ${ctx.learningOutcome}`);
  if (ctx.canonOperation) lines.push(`Operación canon: ${ctx.canonOperation}`);
  if (ctx.canonEvidence) lines.push(`Evidencia mínima: ${ctx.canonEvidence}`);

  const currNodes = ctx.curriculumNodeNames as string[] | undefined;
  if (currNodes?.length) lines.push(`Contenidos curriculares: ${currNodes.join("; ")}`);

  const bibNodes = ctx.bibliographyNames as string[] | undefined;
  if (bibNodes?.length) lines.push(`Bibliografía confirmada: ${bibNodes.join("; ")}`);

  const authSources = ctx.authorizedSourceTitles as string[] | undefined;
  if (authSources?.length) lines.push(`Fuentes del docente: ${authSources.join("; ")}`);

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

    const { lessonContext } = await req.json();
    if (!lessonContext) {
      return new Response(JSON.stringify({ error: "Se requiere lessonContext" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = buildPrompt(lessonContext);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "set_brief_fields",
              description: "Establece los campos del relevamiento docente para una clase.",
              parameters: {
                type: "object",
                properties: {
                  enfoque: {
                    type: "string",
                    description: "Enfoque deseado para la clase. 2-4 oraciones concretas.",
                  },
                  dinamica: {
                    type: "string",
                    description: "Tipo de dinámica de trabajo sugerida. 2-3 oraciones describiendo la secuencia.",
                  },
                  profundidad: {
                    type: "string",
                    enum: ["BAJO", "MEDIO", "ALTO"],
                    description: "Nivel de profundidad basado en el contexto disponible.",
                  },
                  observaciones: {
                    type: "string",
                    description: "Observaciones docentes para el motor IA. 2-4 oraciones con indicaciones concretas.",
                  },
                },
                required: ["enfoque", "dinamica", "profundidad", "observaciones"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_brief_fields" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Esperá un momento." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
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

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "La IA no devolvió un resultado estructurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("copilot-autocomplete error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
