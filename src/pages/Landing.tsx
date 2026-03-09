import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  BookOpen,
  Calendar,
  FileText,
  Settings2,
  ArrowRight,
  CheckCircle2,
  Minus,
  Layers,
  Sparkles,
  Menu,
  Link2,
  RefreshCw,
  Workflow,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Landing() {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-lg font-bold tracking-tight text-foreground">
            Docenc<span className="text-brand-accent">IA</span>
          </span>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#como-funciona" className="transition-colors hover:text-foreground">
              Cómo funciona
            </a>
            <a href="#planes" className="transition-colors hover:text-foreground">
              Planes
            </a>
            <a href="#contacto" className="transition-colors hover:text-foreground">
              Contacto
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/login">Ingresar</Link>
            </Button>
            {/* Mobile hamburger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menú</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetHeader>
                  <SheetTitle className="text-left">
                    Docenc<span className="text-brand-accent">IA</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-4 text-sm">
                  <a href="#como-funciona" className="text-foreground hover:text-brand-accent" onClick={() => setMobileMenuOpen(false)}>
                    Cómo funciona
                  </a>
                  <a href="#planes" className="text-foreground hover:text-brand-accent" onClick={() => setMobileMenuOpen(false)}>
                    Planes
                  </a>
                  <a href="#contacto" className="text-foreground hover:text-brand-accent" onClick={() => setMobileMenuOpen(false)}>
                    Contacto
                  </a>
                  <Link to="/demo" className="text-foreground hover:text-brand-accent" onClick={() => setMobileMenuOpen(false)}>
                    Probar demo
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          {/* Copy */}
          <div className="space-y-5">
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Docenc<span className="text-brand-accent">IA</span>
              </h1>
              <p className="mt-1 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                Sistema operativo para la tarea docente
              </p>
            </div>
            <p className="text-2xl font-semibold leading-snug md:text-3xl">
              Inteligencia artificial a tu servicio.
            </p>
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
              Planificá tu año, prepará tus clases, generá materiales y actividades; reuní agenda y
              gestión en un solo lugar.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" asChild>
                <Link to="/register">Crear cuenta gratis</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/demo">Probar demo</Link>
              </Button>
            </div>
          </div>

          {/* Mockup funcional */}
          <HeroMockup />
        </div>
      </section>

      {/* ── Bloque 1 — Tareas integradas ── */}
      <section className="border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              Una sola herramienta para lo que hacés todos los días.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Menos dispersión entre archivos, notas y planillas. Más continuidad para planificar,
              preparar y sostener cada curso.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: BookOpen,
                title: "Planificación del año y las clases",
                desc: "Organizá tu recorrido anual y cada clase desde una misma base.",
              },
              {
                icon: FileText,
                title: "Materiales y actividades",
                desc: "Generá recursos listos para trabajar sin salir de la plataforma.",
              },
              {
                icon: Calendar,
                title: "Agenda y seguimiento",
                desc: "Reuní fechas, clases y avances en un mismo entorno.",
              },
              {
                icon: Settings2,
                title: "Gestión cotidiana",
                desc: "Concentrá lo necesario para sostener el día a día sin depender de herramientas separadas.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="border bg-card">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bloque 2 — Ejemplo concreto ── */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              Un ejemplo concreto de cómo se organiza una cursada.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Planificación, clases, materiales y estados de avance reunidos en una misma vista.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-3xl">
            <CourseMockup />
          </div>
        </div>
      </section>

      {/* ── Bloque 3 — Recorrido ── */}
      <section id="como-funciona" className="scroll-mt-16 border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            Todo sigue un mismo recorrido.
          </h2>
          <div className="mt-12">
            {/* Desktop: horizontal with connectors */}
            <div className="hidden lg:grid lg:grid-cols-4 lg:gap-0">
              {[
                { step: "1", title: "Organizá tu curso", desc: "Definí el espacio desde el que vas a ordenar el año." },
                { step: "2", title: "Planificá", desc: "Armá el recorrido anual, unidades y clases." },
                { step: "3", title: "Prepará materiales y actividades", desc: "Usá la inteligencia artificial para acelerar la producción de recursos." },
                { step: "4", title: "Reuní agenda y gestión", desc: "Sostené el seguimiento cotidiano desde el mismo entorno." },
              ].map(({ step, title, desc }, i) => (
                <div key={step} className="relative flex flex-col items-center text-center px-4">
                  {/* Connector line */}
                  {i > 0 && (
                    <div className="absolute top-5 right-1/2 w-full border-t-2 border-dashed border-muted-foreground/30" />
                  )}
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {step}
                  </div>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
            {/* Mobile/tablet: vertical with connectors */}
            <div className="flex flex-col gap-0 lg:hidden">
              {[
                { step: "1", title: "Organizá tu curso", desc: "Definí el espacio desde el que vas a ordenar el año." },
                { step: "2", title: "Planificá", desc: "Armá el recorrido anual, unidades y clases." },
                { step: "3", title: "Prepará materiales y actividades", desc: "Usá la inteligencia artificial para acelerar la producción de recursos." },
                { step: "4", title: "Reuní agenda y gestión", desc: "Sostené el seguimiento cotidiano desde el mismo entorno." },
              ].map(({ step, title, desc }, i) => (
                <div key={step} className="relative flex gap-4 pb-8 last:pb-0">
                  {/* Vertical connector */}
                  {i < 3 && (
                    <div className="absolute left-5 top-10 bottom-0 w-px border-l-2 border-dashed border-muted-foreground/30" />
                  )}
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {step}
                  </div>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Bloque 4 — Diferenciación ── */}
      <section className="border-t">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 md:py-20">
          <Layers className="mx-auto h-8 w-8 text-brand-accent" />
          <h2 className="mt-4 text-2xl font-bold md:text-3xl">
            No es solo generar. Es reunir y dar continuidad.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            DocencIA integra planificación, clases, materiales, agenda y gestión para acompañar el
            trabajo cotidiano en un mismo sistema.
          </p>
          <div className="mt-6 flex flex-col items-start gap-3 text-left text-sm text-muted-foreground mx-auto max-w-md">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-brand-accent" />
              <span>Integración: todo conectado en un mismo flujo de trabajo.</span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 shrink-0 text-brand-accent" />
              <span>Continuidad: cada paso alimenta el siguiente sin empezar de cero.</span>
            </div>
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 shrink-0 text-brand-accent" />
              <span>Sistema: un entorno que sostiene la práctica cotidiana.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bloque 5 — Planes ── */}
      <section id="planes" className="scroll-mt-16 border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <h2 className="text-center text-2xl font-bold md:text-3xl">Elegi como empezar</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Comparativa actualizada de lo que incluye cada plan para que elijas con claridad.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                name: "Gratis",
                highlight: false,
                price: null as null | { monthly: number; annual: number },
                summary: "Para probar el flujo completo en 1 curso.",
                items: [
                  "1 curso activo",
                  "Hasta 35 estudiantes por curso",
                  "2 sesiones semanales",
                  "Exactamente 3 clases por sesion",
                  "Sin exportacion PDF validada",
                  "Sin fuentes del docente",
                ],
                cta: "Crear cuenta gratis",
                to: "/register",
              },
              {
                name: "Básico",
                highlight: true,
                price: { monthly: 15, annual: 150 },
                summary: "Produccion docente diaria con control de curso.",
                items: [
                  "Hasta 15 cursos activos",
                  "Generacion por clase o secuencia",
                  "Exportacion PDF validada",
                  "Fuentes del docente por archivo (PDF, imagen, DOC, XLS, TXT)",
                  "Copiloto en modo limited",
                  "Sin busqueda libre en internet",
                ],
                cta: "Empezar Básico",
                to: "/register",
              },
              {
                name: "Premium",
                highlight: false,
                price: { monthly: 25, annual: 250 },
                summary: "Maxima profundidad para planificar y enriquecer materiales.",
                items: [
                  "Incluye todo Básico",
                  "Fuentes por URL y video",
                  "Consultas concretas en internet con aprobacion docente",
                  "Tolerancia a typos en autor/canal/titulo",
                  "Copiloto en modo full",
                  "Mayor capacidad de personalizacion",
                ],
                cta: "Empezar Premium",
                to: "/register",
              },
            ].map(({ name, highlight, price, summary, items, cta, to }) => (
              <Card
                key={name}
                className={highlight ? "flex h-full flex-col border-primary ring-1 ring-primary/20" : "flex h-full flex-col border"}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{name}</CardTitle>
                  {price ? (
                    <div className="mt-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-foreground">€{price.monthly}</span>
                        <span className="text-sm text-muted-foreground">/ mes</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        o <span className="font-medium text-foreground">€{price.annual}</span> / año{" "}
                        <span className="text-success">(ahorras 2 meses)</span>
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-foreground">€0</span>
                        <span className="text-sm text-muted-foreground">/ siempre</span>
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex h-full flex-col space-y-4">
                  <p className="text-sm text-muted-foreground">{summary}</p>
                  <ul className="flex-1 space-y-2 text-sm">
                    {items.map((item) => {
                      const isNegative = item.startsWith("Sin ");
                      return (
                        <li key={item} className="flex items-start gap-2">
                          {isNegative ? (
                            <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          )}
                          <span className={isNegative ? "text-muted-foreground" : ""}>{item}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <Button
                    className="mt-auto w-full"
                    variant={highlight ? "default" : "outline"}
                    size="sm"
                    asChild
                  >
                    <Link to={to}>
                      {cta}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cierre CTA ── */}
      <section className="border-t">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 md:py-20">
          <h2 className="text-2xl font-bold md:text-3xl">
            Empezá a reunir todo en un solo lugar.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Planificación, clases, materiales, agenda y gestión, con inteligencia artificial
            integrada para acompañarte en cada etapa.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/register">Crear cuenta gratis</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/demo">Probar demo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contacto" className="scroll-mt-16 border-t bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <span className="text-sm font-bold tracking-tight">
              Docenc<span className="text-brand-accent">IA</span>
            </span>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <a href="#como-funciona" className="hover:text-foreground">
                Cómo funciona
              </a>
              <a href="#planes" className="hover:text-foreground">
                Planes
              </a>
              <Link to="/demo" className="hover:text-foreground">
                Demo
              </Link>
              <Link to="/login" className="hover:text-foreground">
                Ingresar
              </Link>
            </nav>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} DocencIA. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Hero Mockup — vista compacta de un curso
   ───────────────────────────────────────────── */
function HeroMockup() {
  return (
    <>
      {/* Desktop version */}
      <Card className="hidden border shadow-lg md:block">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Historia · 4° año</CardTitle>
            <StatusBadge tone="success" label="Validado" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded-md bg-muted px-3 py-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Clase 1 — Revolución Industrial</span>
              <StatusBadge tone="success" label="Validado" />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["Plan de clase", "Actividades", "Guía de lectura"].map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-xs text-success"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {m}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2.5 text-sm">
            <span className="font-medium">Clase 2 — Imperialismo</span>
            <StatusBadge tone="warning" label="En progreso" />
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2.5 text-sm">
            <span className="font-medium">Clase 3 — Primera Guerra Mundial</span>
            <StatusBadge tone="neutral" label="Borrador" />
          </div>
        </CardContent>
      </Card>

      {/* Mobile compact version */}
      <Card className="border shadow-lg md:hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Historia · 4° año</CardTitle>
            <StatusBadge tone="success" label="Validado" />
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span className="font-medium text-xs">Clase 1 — Rev. Industrial</span>
            <StatusBadge tone="success" label="Validado" />
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span className="font-medium text-xs">Clase 2 — Imperialismo</span>
            <StatusBadge tone="warning" label="En progreso" />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

/* ─────────────────────────────────────────────
   Course Mockup — vista más amplia de ejemplo
   ───────────────────────────────────────────── */
function CourseMockup() {
  const lessons = [
    { n: 1, title: "Contexto histórico", status: "Validado" as const, tone: "success" as const, materials: true },
    { n: 2, title: "Pensamiento filosófico", status: "Validado" as const, tone: "success" as const, materials: true },
    { n: 3, title: "Método científico", status: "En progreso" as const, tone: "warning" as const, materials: false },
    { n: 4, title: "Epistemología moderna", status: "Borrador" as const, tone: "neutral" as const, materials: false },
    { n: 5, title: "Evaluación integradora", status: "Borrador" as const, tone: "neutral" as const, materials: false },
  ];

  return (
    <Card className="border shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Filosofía e Hist. de la Ciencia · 5° año</CardTitle>
          <StatusBadge tone="warning" label="En progreso" />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Ciclo 2026
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" /> 28 clases planificadas
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> 2 materiales generados
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-2">
        {lessons.map((l) => (
          <div
            key={l.n}
            className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm"
          >
            <span className="font-medium">
              Clase {l.n} — {l.title}
            </span>
            <div className="flex items-center gap-2">
              {l.materials && (
                <span className="hidden items-center gap-1 text-xs text-success sm:inline-flex">
                  <CheckCircle2 className="h-3 w-3" /> Materiales
                </span>
              )}
              <StatusBadge tone={l.tone} label={l.status} />
            </div>
          </div>
        ))}
        <p className="pt-1 text-center text-xs text-muted-foreground">
          … y 23 clases más en el recorrido anual
        </p>
      </CardContent>
    </Card>
  );
}
