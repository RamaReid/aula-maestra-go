import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default function TeachingMaterialView({ material }: TeachingMaterialViewProps) {
  const activities = Array.isArray(material.activities) ? material.activities : [];
  const differentiation = Array.isArray(material.differentiation) ? material.differentiation : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Material Didáctico</h3>
        <Badge variant={statusVariant(material.status)}>
          {statusLabel[material.status] || material.status}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Propósito</CardTitle>
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
          {activities.map((act, i) => (
            <div key={i} className="rounded border p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{act.title}</span>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">{act.type}</Badge>
                  <Badge variant="outline" className="text-xs">{act.duration_minutes} min</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{act.description}</p>
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
          <CardTitle className="text-sm text-muted-foreground">Criterios de Logro</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside text-sm space-y-1">
            {material.achievement_criteria.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Diferenciación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {differentiation.map((d, i) => (
            <div key={i} className="text-sm">
              <Badge variant="outline" className="mr-2">{d.type}</Badge>
              {d.description}
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
