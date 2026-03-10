import { useMemberProfile } from "@/hooks/useMemberProfile";

/**
 * Invisible component that links the current Clerk user to their
 * Supabase member row on login (by email match). Mount once at app root.
 */
export function MemberLinker() {
  useMemberProfile();
  return null;
}
