import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

interface CurriculumNode {
  id: string;
  name: string;
  node_type: string;
}

interface CopilotPanelProps {
  bibliographyNodes: CurriculumNode[];
  referencedNodeIds: string[];
  depthLevel: string;
  onDepthChange: (level: "BAJO" | "MEDIO" | "ALTO") => void;
  onRegenerateTeaching: () => void;
  onRegenerateReading: () => void;
  isGenerating: boolean;
  isLocked: boolean;
}

export default function CopilotPanel({
  bibliographyNodes,
  referencedNodeIds,
  depthLevel,
  onDepthChange,
  onRegenerateTeaching,
  onRegenerateReading,
  isGenerating,
  isLocked,
}: CopilotPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-3">Copiloto</h3>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Bibliografía usada</Label>
        <div className="space-y-1">
          {bibliographyNodes.map((node) => (
            <div key={node.id} className="flex items-center gap-2 text-xs">
              <Badge
                variant={referencedNodeIds.includes(node.id) ? "default" : "outline"}
                className="text-[10px] px-1"
              >
                {node.node_type}
              </Badge>
              <span className={referencedNodeIds.includes(node.id) ? "text-foreground" : "text-muted-foreground"}>
                {node.name}
              </span>
              {referencedNodeIds.includes(node.id) && (
                <span className="text-[10px] text-primary">✓ citado</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Nivel de profundidad</Label>
        <Select value={depthLevel} onValueChange={(v) => onDepthChange(v as "BAJO" | "MEDIO" | "ALTO")} disabled={isGenerating || isLocked}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BAJO">Bajo</SelectItem>
            <SelectItem value="MEDIO">Medio</SelectItem>
            <SelectItem value="ALTO">Alto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Regenerar</Label>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerateTeaching}
            disabled={isGenerating || isLocked}
            className="text-xs"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Material didáctico
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerateReading}
            disabled={isGenerating || isLocked}
            className="text-xs"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Material de lectura
          </Button>
        </div>
      </div>
    </div>
  );
}
