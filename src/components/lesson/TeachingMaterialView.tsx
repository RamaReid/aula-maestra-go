import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, Download, Pencil, RotateCcw, Save } from "lucide-react";
import { DocumentSheet } from "@/components/editorial/DocumentSheet";
import { formatDocumentDate, type DocumentMetaItem } from "@/lib/editorial";
import { downloadStructuredPdf } from "@/lib/pdfExport";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Activity {
  title: string;
  description: string;
  duration_minutes: number;
  type: string;
}

interface Differentiation {
  type: string;
  description: string;
}

interface TeachingMaterialViewProps {
  material: {
    id?: string;
    purpose: string;
    activities: Activity[];
    expected_product: string;
    achievement_criteria: string[];
    differentiation: Differentiation[];
    closure: string;
    status: string;
  };
  canExportPdf?: boolean;
  exportFileName?: string;
  documentTitle?: string;
  documentSummary?: string;
  documentMeta?: DocumentMetaItem[];
  generatedAt?: string | null;
  onUpdated?: () => void;
}

type TeachingSectionKey =
  | "purpose"
  | "activities"
  | "expected_product"
  | "achievement_criteria"
  | "differentiation"
  | "closure";

const DEFAULT_EXPORT_ORDER: TeachingSectionKey[] = [
  "purpose",
  "activities",
  "expected_product",
  "achievement_criteria",
  "differentiation",
  "closure",
];

const EXPORT_SECTION_LABELS: Record<TeachingSectionKey, string> = {
  purpose: "Proposito",
  activities: "Actividades",
  expected_product: "Producto esperado",
  achievement_criteria: "Criterios de logro",
  differentiation: "Diferenciacion",
  closure: "Cierre",
};

const statusLabel: Record<string, string> = {
  GENERATED: "Generado",
  VALIDATED: "Validado",
  INVALIDATED: "Invalidado",
  EDITED: "Editado",
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" => {
  if (s === "VALIDATED") return "default";
  if (s === "INVALIDATED") return "destructive";
  return "secondary";
};

export default function TeachingMaterialView({
  material,
  canExportPdf = false,
  exportFileName = "material-didactico.pdf",
  documentTitle = "Material didactico",
  documentSummary = "Guia de trabajo organizada para aula real, con secciones claras, evidencias visibles y orden de lectura profesional.",
  documentMeta = [],
  generatedAt,
  onUpdated,
}: TeachingMaterialViewProps) {
  const activities = Array.isArray(material.activities) ? material.activities : [];
  const differentiation = Array.isArray(material.differentiation) ? material.differentiation : [];
  const exportEnabled = canExportPdf && (material.status === "VALIDATED" || material.status === "EDITED");
  const [exportOrder, setExportOrder] = useState<TeachingSectionKey[]>(DEFAULT_EXPORT_ORDER);

  const [editing, setEditing] = useState(false);
  const [editPurpose, setEditPurpose] = useState(material.purpose);
  const [editProduct, setEditProduct] = useState(material.expected_product);
  const [editClosure, setEditClosure] = useState(material.closure);
  const [editCriteria, setEditCriteria] = useState(material.achievement_criteria.join("\n"));
  const [savingEdit, setSavingEdit] = useState(false);

  const startEditing = () => {
    setEditPurpose(material.purpose);
    setEditProduct(material.expected_product);
    setEditClosure(material.closure);
    setEditCriteria(material.achievement_criteria.join("\n"));
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!material.id) {
      toast({ title: "No se puede guardar sin ID de material", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      const criteriaArray = editCriteria.split("\n").map((c) => c.trim()).filter(Boolean);
      const { error } = await supabase
        .from("teaching_materials")
        .update({
          purpose: editPurpose,
          expected_product: editProduct,
          closure: editClosure,
          achievement_criteria: criteriaArray,
          status: "EDITED" as any,
        })
        .eq("id", material.id);
      if (error) throw error;
      toast({ title: "Material didáctico actualizado" });
      setEditing(false);
      onUpdated?.();
    } catch {
      toast({ title: "Error al guardar cambios", variant: "destructive" });
    }
    setSavingEdit(false);
  };

  const moveSection = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= exportOrder.length) return;
    const next = [...exportOrder];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setExportOrder(next);
  };

  const handleExportPdf = () => {
    const sectionContent: Record<TeachingSectionKey, { title: string; body: string[] }> = {
      purpose: { title: "Proposito", body: [material.purpose] },
      activities: {
        title: "Actividades",
        body: activities.map(
          (activity) =>
            `${activity.title} (${activity.type}, ${activity.duration_minutes} min). ${activity.description}`
        ),
      },
      expected_product: { title: "Producto esperado", body: [material.expected_product] },
      achievement_criteria: { title: "Criterios de logro", body: material.achievement_criteria || [] },
      differentiation: {
        title: "Diferenciacion",
        body: differentiation.map((item) => `${item.type}: ${item.description}`),
      },
      closure: { title: "Cierre", body: [material.closure] },
    };

    downloadStructuredPdf({
      title: documentTitle,
      subtitle: documentSummary,
      filename: exportFileName,
      generatedAt: formatDocumentDate(generatedAt),
      meta: [
        ...documentMeta,
        { label: "Estado", value: statusLabel[material.status] || material.status },
      ]
        .filter((item) => item.value)
        .map((item) => ({ label: item.label, value: String(item.value) })),
      sections: exportOrder.map((sectionKey) => sectionContent[sectionKey]),
    });
  };

  const canEdit = !!material.id && (material.status === "GENERATED" || material.status === "VALIDATED" || material.status === "EDITED");

  return (
    <DocumentSheet
      eyebrow="Didactico"
      title={documentTitle}
      summary={documentSummary}
      status={<Badge variant={statusVariant(material.status)}>{statusLabel[material.status] || material.status}</Badge>}
      actions={
        <div className="flex gap-2">
          {canEdit && !editing && (
            <Button variant="outline" size="sm" className="text-xs" onClick={startEditing}>
              <Pencil className="mr-1 h-3 w-3" />
              Editar
            </Button>
          )}
          {editing && (
            <Button variant="default" size="sm" className="text-xs" onClick={handleSaveEdit} disabled={savingEdit}>
              <Save className="mr-1 h-3 w-3" />
              {savingEdit ? "Guardando..." : "Guardar cambios"}
            </Button>
          )}
          {editing && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEditing(false)} disabled={savingEdit}>
              Cancelar
            </Button>
          )}
          {exportEnabled && !editing ? (
            <Button variant="outline" size="sm" className="text-xs" onClick={handleExportPdf}>
              <Download className="mr-1 h-3 w-3" />
              Exportar PDF
            </Button>
          ) : null}
        </div>
      }
      meta={[
        ...documentMeta,
        { label: "Fecha", value: formatDocumentDate(generatedAt) },
        { label: "Actividades", value: activities.length || null },
      ]}
    >
      {exportEnabled && !editing && (
        <section className="document-section">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="document-section-label">Imprimible</p>
              <h4 className="document-section-heading mb-1 text-lg">Orden del documento exportado</h4>
              <p className="field-help">
                Este orden afecta solo al PDF exportado. No modifica el contenido elaborado.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setExportOrder(DEFAULT_EXPORT_ORDER)}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Restablecer
            </Button>
          </div>
          <div className="space-y-2">
            {exportOrder.map((sectionKey, index) => (
              <div key={sectionKey} className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
                <span>
                  {index + 1}. {EXPORT_SECTION_LABELS[sectionKey]}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveSection(index, -1)}
                    disabled={index === 0}
                    aria-label={`Subir ${EXPORT_SECTION_LABELS[sectionKey]}`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveSection(index, 1)}
                    disabled={index === exportOrder.length - 1}
                    aria-label={`Bajar ${EXPORT_SECTION_LABELS[sectionKey]}`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="document-section">
        <p className="document-section-label">Apertura</p>
        <h4 className="document-section-heading">Proposito</h4>
        {editing ? (
          <Textarea value={editPurpose} onChange={(e) => setEditPurpose(e.target.value)} className="min-h-[80px]" />
        ) : (
          <p className="document-copy">{material.purpose}</p>
        )}
      </section>

      <section className="document-section">
        <p className="document-section-label">Desarrollo</p>
        <h4 className="document-section-heading">Actividades</h4>
        <div className="space-y-3">
          {activities.map((activity, index) => (
            <article key={index} className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-base font-semibold tracking-tight text-foreground">{activity.title}</h5>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">{activity.type}</Badge>
                  <Badge variant="outline" className="text-xs">{activity.duration_minutes} min</Badge>
                </div>
              </div>
              <p className="document-copy text-sm">{activity.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="document-section">
        <p className="document-section-label">Cierre verificable</p>
        <h4 className="document-section-heading">Producto o evidencia minima</h4>
        {editing ? (
          <Textarea value={editProduct} onChange={(e) => setEditProduct(e.target.value)} className="min-h-[60px]" />
        ) : (
          <p className="document-copy">{material.expected_product}</p>
        )}
      </section>

      <section className="document-section">
        <p className="document-section-label">Seguimiento</p>
        <h4 className="document-section-heading">Criterios de logro</h4>
        {editing ? (
          <Textarea
            value={editCriteria}
            onChange={(e) => setEditCriteria(e.target.value)}
            placeholder="Un criterio por línea"
            className="min-h-[100px]"
          />
        ) : (
          <ul className="document-list">
            {material.achievement_criteria.map((criterion, index) => (
              <li key={index}>{criterion}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="document-section">
        <p className="document-section-label">Adaptaciones</p>
        <h4 className="document-section-heading">Diferenciacion</h4>
        <div className="space-y-3">
          {differentiation.map((item, index) => (
            <div key={index} className="rounded-2xl border border-border/70 bg-background/75 px-4 py-3 text-sm leading-7 text-foreground">
              <Badge variant="outline" className="mr-2">{item.type}</Badge>
              {item.description}
            </div>
          ))}
        </div>
      </section>

      <section className="document-section">
        <p className="document-section-label">Cierre</p>
        <h4 className="document-section-heading">Cierre de la clase</h4>
        {editing ? (
          <Textarea value={editClosure} onChange={(e) => setEditClosure(e.target.value)} className="min-h-[80px]" />
        ) : (
          <p className="document-copy">{material.closure}</p>
        )}
      </section>
    </DocumentSheet>
  );
}
