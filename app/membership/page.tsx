import { permanentRedirect } from "next/navigation";

/** /membership: old link, now a permanent redirect to the member portal's membership page. */
export default function MembershipPage() {
  permanentRedirect("/protected/membership");
}
