import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";

interface SchoolOption {
  id: string;
  official_name: string;
}

interface ScheduleSlot {
  id?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  module_count: string;
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

const WEEKDAY_OPTIONS = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
];

export function EditCourseDialog({ course, open, onOpenChange, onSaved }: Props) {
  const [subject, setSubject] = useState("");
  const [yearLevel, setYearLevel] = useState<number>(1);
  const [academicYear, setAcademicYear] = useState<number>(new Date().getFullYear());
  const [schoolId, setSchoolId] = useState("");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && course) {
      setSubject(course.subject);
      setYearLevel(course.year_level);
      setAcademicYear(course.academic_year);
      setSchoolId(course.school_id);

      // Load schedule slots
      supabase
        .from("course_schedule_slots")
        .select("id, day_of_week, start_time, end_time, module_count")
        .eq("course_id", course.id)
        .order("order_index")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setScheduleSlots(
              data.map((s) => ({
                id: s.id,
                day_of_week: String(s.day_of_week),
                start_time: s.start_time.slice(0, 5),
                end_time: s.end_time.slice(0, 5),
                module_count: String(s.module_count),
              }))
            );
          } else {
            setScheduleSlots([{ day_of_week: "1", start_time: "", end_time: "", module_count: "2" }]);
          }
        });
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

  const updateSlot = (index: number, field: keyof ScheduleSlot, value: string) => {
    setScheduleSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
    );
  };

  const addSlot = () => {
    setScheduleSlots((prev) => [
      ...prev,
      { day_of_week: "1", start_time: "", end_time: "", module_count: "2" },
    ]);
  };

  const removeSlot = (index: number) => {
    setScheduleSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const scheduleIsValid =
    scheduleSlots.length > 0 &&
    scheduleSlots.every(
      (slot) =>
        !!slot.day_of_week &&
        !!slot.start_time &&
        !!slot.end_time &&
        !!slot.module_count &&
        slot.end_time > slot.start_time
    );

  const handleSave = async () => {
    if (!course) return;

    setSaving(true);
    try {
      // Update course
      const { error: courseError } = await supabase
        .from("courses")
        .update({
          subject,
          year_level: yearLevel,
          academic_year: academicYear,
          school_id: schoolId,
        })
        .eq("id", course.id);

      if (courseError) throw courseError;

      // Delete existing slots
      await supabase.from("course_schedule_slots").delete().eq("course_id", course.id);

      // Insert new slots
      if (scheduleSlots.length > 0 && scheduleIsValid) {
        const slotsToInsert = scheduleSlots.map((slot, index) => ({
          course_id: course.id,
          day_of_week: Number(slot.day_of_week),
          start_time: slot.start_time,
          end_time: slot.end_time,
          module_count: Number(slot.module_count),
          order_index: index,
        }));

        const { error: slotsError } = await supabase
          .from("course_schedule_slots")
          .insert(slotsToInsert);

        if (slotsError) throw slotsError;
      }

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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar curso</DialogTitle>
          <DialogDescription>
            Modificá los datos básicos y el horario del curso.
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

          <Separator />

          <div className="space-y-3">
            <Label>Días y horarios de cursada</Label>
            {scheduleSlots.map((slot, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
                <Select
                  value={slot.day_of_week}
                  onValueChange={(v) => updateSlot(index, "day_of_week", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Día" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  value={slot.start_time}
                  onChange={(e) => updateSlot(index, "start_time", e.target.value)}
                  className="w-24"
                />
                <Input
                  type="time"
                  value={slot.end_time}
                  onChange={(e) => updateSlot(index, "end_time", e.target.value)}
                  className="w-24"
                />
                <Select
                  value={slot.module_count}
                  onValueChange={(v) => updateSlot(index, "module_count", v)}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} mód
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSlot(index)}
                  disabled={scheduleSlots.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSlot}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar horario
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !subject.trim() || !schoolId || !scheduleIsValid}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
