import { permanentRedirect } from "next/navigation";

/** /classes: old link, now a permanent redirect to the About section of the home page. */
export default function ClassesPage() {
  permanentRedirect("/#about");
}
