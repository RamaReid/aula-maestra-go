import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RequestBody = {
  course_id?: string;
  lesson_id?: string | null;
  query?: string;
  resource_type?: string | null;
  max_results?: number;
};

type ResourceType = "VIDEO" | "ARTICULO" | "DOCUMENTO" | "SITIO" | "DATO" | "OTRO";

type QueryCandidate = {
  title: string;
  url: string;
  domain: string;
  snippet: string | null;
  source_type: string;
  confidence: number;
  fetched_at: string;
};

type WikipediaSearchRow = {
  title?: string;
  pageid?: number;
  snippet?: string;
};

const PREMIUM_QUERY_REQUESTS_TABLE = "premium_query_requests" as never;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function inferResourceType(query: string): ResourceType {
  const normalized = normalizeText(query);
  if (/(video|youtube|canal|clase grabada)/.test(normalized)) return "VIDEO";
  if (/(articulo|paper|nota|publicacion)/.test(normalized)) return "ARTICULO";
  if (/(documento|pdf|guia|manual)/.test(normalized)) return "DOCUMENTO";
  if (/(sitio|pagina|web|url|enlace)/.test(normalized)) return "SITIO";
  if (/(dato|estadistica|cifra|indicador)/.test(normalized)) return "DATO";
  return "OTRO";
}

function normalizeResourceType(value: string | null | undefined, fallbackQuery: string): ResourceType {
  if (!value) return inferResourceType(fallbackQuery);
  const normalized = normalizeText(value);
  if (normalized.includes("video")) return "VIDEO";
  if (normalized.includes("articulo")) return "ARTICULO";
  if (normalized.includes("documento") || normalized.includes("pdf")) return "DOCUMENTO";
  if (normalized.includes("sitio") || normalized.includes("web") || normalized.includes("url")) return "SITIO";
  if (normalized.includes("dato") || normalized.includes("estadistica")) return "DATO";
  return inferResourceType(fallbackQuery);
}

function extractEntityAndTopic(rawQuery: string): { entity: string | null; topic: string | null } {
  const normalized = rawQuery.replace(/\s+/g, " ").trim();
  const entityMatch = normalized.match(
    /\b(?:de|del|de la|de los|de las)\s+([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ .,_-]{3,100}?)(?=\s+(?:sobre|acerca|respecto|para|en)\b|$)/i
  );
  const topicMatch = normalized.match(
    /\b(?:sobre|acerca de|respecto de|en torno a|para)\s+([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ .,_-]{3,140})$/i
  );

  return {
    entity: entityMatch?.[1]?.replace(/\s+/g, " ").trim() || null,
    topic: topicMatch?.[1]?.replace(/\s+/g, " ").trim() || null,
  };
}

function isConcreteQuery(query: string, resourceType: ResourceType, entity: string | null, topic: string | null): string | null {
  const normalized = normalizeText(query);
  const words = normalized.split(" ").filter(Boolean);

  if (words.length < 4) {
    return "La consulta es demasiado corta. Inclui tipo de recurso, referente y contenido puntual.";
  }
  if (resourceType === "OTRO") {
    return "La consulta debe indicar un tipo de recurso concreto (video, articulo, documento, sitio o dato).";
  }
  if (!entity && !topic) {
    return "La consulta debe indicar referente/fuente y contenido puntual.";
  }
  if (/^buscame informacion\b/.test(normalized)) {
    return "No se acepta busqueda abierta. Reformula en modo consulta concreta.";
  }

  return null;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  const distance = levenshtein(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

async function suggestQueryWithTolerance(query: string): Promise<string | null> {
  try {
    const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { "User-Agent": "DocencIA/1.0" } });
    if (!response.ok) return null;
    const data = await response.json();
    const first = Array.isArray(data) ? data[0]?.phrase : null;
    if (!first || typeof first !== "string") return null;

    const score = similarity(query, first);
    if (score >= 0.62 && normalizeText(first) !== normalizeText(query)) {
      return first.trim();
    }
    return null;
  } catch {
    return null;
  }
}

function resolveDuckDuckGoRedirect(url: string): string {
  try {
    const withProtocol = url.startsWith("//") ? `https:${url}` : url;
    const parsed = new URL(withProtocol, "https://duckduckgo.com");
    if (!parsed.hostname.includes("duckduckgo.com")) return withProtocol;
    const uddg = parsed.searchParams.get("uddg");
    if (uddg && isHttpUrl(uddg)) return uddg;
    return withProtocol;
  } catch {
    return url;
  }
}

async function searchWebCandidates(query: string, maxResults: number): Promise<QueryCandidate[]> {
  const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "DocencIA/1.0" },
  });
  if (!response.ok) return [];

  const html = await response.text();
  const linkMatches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const snippetMatches = [...html.matchAll(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)];
  const unique = new Set<string>();
  const candidates: QueryCandidate[] = [];

  for (let i = 0; i < linkMatches.length; i += 1) {
    const href = resolveDuckDuckGoRedirect(linkMatches[i][1] || "");
    if (!isHttpUrl(href)) continue;

    const domain = new URL(href).hostname.replace(/^www\./, "");
    if (domain.includes("duckduckgo.com")) continue;
    if (unique.has(href)) continue;

    unique.add(href);
    const title = decodeHtmlEntities(stripHtml(linkMatches[i][2] || ""));
    const snippet = snippetMatches[i] ? decodeHtmlEntities(stripHtml(snippetMatches[i][1] || "")) : null;
    candidates.push({
      title: title || href,
      url: href,
      domain,
      snippet,
      source_type: "duckduckgo_html",
      confidence: Math.max(0.5, 0.86 - i * 0.08),
      fetched_at: new Date().toISOString(),
    });

    if (candidates.length >= maxResults) break;
  }

  return candidates;
}

async function searchYouTubeCandidates(query: string, maxResults: number): Promise<QueryCandidate[]> {
  const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "DocencIA/1.0" },
  });
  if (!response.ok) return [];

  const html = await response.text();
  const idMatches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
  const ids = Array.from(new Set(idMatches.map((match) => match[1]))).slice(0, maxResults * 2);
  const candidates: QueryCandidate[] = [];

  for (let i = 0; i < ids.length && candidates.length < maxResults; i += 1) {
    const videoId = ids[i];
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    let title = `Video ${videoId}`;
    let snippet: string | null = null;

    try {
      const oembedResponse = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      );
      if (oembedResponse.ok) {
        const oembed = await oembedResponse.json();
        if (typeof oembed?.title === "string" && oembed.title.trim().length > 0) {
          title = oembed.title.trim();
        }
        if (typeof oembed?.author_name === "string" && oembed.author_name.trim().length > 0) {
          snippet = `Canal: ${oembed.author_name.trim()}`;
        }
      }
    } catch {
      // Keep fallback title.
    }

    candidates.push({
      title,
      url,
      domain: "youtube.com",
      snippet,
      source_type: "youtube_search",
      confidence: Math.max(0.58, 0.92 - i * 0.1),
      fetched_at: new Date().toISOString(),
    });
  }

  return candidates;
}

async function searchWikipediaCandidates(query: string, maxResults: number): Promise<QueryCandidate[]> {
  const endpoint =
    `https://es.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=${maxResults}` +
    `&srsearch=${encodeURIComponent(query)}`;

  const response = await fetch(endpoint, { headers: { "User-Agent": "DocencIA/1.0" } });
  if (!response.ok) return [];

  const data = await response.json();
  const rows = data?.query?.search;
  if (!Array.isArray(rows)) return [];

  return (rows as WikipediaSearchRow[]).slice(0, maxResults).map((row, index: number) => ({
    title: typeof row?.title === "string" ? row.title : "Resultado",
    url: typeof row?.pageid === "number" ? `https://es.wikipedia.org/?curid=${row.pageid}` : "https://es.wikipedia.org",
    domain: "wikipedia.org",
    snippet: typeof row?.snippet === "string" ? decodeHtmlEntities(stripHtml(row.snippet)) : null,
    source_type: "wikipedia_api",
    confidence: Math.max(0.42, 0.72 - index * 0.08),
    fetched_at: new Date().toISOString(),
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userError || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const courseId = (body.course_id || "").trim();
  const lessonId = (body.lesson_id || "").trim() || null;
  const rawQuery = (body.query || "").trim();
  const maxResults = Math.max(1, Math.min(3, Number(body.max_results) || 3));

  if (!courseId || !rawQuery) {
    return new Response(JSON.stringify({ error: "course_id y query son obligatorios" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: activeSub } = await adminClient
    .from("subscriptions")
    .select("plan_type")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!activeSub || activeSub.plan_type !== "PREMIUM") {
    return new Response(
      JSON.stringify({ error: "Esta funcion esta disponible solo para plan PREMIUM." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: course, error: courseError } = await userClient
    .from("courses")
    .select("id, subject, year_level, orientation, speciality")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    return new Response(JSON.stringify({ error: "Curso no encontrado o sin permisos" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (lessonId) {
    const { data: lesson } = await userClient
      .from("lessons")
      .select("id")
      .eq("id", lessonId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!lesson) {
      return new Response(JSON.stringify({ error: "La leccion no pertenece al curso seleccionado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const normalizedQuery = normalizeText(rawQuery);
  const inferredType = normalizeResourceType(body.resource_type || null, rawQuery);
  const parsed = extractEntityAndTopic(rawQuery);

  const { data: createdRequest, error: createRequestError } = await userClient
    .from(PREMIUM_QUERY_REQUESTS_TABLE)
    .insert({
      course_id: courseId,
      lesson_id: lessonId,
      created_by: userId,
      raw_query: rawQuery,
      normalized_query: normalizedQuery,
      requested_resource_type: inferredType,
      target_entity: parsed.entity,
      target_topic: parsed.topic,
      context_payload: {
        subject: course.subject,
        year_level: course.year_level,
        orientation: course.orientation,
        speciality: course.speciality,
      },
      status: "PENDING",
    })
    .select("id")
    .single();

  if (createRequestError || !createdRequest?.id) {
    return new Response(JSON.stringify({ error: "No se pudo registrar la consulta premium" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestId = createdRequest.id as string;
  const concretenessError = isConcreteQuery(rawQuery, inferredType, parsed.entity, parsed.topic);
  if (concretenessError) {
    await adminClient
      .from("premium_query_requests")
      .update({ status: "REJECTED", rejection_reason: concretenessError })
      .eq("id", requestId);

    return new Response(
      JSON.stringify({
        error: concretenessError,
        request_id: requestId,
        required_format:
          "Inclui tipo de recurso (video/articulo/documento/sitio/dato), referente/fuente y contenido puntual.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const correctedQuery = await suggestQueryWithTolerance(rawQuery);
  const effectiveQuery = correctedQuery || rawQuery;
  const contextualQuery = `${effectiveQuery} ${course.subject} ${course.year_level} ano`;

  let candidates: QueryCandidate[] = [];
  try {
    if (inferredType === "VIDEO") {
      candidates = await searchYouTubeCandidates(contextualQuery, maxResults);
    } else {
      candidates = await searchWebCandidates(contextualQuery, maxResults);
    }

    if (candidates.length === 0) {
      candidates = await searchWikipediaCandidates(contextualQuery, maxResults);
    }
  } catch {
    candidates = [];
  }

  if (candidates.length === 0) {
    const reason = "No se encontraron resultados trazables para esa consulta concreta.";
    await adminClient
      .from("premium_query_requests")
      .update({ status: "FAILED", rejection_reason: reason, corrected_query: correctedQuery || null })
      .eq("id", requestId);

    return new Response(JSON.stringify({ error: reason, request_id: requestId }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await adminClient
    .from("premium_query_requests")
    .update({
      status: "RESOLVED",
      corrected_query: correctedQuery || null,
      resolved_candidates: candidates,
      rejection_reason: null,
    })
    .eq("id", requestId);

  return new Response(
    JSON.stringify({
      success: true,
      request_id: requestId,
      normalized_query: normalizedQuery,
      corrected_query: correctedQuery,
      resource_type: inferredType,
      candidates,
      needs_teacher_approval: true,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
