// Contact and legal links shared by the public pages, so they only need changing in one place.
export const PUBLIC_CONTACT_LINKS = [
  {
    id: "location",
    label: "Belvedere Community Centre, 9 Chess Road, Rondebosch, Cape Town",
    shortLabel: "Rondebosch, Cape Town",
    href: "https://maps.google.com/?cid=1423116138085293119",
    external: true,
  },
  {
    id: "email",
    label: "jeremy@capefencingacademy.com",
    shortLabel: "jeremy@capefencingacademy.com",
    href: "mailto:jeremy@capefencingacademy.com",
    external: false,
  },
  {
    id: "facebook",
    label: "Fencing Western Cape community",
    shortLabel: "Facebook",
    href: "https://www.facebook.com/groups/FencingWC/",
    external: true,
  },
] as const;

export const PUBLIC_LEGAL_LINKS = [
  { label: "Privacy / POPIA", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
] as const;
