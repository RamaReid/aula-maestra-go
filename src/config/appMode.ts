export type AppMode = "simulation" | "production";

function resolveMode(): AppMode {
  const configuredMode = import.meta.env.VITE_APP_MODE;
  if (configuredMode === "simulation" || configuredMode === "production") {
    return configuredMode;
  }

  return import.meta.env.DEV ? "simulation" : "production";
}

export const APP_MODE: AppMode = resolveMode();
export const IS_SIMULATION = APP_MODE === "simulation";
