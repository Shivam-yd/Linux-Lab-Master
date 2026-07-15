import { useQuery } from "@tanstack/react-query";

interface AppConfig {
  googleEnabled: boolean;
}

export function useConfig() {
  return useQuery<AppConfig>({
    queryKey: ["app-config"],
    queryFn: async () => {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
    staleTime: Infinity, // config doesn't change at runtime
  });
}
