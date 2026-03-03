export const OFFICIAL_ALLOWED_HOSTS = new Set(["abc.gob.ar", "servicios.abc.gov.ar"]);

export type SchoolType = "COMUN" | "TECNICA";
export type CurriculumCycle = "BASIC" | "UPPER";
export type CurriculumNodeType = "EJE" | "UNIDAD" | "BLOQUE" | "CONTENIDO";

export function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isAllowedOfficialUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OFFICIAL_ALLOWED_HOSTS.has(host);
  } catch {
    return false;
  }
}
