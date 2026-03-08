import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Download, RotateCcw } from "lucide-react";
import { downloadStructuredPdf } from "@/lib/pdfExport";

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
}: TeachingMaterialViewProps) {
  const activities = Array.isArray(material.activities) ? material.activities : [];
  const differentiation = Array.isArray(material.differentiation) ? material.differentiation : [];
  const exportEnabled = canExportPdf && material.status === "VALIDATED";
  const [exportOrder, setExportOrder] = useState<TeachingSectionKey[]>(DEFAULT_EXPORT_ORDER);

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
      title: "Material Didactico",
      filename: exportFileName,
      sections: exportOrder.map((sectionKey) => sectionContent[sectionKey]),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Material Didactico</h3>
        <div className="flex items-center gap-2">
          {exportEnabled && (
            <Button variant="outline" size="sm" className="text-xs" onClick={handleExportPdf}>
              <Download className="mr-1 h-3 w-3" />
              Exportar PDF
            </Button>
          )}
          <Badge variant={statusVariant(material.status)}>
            {statusLabel[material.status] || material.status}
          </Badge>
        </div>
      </div>

      {exportEnabled && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm text-muted-foreground">Orden del imprimible</CardTitle>
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
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Este orden afecta solo al PDF exportado. No modifica el contenido elaborado.
            </p>
            {exportOrder.map((sectionKey, index) => (
              <div key={sectionKey} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Proposito</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{material.purpose}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Actividades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activities.map((activity, index) => (
            <div key={index} className="rounded border p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">{activity.title}</span>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">{activity.type}</Badge>
                  <Badge variant="outline" className="text-xs">{activity.duration_minutes} min</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{activity.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Producto / evidencia minima</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{material.expected_product}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Criterios de logro</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {material.achievement_criteria.map((criterion, index) => (
              <li key={index}>{criterion}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Diferenciacion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {differentiation.map((item, index) => (
            <div key={index} className="text-sm">
              <Badge variant="outline" className="mr-2">{item.type}</Badge>
              {item.description}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Cierre</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{material.closure}</p>
        </CardContent>
      </Card>
    </div>
  );
}
