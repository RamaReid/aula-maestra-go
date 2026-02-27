import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LogOut, Plus, ChevronDown, BookOpen } from "lucide-react";

interface CourseWithDetails {
  id: string;
  subject: string;
  year_level: number;
  academic_year: number;
  status: string;
  school: { official_name: string } | null;
  plan: { status: string } | null;
}

export default function Dashboard() {
  const { profile, logout } = useAuth();
  const [courses, setCourses] = useState<CourseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, subject, year_level, academic_year, status, schools(official_name), plans(status)")
        .order("academic_year", { ascending: false });

      if (data) {
        setCourses(
          data.map((c: any) => ({
            id: c.id,
            subject: c.subject,
            year_level: c.year_level,
            academic_year: c.academic_year,
            status: c.status,
            school: c.schools ? { official_name: c.schools.official_name } : null,
            plan: c.plans ? { status: c.plans.status } : null,
          }))
        );
      }
      setLoading(false);
    };
    fetchCourses();
  }, []);

  const activeCourses = courses.filter((c) => c.status === "ACTIVE");
  const archivedCourses = courses.filter((c) => c.status === "ARCHIVED");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Hola, {profile?.name || "Docente"}
            </h1>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {/* Active Courses */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Mis cursos activos</h2>
            <Button size="sm" disabled>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo curso
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : activeCourses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tenés cursos activos todavía.</p>
                <p className="text-sm text-muted-foreground">Creá tu primer curso para empezar a planificar.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeCourses.map((course) => (
                <Link key={course.id} to={`/course/${course.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{course.subject}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {course.school?.official_name ?? "Sin escuela"} · {course.year_level}° año · {course.academic_year}
                      </p>
                      <Badge variant={course.plan?.status === "VALIDATED" ? "default" : "secondary"}>
                        {course.plan?.status === "VALIDATED" ? "Validado" : "Incompleto"}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Archived Courses */}
        {archivedCourses.length > 0 && (
          <>
            <Separator />
            <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  Cursos archivados ({archivedCourses.length})
                  <ChevronDown className={`h-4 w-4 transition-transform ${archivedOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {archivedCourses.map((course) => (
                    <Card key={course.id} className="opacity-70">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{course.subject}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {course.school?.official_name ?? "Sin escuela"} · {course.year_level}° año · {course.academic_year}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </main>
    </div>
  );
}
