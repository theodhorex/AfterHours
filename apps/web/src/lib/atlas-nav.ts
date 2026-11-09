import type { IconName } from "../components/ui/Icons.tsx";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  description?: string;
  signedInOnly?: boolean;
  signedOutOnly?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export interface Breadcrumb {
  label: string;
  href: string;
  isCurrent: boolean;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        href: "/atlas",
        label: "My city",
        icon: "seal",
        description: "Active settlement map & ledger",
      },
    ],
  },
  {
    id: "trade",
    label: "Trade",
    items: [
      {
        href: "/atlas/market",
        label: "Global market",
        icon: "coin",
        description: "Commodity pricing and realm depth",
      },
      {
        href: "/atlas/caravans",
        label: "Caravans",
        icon: "caravan",
        description: "Overland expeditions and logistics",
      },
      {
        href: "/atlas/exchange",
        label: "City exchange",
        icon: "scale",
        description: "Inter-city barter and wholesale contracts",
      },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      {
        href: "/atlas/cities",
        label: "My cities",
        icon: "scroll",
        description: "Settlements chartered under this account",
      },
      {
        href: "/atlas/welcome",
        label: "Welcome",
        icon: "quill",
        description: "Charter guide and newcomer ledger entry",
        signedOutOnly: true,
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      {
        href: "/atlas/leaderboard",
        label: "Leaderboard",
        icon: "scale",
        description: "Settlement standing across epochs",
      },
      {
        href: "/atlas/audit",
        label: "Audit",
        icon: "seal",
        description: "Cryptographic proof log and state roots",
      },
    ],
  },
];

export const FOOTER_NAV_ITEM: NavItem = {
  href: "/",
  label: "Back to landing",
  icon: "hourglass",
  description: "Return to AfterHours landing parchment",
};

/**
 * Normalizes a pathname by stripping query string, hash, and trailing slashes.
 */
function normalizePath(path: string): string {
  const stripped = path.split("?")[0].split("#")[0];
  if (stripped.length > 1 && stripped.endsWith("/")) {
    return stripped.slice(0, -1);
  }
  return stripped;
}

/**
 * Determines whether a nav item should be considered active for a pathname.
 */
export function isActiveNav(pathname: string, href: string): boolean {
  const normCurrent = normalizePath(pathname);
  const normTarget = normalizePath(href);

  if (normTarget === "/") {
    return normCurrent === "/";
  }

  if (normTarget === "/atlas") {
    return normCurrent === "/atlas";
  }

  return normCurrent === normTarget || normCurrent.startsWith(`${normTarget}/`);
}

/**
 * Filters navigation groups by search query and authentication state.
 */
export function filterNavGroups(
  groups: NavGroup[],
  query: string,
  isAuthenticated: boolean
): NavGroup[] {
  const q = query.trim().toLowerCase();

  return groups
    .map((group) => {
      const visibleItems = group.items.filter((item) => {
        if (item.signedOutOnly && isAuthenticated) {
          return false;
        }
        if (item.signedInOnly && !isAuthenticated) {
          return false;
        }
        if (!q) {
          return true;
        }
        return (
          item.label.toLowerCase().includes(q) ||
          group.label.toLowerCase().includes(q) ||
          Boolean(item.description && item.description.toLowerCase().includes(q))
        );
      });

      return {
        ...group,
        items: visibleItems,
      };
    })
    .filter((group) => group.items.length > 0);
}

const ROUTE_LABELS: Record<string, string> = {
  "/atlas": "Atlas",
  "/atlas/market": "Global market",
  "/atlas/caravans": "Caravans",
  "/atlas/exchange": "City exchange",
  "/atlas/cities": "My cities",
  "/atlas/welcome": "Welcome",
  "/atlas/leaderboard": "Leaderboard",
  "/atlas/audit": "Audit",
};

/**
 * Generates breadcrumb elements from a pathname.
 */
export function getBreadcrumbs(pathname: string): Breadcrumb[] {
  const norm = normalizePath(pathname);

  if (norm === "/atlas" || norm === "") {
    return [
      {
        label: "Atlas",
        href: "/atlas",
        isCurrent: true,
      },
    ];
  }

  const parts = norm.split("/").filter(Boolean);
  const crumbs: Breadcrumb[] = [];
  let currentPath = "";

  for (let i = 0; i < parts.length; i++) {
    currentPath += `/${parts[i]}`;
    const isCurrent = i === parts.length - 1;
    const knownLabel = ROUTE_LABELS[currentPath];
    const label =
      knownLabel ??
      parts[i].charAt(0).toUpperCase() + parts[i].slice(1).replace(/-/g, " ");

    crumbs.push({
      label,
      href: currentPath,
      isCurrent,
    });
  }

  return crumbs;
}
