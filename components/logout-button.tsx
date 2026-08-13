"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <Button
      variant="outline"
      className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
      onClick={logout}
    >
      Logout
    </Button>
  );
}
