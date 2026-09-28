import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isAllowedCompanyEmail } from "@/lib/auth/allowed-domains";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;
    return {
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireSessionUser(): Promise<
  | { user: SessionUser; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { ok: false, error: "Sign in required." },
        { status: 401 }
      ),
    };
  }

  if (!isAllowedCompanyEmail(user.email)) {
    return {
      user: null,
      response: NextResponse.json(
        { ok: false, error: "Access denied." },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}
