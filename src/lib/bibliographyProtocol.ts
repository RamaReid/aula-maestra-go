export interface BibliographyProtocolNode {
  id: string;
  name: string;
  node_type: string;
  parent_id?: string | null;
  order_index?: number | null;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function shouldHideBibliographyNode(name: string): boolean {
  const normalized = normalizeName(name);
  return (
    normalized.startsWith("isbn ") ||
    normalized.startsWith("cdd ") ||
    normalized === "equipo de especialistas" ||
    normalized.startsWith("diseno curricular para") ||
    normalized.startsWith("educacion secundaria") ||
    /^lic\.\s+/.test(normalized)
  );
}

export function isBibliographyHeading(name: string): boolean {
  const normalized = normalizeName(name);
  return (
    normalized.includes("bibliografia") ||
    normalized.includes("bibliografica") ||
    normalized.includes("fuentes bibliograficas")
  );
}

export function isLikelyBibliographyEntry(name: string): boolean {
  if (shouldHideBibliographyNode(name)) return false;

  const normalized = normalizeName(name);
  const commaCount = (name.match(/,/g) || []).length;
  const hasYear = /\b(1[89]\d{2}|20\d{2})\b/.test(name);
  const hasEditionFallback = /\bvarias\s+ediciones\b/i.test(name);
  const hasAuthorPrefix = /^[A-ZÁÉÍÓÚÑ][^,]{1,90},/.test(name.trim());

  if (normalized.includes("dgcye | diseno curricular")) return false;
  if (!hasAuthorPrefix) return false;
  if (commaCount < 3) return false;
  if (!hasYear && !hasEditionFallback && commaCount < 4) return false;

  return true;
}

export function extractBibliographyProtocolNodes<T extends BibliographyProtocolNode>(rawNodes: T[]): T[] {
  const childrenByParent = new Map<string, T[]>();
  rawNodes.forEach((node) => {
    if (!node.parent_id) return;
    const current = childrenByParent.get(node.parent_id) || [];
    current.push(node);
    childrenByParent.set(node.parent_id, current);
  });

  const bibliographyRootIds = rawNodes.filter((node) => isBibliographyHeading(node.name)).map((node) => node.id);
  const bibliographyDescendantIds = new Set<string>();
  const queue = [...bibliographyRootIds];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = childrenByParent.get(parentId) || [];
    children.forEach((child) => {
      bibliographyDescendantIds.add(child.id);
      queue.push(child.id);
    });
  }

  const subtreeBibliography = rawNodes.filter(
    (node) =>
      bibliographyDescendantIds.has(node.id) &&
      node.node_type === "CONTENIDO" &&
      !shouldHideBibliographyNode(node.name)
  );

  const bibliographyCandidates =
    subtreeBibliography.length > 0
      ? subtreeBibliography
      : rawNodes.filter(
          (node) =>
            node.node_type === "CONTENIDO" &&
            isLikelyBibliographyEntry(node.name) &&
            !shouldHideBibliographyNode(node.name)
        );

  const unique = new Map<string, T>();
  bibliographyCandidates.forEach((node) => {
    const key = normalizeName(node.name);
    if (!unique.has(key)) unique.set(key, node);
  });

  return Array.from(unique.values()).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
}
