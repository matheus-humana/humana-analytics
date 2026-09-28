import { AI_BOTS, type AiBotName, type AiBotReport } from "./types";

type RobotsRule = { allow: boolean; path: string };

type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

export function parseRobots(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) {
      current = null;
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (key !== "allow" && key !== "disallow") continue;
    if (!current) {
      current = { agents: ["*"], rules: [] };
      groups.push(current);
    }
    current.rules.push({ allow: key === "allow", path: value });
  }

  return groups;
}

export function sitemapUrlsFromRobots(text: string): string[] {
  const urls: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const match = /^\s*sitemap:\s*(\S+)/i.exec(rawLine);
    if (match?.[1]) urls.push(match[1].trim());
  }
  return urls;
}

export function aiBotReports(robotsText: string | null): AiBotReport[] {
  if (robotsText == null) {
    return AI_BOTS.map((bot) => ({
      bot,
      access: "allowed",
      via: "missing_robots",
    }));
  }
  const groups = parseRobots(robotsText);
  return AI_BOTS.map((bot) => accessForBot(groups, bot));
}

function accessForBot(groups: RobotsGroup[], bot: AiBotName): AiBotReport {
  const name = bot.toLowerCase();
  const specific = groups.filter((group) => group.agents.includes(name));
  const wildcard = groups.filter((group) => group.agents.includes("*"));
  const chosen = specific.length > 0 ? specific : wildcard;
  const via = specific.length > 0 ? "explicit" : wildcard.length > 0 ? "wildcard" : "default";
  const allowed = pathAllowed(chosen, "/");
  return { bot, access: allowed ? "allowed" : "blocked", via };
}

/**
 * Longest matching Allow/Disallow wins for `/`.
 * An empty Disallow matches nothing. Equal lengths prefer Allow.
 */
function pathAllowed(groups: RobotsGroup[], path: string): boolean {
  let winner: { allow: boolean; length: number } | null = null;
  for (const group of groups) {
    for (const rule of group.rules) {
      if (!rule.path) continue;
      if (rule.path !== "/" && !path.startsWith(rule.path)) continue;
      const length = rule.path.length;
      if (
        !winner ||
        length > winner.length ||
        (length === winner.length && rule.allow && !winner.allow)
      ) {
        winner = { allow: rule.allow, length };
      }
    }
  }
  return winner ? winner.allow : true;
}
