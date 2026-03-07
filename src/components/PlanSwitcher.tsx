import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlanType } from "@/hooks/useEntitlements";

const planBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  FREE: "outline",
  BASICO: "secondary",
  PREMIUM: "default",
};
const planReadableLabel: Record<string, string> = {
  FREE: "Gratis",
  BASICO: "Básico",
  PREMIUM: "Premium",
};

interface PlanSwitcherProps {
  planType: PlanType;
  isQaUser: boolean;
  switchingPlan: boolean;
  onPlanSwitch: (plan: PlanType) => void;
}

export function PlanSwitcher({ planType, isQaUser, switchingPlan, onPlanSwitch }: PlanSwitcherProps) {
  if (isQaUser) {
    return (
      <div className="w-[180px]">
        <Select value={planType} onValueChange={(value) => onPlanSwitch(value as PlanType)} disabled={switchingPlan}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FREE">FREE</SelectItem>
            <SelectItem value="BASICO">BASICO</SelectItem>
            <SelectItem value="PREMIUM">PREMIUM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <Badge variant={planBadgeVariant[planType] || "outline"} className="text-xs">
      {planReadableLabel[planType] || planType}
    </Badge>
  );
}
