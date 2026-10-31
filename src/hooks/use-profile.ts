import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async (): Promise<Profile> => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) throw new Error("Not signed in");
    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    if (data) return data;
    // Safety net: create the profile if the signup trigger did not (e.g. older accounts).
    const meta = user.user_metadata ?? {};
    const { data: created, error: insErr } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: String(meta["full_name"] ?? meta["name"] ?? "").slice(0, 100),
        business_name: String(meta["business_name"] ?? "").slice(0, 120),
        device_id: `pp-${user.id.replace(/-/g, "").slice(0, 8)}`,
      })
      .select("*")
      .single();
    if (insErr) throw insErr;
    return created;
  },
  staleTime: 60_000,
});

export function useProfile() {
  return useSuspenseQuery(profileQuery).data;
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", auth.user.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => qc.setQueryData(profileQuery.queryKey, data),
  });
}
