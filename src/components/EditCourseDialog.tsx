import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SchoolOption {
  id: string;
  official_name: string;
}

interface CourseData {
  id: string;
  subject: string;
  year_level: number;
  academic_year: number;
  school_id: string;
}

interface Props {
  course: CourseData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditCourseDialog({ course, open, onOpenChange, onSaved }: Props) {
  const [subject, setSubject] = useState("");
  const [yearLevel, setYearLevel] = useState<number>(1);
  const [academicYear, setAcademicYear] = useState<number>(new Date().getFullYear());
  const [schoolId, setSchoolId] = useState("");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && course) {
      setSubject(course.subject);
      setYearLevel(course.year_level);
      setAcademicYear(course.academic_year);
      setSchoolId(course.school_id);
    }
  }, [open, course]);

  useEffect(() => {
    if (open) {
      supabase
        .from("schools")
        .select("id, official_name")
        .order("official_name")
        .then(({ data }) => {
          if (data) setSchools(data);
        });
    }
  }, [open]);

  const handleSave = async () => {
    if (!course) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("courses")
        .update({
          subject,
          year_level: yearLevel,
          academic_year: academicYear,
          school_id: schoolId,
        })
        .eq("id", course.id);

      if (error) throw error;

      toast({
        title: "Curso actualizado",
        description: "Los cambios se guardaron correctamente.",
      });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast({
        title: "Error al guardar",
        description: formatErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar curso</DialogTitle>
          <DialogDescription>
            Modificá los datos básicos del curso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Materia</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ej: Matemática"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year_level">Año</Label>
              <Select
                value={String(yearLevel)}
                onValueChange={(v) => setYearLevel(Number(v))}
              >
                <SelectTrigger id="year_level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}° año
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="academic_year">Ciclo lectivo</Label>
              <Select
                value={String(academicYear)}
                onValueChange={(v) => setAcademicYear(Number(v))}
              >
                <SelectTrigger id="academic_year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="school">Escuela</Label>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger id="school">
                <SelectValue placeholder="Seleccioná una escuela" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.official_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !subject.trim() || !schoolId}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
