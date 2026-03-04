import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileUp, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type SchoolType = "COMUN" | "TECNICA";
type CurriculumCycle = "BASIC" | "UPPER";

type CurriculumDocument = {
  id: string;
  subject: string;
  cycle: CurriculumCycle;
  year_level: number;
  school_type: SchoolType | null;
  orientation: string | null;
  speciality: string | null;
  official_title: string | null;
  source_provider: string;
  fetched_at: string | null;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No se pudo leer el archivo"));
        return;
      }

      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el PDF"));
    reader.readAsDataURL(file);
  });
}

export default function CurriculumImport() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState(searchParams.get("subject") || "");
  const [cycle, setCycle] = useState<CurriculumCycle>((searchParams.get("cycle") as CurriculumCycle) || "UPPER");
  const [yearLevel, setYearLevel] = useState(searchParams.get("year_level") || "6");
  const [schoolType, setSchoolType] = useState<SchoolType | "ANY">("ANY");
  const [orientation, setOrientation] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [officialTitle, setOfficialTitle] = useState("");
  const [officialUrl, setOfficialUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [existingDocs, setExistingDocs] = useState<CurriculumDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const selectedDoc = useMemo(
    () => existingDocs.find((doc) => doc.id === selectedDocId) || null,
    [existingDocs, selectedDocId]
  );

  const useSelectedDocUrl = useMemo(() => {
    if (!selectedDoc) return null;

    const params = new URLSearchParams({
      subject: selectedDoc.subject,
      cycle: selectedDoc.cycle,
      year_level: String(selectedDoc.year_level),
      curriculum_document_id: selectedDoc.id,
    });

    if (selectedDoc.orientation) params.set("orientation", selectedDoc.orientation);
    if (selectedDoc.speciality) params.set("speciality", selectedDoc.speciality);

    return `/course/new?${params.toString()}`;
  }, [selectedDoc]);

  const handleSelectDoc = (doc: CurriculumDocument) => {
    setSelectedDocId(doc.id);
    setSubject(doc.subject);
    setCycle(doc.cycle);
    setYearLevel(String(doc.year_level));
    setSchoolType(doc.school_type ? doc.school_type : "ANY");
    setOrientation(doc.orientation || "");
    setSpeciality(doc.speciality || "");
    setOfficialTitle(doc.official_title || "");
  };

  useEffect(() => {
    const fetchDocs = async () => {
      const { data } = await supabase
        .from("curriculum_documents")
        .select("id, subject, cycle, year_level, school_type, orientation, speciality, official_title, source_provider, fetched_at")
        .eq("province", "PBA")
        .eq("status", "VERIFIED")
        .order("updated_at", { ascending: false })
        .limit(12);

      setExistingDocs((data || []) as CurriculumDocument[]);
      setLoadingDocs(false);
    };

    fetchDocs();
  }, []);

  const canSubmit = useMemo(() => {
    return (file || officialUrl.trim().length > 0) && subject.trim().length > 0 && yearLevel.trim().length > 0;
  }, [file, officialUrl, subject, yearLevel]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    if (nextFile && !officialTitle.trim()) {
      setOfficialTitle(nextFile.name.replace(/\.pdf$/i, ""));
    }
  };

  const refreshDocs = async () => {
    const { data } = await supabase
      .from("curriculum_documents")
      .select("id, subject, cycle, year_level, school_type, orientation, speciality, official_title, source_provider, fetched_at")
      .eq("province", "PBA")
      .eq("status", "VERIFIED")
      .order("updated_at", { ascending: false })
      .limit(12);

    setExistingDocs((data || []) as CurriculumDocument[]);
  };

  const handleImport = async () => {
    if (!file && !officialUrl.trim()) return;

    setImporting(true);
    try {
      const fileBase64 = file ? await fileToBase64(file) : null;
      const { data, error } = await supabase.functions.invoke("import-curriculum-pdf", {
        body: {
          file_name: file?.name || null,
          file_base64: fileBase64,
          province: "PBA",
          subject: subject.trim(),
          cycle,
          year_level: Number(yearLevel),
          school_type: schoolType === "ANY" ? null : schoolType,
          orientation: orientation.trim() || null,
          speciality: speciality.trim() || null,
          official_title: officialTitle.trim() || null,
          official_url: officialUrl.trim() || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await refreshDocs();

      toast({
        title: "Programa importado",
        description: `Se actualizo la base curricular con ${data.node_count || 0} nodos.`,
      });
    } catch (error) {
      toast({
        title: "No se pudo importar el programa",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Carga administrativa</p>
            <h1 className="text-lg font-semibold text-foreground">Importar programa oficial</h1>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Importar programa oficial</CardTitle>
            <CardDescription>
              Esta carga alimenta la base curricular de la app. Puede subir el PDF desde la PC o indicar una URL remota del repositorio o sitio que quiera, siempre que el enlace apunte al PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pdf-file">PDF desde la PC</Label>
              <Input id="pdf-file" type="file" accept="application/pdf" onChange={handleFileChange} />
              {file && <p className="text-sm text-muted-foreground">Archivo seleccionado: {file.name}</p>}
            </div>

            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Si no sube un archivo, puede importar directamente desde una URL remota al PDF.
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subject">Materia</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej. Filosofia" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year-level">Ano</Label>
                <Input id="year-level" type="number" min={1} max={6} value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ciclo</Label>
                <Select value={cycle} onValueChange={(value) => setCycle(value as CurriculumCycle)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASIC">Basico</SelectItem>
                    <SelectItem value="UPPER">Superior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de escuela</Label>
                <Select value={schoolType} onValueChange={(value) => setSchoolType(value as SchoolType | "ANY")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Generico / mas de un tipo</SelectItem>
                    <SelectItem value="COMUN">Comun</SelectItem>
                    <SelectItem value="TECNICA">Tecnica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="orientation">Orientacion</Label>
                <Input id="orientation" value={orientation} onChange={(e) => setOrientation(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="speciality">Especialidad</Label>
                <Input id="speciality" value={speciality} onChange={(e) => setSpeciality(e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="official-title">Titulo oficial</Label>
              <Textarea
                id="official-title"
                value={officialTitle}
                onChange={(e) => setOfficialTitle(e.target.value)}
                placeholder="Conviene cargar el titulo tal como figura en el documento"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="official-url">URL del programa o repositorio</Label>
              <Input
                id="official-url"
                value={officialUrl}
                onChange={(e) => setOfficialUrl(e.target.value)}
                placeholder="https://.../programa.pdf"
              />
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p>{profile?.email || "usuario autenticado"}</p>
              <p>Provincia fija de esta etapa: PBA.</p>
              <p>Si el mismo programa aplica a comun y tecnica, usar "Generico / mas de un tipo".</p>
              <p>Si usa URL remota, debe ser un enlace directo al PDF para que el importador pueda leerlo.</p>
              <p>Si el programa ya aparece en "Base curricular reciente", puede usarlo directo para crear un curso.</p>
            </div>

            <Button onClick={handleImport} disabled={!canSubmit || importing} className="w-full sm:w-auto">
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Importar programa
                </>
              )}
            </Button>

            {useSelectedDocUrl && (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to={useSelectedDocUrl}>Usar programa seleccionado</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Base curricular reciente</CardTitle>
            <CardDescription>Ultimos programas verificados cargados en PBA.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingDocs ? (
              <p className="text-sm text-muted-foreground">Cargando programas...</p>
            ) : existingDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavia no hay programas curriculares visibles.</p>
            ) : (
              existingDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedDocId === doc.id ? "border-primary bg-accent/30 ring-1 ring-primary/30" : ""
                  }`}
                >
                  <p className="font-medium text-foreground">{doc.official_title || doc.subject}</p>
                  <p className="text-sm text-muted-foreground">
                    {doc.subject} · {doc.year_level}° · {doc.cycle === "UPPER" ? "Ciclo Superior" : "Ciclo Basico"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc.school_type || "Generico"}{doc.orientation ? ` · ${doc.orientation}` : ""}{doc.speciality ? ` · ${doc.speciality}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Fuente: {doc.source_provider}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={selectedDocId === doc.id ? "default" : "outline"}
                      onClick={() => handleSelectDoc(doc)}
                    >
                      {selectedDocId === doc.id ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Seleccionado
                        </>
                      ) : (
                        "Seleccionar programa"
                      )}
                    </Button>
                    {selectedDocId === doc.id && useSelectedDocUrl && (
                      <Button asChild type="button" size="sm" variant="ghost">
                        <Link to={useSelectedDocUrl}>Trabajar con este programa</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
