import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  CurriculumCycle,
  isAllowedOfficialUrl,
  normalizeText,
  SchoolType,
} from "../_shared/curriculumCommon.ts";

const PRIMARY_OFFICIAL_INDEX_URL =
  "https://abc.gob.ar/secretarias/areas/subsecretaria-de-educacion/educacion-secundaria/educacion-secundaria/disenos-curriculares";
const SECONDARY_OFFICIAL_INDEX_URL =
  "https://servicios.abc.gov.ar/lainstitucion/organismos/consejogeneral/disenioscurriculares/secundaria/";
const OFFICIAL_INDEX_URLS = [PRIMARY_OFFICIAL_INDEX_URL, SECONDARY_OFFICIAL_INDEX_URL];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CurriculumCandidate = {
  id: string;
  subject: string;
  cycle: CurriculumCycle;
  year_level: number;
  official_url: string | null;
  official_title: string | null;
  source_provider: string;
  fetched_at: string | null;
  school_type: SchoolType | null;
  orientation: string | null;
  speciality: string | null;
};

type CandidateWithScore = CurriculumCandidate & {
  display_title: string;
  is_official_domain: boolean;
  score: number;
};

type WebMatch = {
  title: string;
  url: string;
};

type RequestBody = {
  province?: string;
  subject?: string;
  cycle?: CurriculumCycle;
  year_level?: number;
  school_type?: SchoolType | null;
  orientation?: string | null;
  speciality?: string | null;
};

function subjectsMatch(candidateSubject: string, requestedSubject: string): boolean {
  return normalizeText(candidateSubject) === normalizeText(requestedSubject);
}

function yearTokens(yearLevel: number): string[] {
  return [
    `${yearLevel}`,
    `${yearLevel} ano`,
    `${yearLevel}anio`,
    `${yearLevel}°`,
    `${yearLevel}º`,
    `${yearLevel}o`,
    yearLevel === 4 ? "cuarto" : "",
    yearLevel === 5 ? "quinto" : "",
    yearLevel === 6 ? "sexto" : "",
    yearLevel === 1 ? "primero" : "",
    yearLevel === 2 ? "segundo" : "",
    yearLevel === 3 ? "tercero" : "",
  ].filter(Boolean);
}

function scoreCandidate(
  candidate: CurriculumCandidate,
  schoolType: SchoolType | null,
  orientation: string | null,
  speciality: string | null
): number {
  let score = 0;

  if (schoolType && candidate.school_type === schoolType) score += 4;
  else if (!candidate.school_type) score += 1;

  const wantedOrientation = normalizeText(orientation);
  const candidateOrientation = normalizeText(candidate.orientation);
  if (wantedOrientation && candidateOrientation === wantedOrientation) score += 3;
  else if (!candidateOrientation) score += 1;

  const wantedSpeciality = normalizeText(speciality);
  const candidateSpeciality = normalizeText(candidate.speciality);
  if (wantedSpeciality && candidateSpeciality === wantedSpeciality) score += 3;
  else if (!candidateSpeciality) score += 1;

  if (isAllowedOfficialUrl(candidate.official_url)) score += 2;

  return score;
}

function rankCandidates(
  candidates: CurriculumCandidate[],
  schoolType: SchoolType | null,
  orientation: string | null,
  speciality: string | null
): CandidateWithScore[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      display_title: candidate.official_title || candidate.subject,
      is_official_domain: isAllowedOfficialUrl(candidate.official_url),
      score: scoreCandidate(candidate, schoolType, orientation, speciality),
    }))
    .sort((a, b) => b.score - a.score || a.display_title.localeCompare(b.display_title));
}

function extractOfficialLinks(html: string, baseUrl: string): WebMatch[] {
  const regex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const results: WebMatch[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2]
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) continue;

    let url: string;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    if (!isAllowedOfficialUrl(url)) continue;
    results.push({ title: text, url });
  }

  return results;
}

function findWebMatches(html: string, baseUrl: string, subject: string, yearLevel: number): WebMatch[] {
  const normalizedSubject = normalizeText(subject);
  const tokens = normalizedSubject.split(" ").filter((token) => token.length >= 3);
  const yearHints = yearTokens(yearLevel);

  return extractOfficialLinks(html, baseUrl).filter((link) => {
    const text = normalizeText(`${link.title} ${link.url}`);
    const subjectMatch = text.includes(normalizedSubject) || tokens.every((token) => text.includes(token));
    const yearMatch = yearHints.some((hint) => text.includes(hint));
    return subjectMatch && yearMatch;
  });
}

async function fetchOfficialIndexMatches(subject: string, yearLevel: number): Promise<WebMatch[]> {
  let lastError: Error | null = null;

  for (const indexUrl of OFFICIAL_INDEX_URLS) {
    try {
      const response = await fetch(indexUrl);
      if (!response.ok) {
        throw new Error(`No se pudo consultar el indice oficial de ABC (${response.status})`);
      }

      const html = await response.text();
      const directMatches = findWebMatches(html, indexUrl, subject, yearLevel);
      if (directMatches.length > 0) return directMatches;

      const sectionCandidates = extractOfficialLinks(html, indexUrl).filter((link) => {
        const text = normalizeText(`${link.title} ${link.url}`);
        return yearTokens(yearLevel).some((hint) => text.includes(hint));
      });

      for (const section of sectionCandidates.slice(0, 6)) {
        try {
          const sectionResponse = await fetch(section.url);
          if (!sectionResponse.ok) continue;
          const sectionHtml = await sectionResponse.text();
          const nestedMatches = findWebMatches(sectionHtml, section.url, subject, yearLevel);
          if (nestedMatches.length > 0) return nestedMatches;
        } catch {
          // Ignore individual section failures.
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("No se pudo consultar el indice oficial de ABC");
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

async function searchLocalCandidates(
  adminClient: any,
  body: Required<Pick<RequestBody, "province" | "subject" | "cycle" | "year_level">>
): Promise<CurriculumCandidate[]> {
  const baseSelect =
    "id, subject, cycle, year_level, official_url, official_title, source_provider, fetched_at, school_type, orientation, speciality";

  const { data, error } = await adminClient
    .from("curriculum_documents")
    .select(baseSelect)
    .eq("province", body.province)
    .eq("cycle", body.cycle)
    .eq("year_level", body.year_level)
    .eq("status", "VERIFIED");

  if (error) throw new Error(error.message);
  return ((data || []) as CurriculumCandidate[]).filter((candidate) => subjectsMatch(candidate.subject, body.subject));
}

async function findById(
  adminClient: any,
  curriculumDocumentId: string
): Promise<CurriculumCandidate | null> {
  const { data, error } = await adminClient
    .from("curriculum_documents")
    .select(
      "id, subject, cycle, year_level, official_url, official_title, source_provider, fetched_at, school_type, orientation, speciality"
    )
    .eq("id", curriculumDocumentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as CurriculumCandidate | null) || null;
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

  const { data: userData, error: userError } = await userClient.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (userError || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body invalido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.province || !body.subject || !body.cycle || !body.year_level) {
    return new Response(JSON.stringify({ error: "province, subject, cycle y year_level son obligatorios" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const localCandidates = await searchLocalCandidates(adminClient, {
      province: body.province,
      subject: body.subject,
      cycle: body.cycle,
      year_level: body.year_level,
    });

    if (localCandidates.length > 0) {
      const ranked = rankCandidates(
        localCandidates,
        body.school_type ?? null,
        body.orientation ?? null,
        body.speciality ?? null
      );
      const topScore = ranked[0]?.score ?? 0;
      const topCandidates = ranked.filter((candidate) => candidate.score === topScore);

      if (topCandidates.length === 1) {
        return new Response(
          JSON.stringify({
            status: "resolved",
            document: topCandidates[0],
            official_index_url: PRIMARY_OFFICIAL_INDEX_URL,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: "ambiguous",
          candidates: topCandidates,
          official_index_url: PRIMARY_OFFICIAL_INDEX_URL,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webMatches = await fetchOfficialIndexMatches(body.subject, body.year_level);
    if (webMatches.length === 0) {
      return new Response(
        JSON.stringify({
          status: "not_found",
          reason: "No se encontro un programa oficial compatible en la base curricular ni en el indice oficial de ABC.",
          official_index_url: PRIMARY_OFFICIAL_INDEX_URL,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const persistedCandidates: CurriculumCandidate[] = [];
    const ingestionErrors: string[] = [];
    for (const match of webMatches.slice(0, 3)) {
      try {
        const { ingestCurriculumDocument } = await import("../_shared/curriculumImport.ts");
        const ingestion = await ingestCurriculumDocument(adminClient, {
          province: body.province,
          subject: body.subject,
          cycle: body.cycle,
          year_level: body.year_level,
          school_type: body.school_type ?? null,
          orientation: body.orientation ?? null,
          speciality: body.speciality ?? null,
          official_title: match.title,
          official_url: match.url,
        });

        const persisted = await findById(adminClient, ingestion.curriculum_document_id);
        if (persisted) persistedCandidates.push(persisted);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Error desconocido al ingerir documento";
        ingestionErrors.push(`${match.url}: ${reason}`);
      }
    }

    if (persistedCandidates.length === 0) {
      return new Response(
        JSON.stringify({
          status: "not_found",
          reason:
            ingestionErrors.length > 0
              ? `Se encontro un enlace oficial, pero no se pudo ingerir el documento curricular. ${ingestionErrors.join(" | ")}`
              : "Se encontro un enlace oficial, pero no se pudo ingerir el documento curricular.",
          official_index_url: PRIMARY_OFFICIAL_INDEX_URL,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ranked = rankCandidates(
      persistedCandidates,
      body.school_type ?? null,
      body.orientation ?? null,
      body.speciality ?? null
    );
    const topScore = ranked[0]?.score ?? 0;
    const topCandidates = ranked.filter((candidate) => candidate.score === topScore);

    if (topCandidates.length === 1) {
      return new Response(
        JSON.stringify({
          status: "resolved",
          document: topCandidates[0],
          official_index_url: PRIMARY_OFFICIAL_INDEX_URL,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "ambiguous",
        candidates: topCandidates,
        official_index_url: PRIMARY_OFFICIAL_INDEX_URL,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
