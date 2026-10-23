export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "This week" },
  { href: "/breakdown", label: "How we reach the goal" },
  { href: "/strategy", label: "Where the money goes" },
  { href: "/evaluation", label: "Numbers we watch" },
  { href: "/goals", label: "2027 Plan" },
  { href: "/deep-dives", label: "Deep dives" },
  { href: "/sources", label: "Data sources" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
