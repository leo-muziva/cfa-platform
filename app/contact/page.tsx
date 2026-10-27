import { permanentRedirect } from "next/navigation";

/** /contact: old link, now a permanent redirect to the club info section of the home page. */
export default function ContactPage() {
  permanentRedirect("/#contact");
}
