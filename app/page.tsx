// app/page.tsx
import { createClient } from "@/lib/supabaseServer";
import LandingClient from "@/components/LandingClient";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let ctaHref = "/auth";

  if (user) {
    // Check if they've completed onboarding
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();

    ctaHref = profile ? "/dashboard" : "/onboarding";
  }

  return <LandingClient ctaHref={ctaHref} />;
}
