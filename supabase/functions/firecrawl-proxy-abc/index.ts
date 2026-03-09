import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Proxy function to fetch PDFs from abc.gob.ar using Firecrawl.
 * This bypasses SSL/TLS handshake issues between Deno and abc.gob.ar servers.
 * 
 * Input: { url: string } - URL from abc.gob.ar domain
 * Output: { success: boolean, base64?: string, error?: string }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    console.error("FIRECRAWL_API_KEY not configured");
    return new Response(
      JSON.stringify({ success: false, error: "Firecrawl no está configurado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Body inválido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { url } = body;

  if (!url) {
    return new Response(
      JSON.stringify({ success: false, error: "URL es requerida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate that the URL is from abc.gob.ar
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.toLowerCase() !== "abc.gob.ar") {
      return new Response(
        JSON.stringify({ success: false, error: "Solo se permiten URLs de abc.gob.ar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "URL inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`Fetching via Firecrawl: ${url}`);

  try {
    // Use Firecrawl scrape endpoint with rawHtml to get the binary content
    const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["rawHtml"],
        waitFor: 3000, // Wait for any redirects
      }),
    });

    const firecrawlData = await firecrawlResponse.json();

    if (!firecrawlResponse.ok) {
      console.error("Firecrawl API error:", firecrawlData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: firecrawlData.error || `Firecrawl error: ${firecrawlResponse.status}` 
        }),
        { status: firecrawlResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract raw HTML content (which for PDFs should be binary data)
    const rawHtml = firecrawlData.data?.rawHtml || firecrawlData.rawHtml;
    
    if (!rawHtml) {
      console.error("No content received from Firecrawl");
      return new Response(
        JSON.stringify({ success: false, error: "No se recibió contenido del PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For PDF files, Firecrawl should return the raw binary
    // We need to convert to base64 for transport
    // Check if it's already base64 or needs encoding
    let base64Content: string;
    
    // If rawHtml contains PDF header (%PDF), it's binary data
    if (rawHtml.startsWith("%PDF") || rawHtml.includes("%PDF")) {
      // Convert binary string to base64
      const encoder = new TextEncoder();
      const bytes = encoder.encode(rawHtml);
      base64Content = btoa(String.fromCharCode(...bytes));
    } else {
      // Might already be base64 or HTML (error page)
      // Check if it looks like HTML
      if (rawHtml.includes("<!DOCTYPE") || rawHtml.includes("<html")) {
        console.error("Received HTML instead of PDF - possibly an error page");
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "El servidor de ABC devolvió una página HTML en lugar del PDF" 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      base64Content = rawHtml;
    }

    console.log(`Successfully fetched content, length: ${base64Content.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        base64: base64Content,
        source_url: url
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error fetching via Firecrawl:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Error desconocido" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
