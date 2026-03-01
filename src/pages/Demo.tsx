import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, briefLabel, briefTone, materialLabel, materialTone } from "@/components/ui/StatusBadge";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

// ─── 100% LOCAL MOCK DATA ───────────────────────────────────────────────────

const DEMO_PLAN = {
  fundamentacion: "Esta planificación aborda los procesos históricos del siglo XIX y XX, enfocándose en las transformaciones sociales, económicas y políticas que configuraron el mundo contemporáneo. Se busca que los estudiantes desarrollen pensamiento crítico y capacidad analítica.",
  estrategias_marco: "Análisis de fuentes primarias y secundarias, debates guiados, trabajo colaborativo en grupo, producción escrita argumentativa.",
  estrategias_practicas: ["Líneas de tiempo", "Debate simulado", "Análisis de documentos", "Mapas conceptuales"],
  evaluacion_marco: "Evaluación continua mediante rúbricas, trabajos prácticos grupales e individuales, evaluación integradora por trimestre.",
};

const DEMO_LESSONS = [
  { id: "1", num: 1, theme: "La Revolución Industrial", brief: "READY_FOR_PRODUCTION" as const, material: "GENERATED" as const, date: "2026-03-15" },
  { id: "2", num: 2, theme: "Imperialismo y colonialismo", brief: "IN_PROGRESS" as const, material: null, date: "2026-03-22" },
  { id: "3", num: 3, theme: "Primera Guerra Mundial", brief: null, material: null, date: "2026-03-29" },
  { id: "4", num: 4, theme: "Revolución Rusa", brief: "PRODUCED" as const, material: "VALIDATED" as const, date: "2026-04-05" },
  { id: "5", num: 5, theme: "Período de entreguerras", brief: "READY_FOR_PRODUCTION" as const, material: "INVALIDATED" as const, date: "2026-04-12" },
  { id: "6", num: 6, theme: "Segunda Guerra Mundial", brief: null, material: null, date: "2026-04-19" },
];

const DEMO_MATERIAL_HTML = `
<h2>La Revolución Industrial</h2>
<p>La Revolución Industrial fue un proceso de transformación económica, social y tecnológica que se inició en la segunda mitad del siglo XVIII en Gran Bretaña y se extendió durante el siglo XIX a gran parte de Europa, América del Norte y eventualmente al resto del mundo.</p>
<h3>Causas principales</h3>
<ul>
<li>Revolución agrícola y aumento de la producción de alimentos</li>
<li>Crecimiento demográfico</li>
<li>Innovaciones tecnológicas: máquina de vapor, telar mecánico</li>
<li>Disponibilidad de capital y materias primas</li>
</ul>
<h3>Consecuencias sociales</h3>
<p>El proceso de industrialización generó profundos cambios en la estructura social: surgimiento de la burguesía industrial, formación de la clase obrera, urbanización acelerada y nuevas condiciones laborales.</p>
`;

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function Demo() {
  const [planValidated, setPlanValidated] = useState(false);

  const handleValidateDemo = () => {
    setPlanValidated(true);
    toast({ title: "Plan validado (demo)", description: "En la app real, esto crearía las lecciones." });
  };

  const handleExportDemo = () => {
    toast({ title: "Exportación (demo)", description: "En la app real, se descargaría el PDF." });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      <div className="sticky top-0 z-50 flex items-center justify-between bg-warning/15 border-b border-warning/30 px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-warning">
          <AlertTriangle className="h-4 w-4" />
          Modo demo — no se guarda nada
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link to="/register">Crear cuenta para guardar</Link>
        </Button>
      </div>

      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Historia · 4° año</h1>
              <p className="text-sm text-muted-foreground">E.E.S. N° 5 · 2026</p>
            </div>
            <StatusBadge tone={planValidated ? "success" : "warning"} label={planValidated ? "Validado" : "Incompleto"} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Tabs defaultValue="planificacion">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="planificacion">Planificación</TabsTrigger>
            <TabsTrigger value="lecciones">Lecciones</TabsTrigger>
            <TabsTrigger value="materiales">Materiales</TabsTrigger>
            <TabsTrigger value="agenda">Agenda</TabsTrigger>
          </TabsList>

          {/* Tab: Planificación */}
          <TabsContent value="planificacion" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fundamentación</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={DEMO_PLAN.fundamentacion} readOnly rows={4} />
                <p className="text-xs text-muted-foreground mt-1">{DEMO_PLAN.fundamentacion.length} caracteres</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estrategias</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm">Marco</Label>
                  <Textarea value={DEMO_PLAN.estrategias_marco} readOnly rows={2} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm">Prácticas</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {DEMO_PLAN.estrategias_practicas.map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evaluación</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={DEMO_PLAN.evaluacion_marco} readOnly rows={3} />
              </CardContent>
            </Card>

            <Button onClick={handleValidateDemo} disabled={planValidated} className="w-full">
              {planValidated ? "✓ Plan validado (demo)" : "Validar plan (demo)"}
            </Button>
          </TabsContent>

          {/* Tab: Lecciones */}
          <TabsContent value="lecciones" className="space-y-3 pt-4">
            {DEMO_LESSONS.map((l) => (
              <Card key={l.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Lección {l.num} — {l.theme}
                    </CardTitle>
                    <div className="flex gap-2">
                      <StatusBadge tone={briefTone(l.brief)} label={briefLabel(l.brief)} />
                      <StatusBadge tone={materialTone(l.material)} label={materialLabel(l.material)} />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </TabsContent>

          {/* Tab: Materiales */}
          <TabsContent value="materiales" className="pt-4 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Material de lectura — Lección 1</CardTitle>
                  <StatusBadge tone="success" label="Generado" />
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: DEMO_MATERIAL_HTML }}
                />
              </CardContent>
            </Card>
            <Button variant="outline" className="w-full" onClick={handleExportDemo}>
              Exportar PDF (demo)
            </Button>
          </TabsContent>

          {/* Tab: Agenda */}
          <TabsContent value="agenda" className="pt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Lección</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tema</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Fecha</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Brief</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEMO_LESSONS.map((l) => (
                        <tr key={l.id} className="border-b last:border-0">
                          <td className="py-2 px-3">{l.num}</td>
                          <td className="py-2 px-3">{l.theme}</td>
                          <td className="py-2 px-3">{l.date}</td>
                          <td className="py-2 px-3">
                            <StatusBadge tone={briefTone(l.brief)} label={briefLabel(l.brief)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
