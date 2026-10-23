export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "This week" },
  { href: "/breakdown", label: "How we reach the goal" },
  { href: "/strategy", label: "Where the money goes" },
  { href: "/evaluation", label: "Numbers we watch" },
  { href: "/goals", label: "Goals and limits" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
