import { permanentRedirect } from "next/navigation";

/** /about: old link, now a permanent redirect to the About section of the home page. */
export default function AboutPage() {
  permanentRedirect("/#about");
}
