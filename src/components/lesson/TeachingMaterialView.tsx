import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
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

  const handleExportPdf = () => {
    downloadStructuredPdf({
      title: "Material Didactico",
      filename: exportFileName,
      sections: [
        { title: "Proposito", body: [material.purpose] },
        {
          title: "Actividades",
          body: activities.map(
            (activity) =>
              `${activity.title} (${activity.type}, ${activity.duration_minutes} min). ${activity.description}`
          ),
        },
        { title: "Producto esperado", body: [material.expected_product] },
        { title: "Criterios de logro", body: material.achievement_criteria || [] },
        {
          title: "Diferenciacion",
          body: differentiation.map((item) => `${item.type}: ${item.description}`),
        },
        { title: "Cierre", body: [material.closure] },
      ],
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
