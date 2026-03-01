import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BookOpen, Target, Clock } from "lucide-react";

export default function Landing() {
  const { user, loading } = useAuth();

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold text-foreground">Planificador Docente</span>
          <Button variant="outline" size="sm" asChild>
            <Link to="/login">Ingresar</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Planificá tus clases con inteligencia
            </h1>
            <p className="text-lg text-muted-foreground">
              Creá planificaciones anuales, generá materiales didácticos y de lectura, y organizá tu agenda escolar en un solo lugar.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/demo">Probar demo</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/register">Crear cuenta gratis</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              <Link to="/login" className="underline underline-offset-4 hover:text-foreground">
                Ya tengo cuenta
              </Link>
            </p>
          </div>

          {/* Static preview card */}
          <Card className="hidden md:block">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Historia · 4° año</CardTitle>
                <StatusBadge tone="success" label="Validado" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                <span>Lección 1 — La Revolución Industrial</span>
                <StatusBadge tone="success" label="Listo" />
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                <span>Lección 2 — Imperialismo</span>
                <StatusBadge tone="warning" label="En progreso" />
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                <span>Lección 3 — Primera Guerra Mundial</span>
                <StatusBadge tone="neutral" label="Borrador" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t bg-muted/50">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-12 text-foreground">Todo lo que necesitás</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: BookOpen, title: "Planificación anual", desc: "Fundamentación, estrategias, evaluación y propósitos en un solo plan." },
              { icon: Target, title: "Materiales con IA", desc: "Generá material didáctico y de lectura alineados a tu planificación." },
              { icon: Clock, title: "Agenda integrada", desc: "Organizá fechas, reprogramá lecciones y llevá el control del año." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center space-y-3">
                <div className="rounded-full bg-primary/10 p-3">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-12 text-foreground">Cómo funciona</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Creá un curso", desc: "Elegí materia, año, escuela y ciclo lectivo." },
              { step: "2", title: "Completá el plan", desc: "Fundamentación, estrategias, evaluación y propósitos. Validá cuando esté listo." },
              { step: "3", title: "Generá materiales", desc: "Completá el brief de cada lección y generá materiales con un clic." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {step}
                </div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t bg-muted/50">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-8 text-foreground">Preguntas frecuentes</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger>¿Es gratis?</AccordionTrigger>
              <AccordionContent>
                Sí, el plan gratuito te permite crear cursos y generar materiales con un límite semanal. Podés actualizar a un plan pago para más funciones.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger>¿Qué materias soporta?</AccordionTrigger>
              <AccordionContent>
                Cualquier materia del nivel secundario. Los contenidos curriculares se basan en los diseños oficiales de la provincia.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger>¿Puedo exportar los materiales?</AccordionTrigger>
              <AccordionContent>
                Sí, podés descargar el material de lectura en formato PDF listo para imprimir o compartir con tus estudiantes.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger>¿Mis datos están seguros?</AccordionTrigger>
              <AccordionContent>
                Absolutamente. Tu información se almacena de forma segura y solo vos tenés acceso a tus cursos y materiales.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Planificador Docente. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
