import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PlanType = "FREE" | "BASICO" | "PREMIUM";
export type CopilotoMode = "none" | "limited" | "full";

export interface Entitlements {
  max_courses: number;
  max_students_per_course: number;
  max_weekly_sessions: number;
  max_classes_per_session: number;
  watermark_enabled: boolean;
  history_enabled: boolean;
  copiloto_mode: CopilotoMode;
  auto_complete_forms_enabled: boolean;
  persistent_storage_enabled: boolean;
}

const FREE_DEFAULTS: Entitlements = {
  max_courses: 1,
  max_students_per_course: 35,
  max_weekly_sessions: 2,
  max_classes_per_session: 3,
  watermark_enabled: true,
  history_enabled: false,
  copiloto_mode: "none",
  auto_complete_forms_enabled: false,
  persistent_storage_enabled: false,
};

export function useEntitlements() {
  const { user } = useAuth();
  const [planType, setPlanType] = useState<PlanType>("FREE");
  const [entitlements, setEntitlements] = useState<Entitlements>(FREE_DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchEntitlements = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const [subRes, entRes] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("plan_type, status")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .maybeSingle(),
      supabase
        .from("user_entitlements")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (subRes.data) {
      setPlanType(subRes.data.plan_type as PlanType);
    }

    if (entRes.data) {
      setEntitlements({
        max_courses: entRes.data.max_courses,
        max_students_per_course: entRes.data.max_students_per_course,
        max_weekly_sessions: entRes.data.max_weekly_sessions,
        max_classes_per_session: entRes.data.max_classes_per_session,
        watermark_enabled: entRes.data.watermark_enabled,
        history_enabled: entRes.data.history_enabled,
        copiloto_mode: entRes.data.copiloto_mode as CopilotoMode,
        auto_complete_forms_enabled: entRes.data.auto_complete_forms_enabled,
        persistent_storage_enabled: entRes.data.persistent_storage_enabled,
      });
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchEntitlements();

    // Polling every 30s for hot upgrades
    const interval = setInterval(fetchEntitlements, 30_000);
    return () => clearInterval(interval);
  }, [fetchEntitlements]);

  return { planType, entitlements, loading, refetch: fetchEntitlements };
}
