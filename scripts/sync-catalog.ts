// Pins each plugin in index.json to its newest release and the commit its tag points at, which is all Mirador installs,
// with the plugin API it needs, and, when a Mirador may be too old for it, to the newest release each older plugin API
// runs. Fills its icon, description, tagline, screenshots and kinds from that commit's plugin.json. A field plugin.json
// doesn't give, or gives in a form Mirador wouldn't show, keeps the catalog's value, and so does every field of a plugin
// that couldn't be read. Merging the pull request a bump lands in is what lets a release reach users, so read its code.

const INDEX_PATH = new URL("../index.json", import.meta.url).pathname;
const GIVE_UP_AFTER_MILLISECONDS = 20_000;
const MAX_ICON_BYTES = 64 * 1024;
const MAX_TAGLINE_LENGTH = 120;
/** The plugin API of the oldest Miradors that read pins: 0.15.x and older take each plugin's releases from its tags. */
export const OLDEST_API = 23;
const KINDS = ["app", "canvas"] as const;
const PIN_FIELDS = ["release", "commit", "api", "older"];
const PAGE_FIELDS = ["icon", "description", "tagline", "screenshots", "kinds"] as const;

type Kind = (typeof KINDS)[number];

export interface Screenshot {
  url: string;
  caption: string;
}

export interface CatalogEntry {
  name: string;
  repo: string;
  release?: string;
  commit?: string;
  api?: number;
  older?: OlderRelease[];
  branch?: string;
  icon?: string;
  description?: string;
  tagline?: string;
  kinds?: Kind[];
  screenshots?: Screenshot[];
  [field: string]: unknown;
}

/** What a release's plugin.json says about the plugin; null where it says nothing Mirador would show. */
export interface PluginPage {
  icon: string | null;
  description: string | null;
  tagline: string | null;
  screenshots: Screenshot[] | null;
  kinds: Kind[] | null;
}

type Manifest = Record<string, unknown>;

type Load = (url: string, method?: "GET" | "HEAD") => Promise<Response>;

const load: Load = (url, method = "GET") => fetch(url, { method, signal: AbortSignal.timeout(GIVE_UP_AFTER_MILLISECONDS) });

export const isIcon = (svg: unknown): svg is string =>
  typeof svg === "string" && new TextEncoder().encode(svg).length <= MAX_ICON_BYTES && /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(svg);

export const isTagline = (tagline: unknown): tagline is string => typeof tagline === "string" && tagline.trim() !== "" && tagline.length <= MAX_TAGLINE_LENGTH;

const isText = (text: unknown): text is string => typeof text === "string" && text.trim() !== "";

/** A path inside the plugin's folder, without a leading "./"; null for one that leaves it. */
export function pathInside(path: unknown): string | null {
  if (typeof path !== "string") return null;
  const parts = path.split("/").filter((part) => part !== "" && part !== ".");
  return path.startsWith("/") || parts.length === 0 || parts.includes("..") ? null : parts.join("/");
}

/** Where raw files of a GitHub repo are at a ref; null for a repo elsewhere, whose files have no such address. */
export function rawFilesOf(repo: string, ref: string): string | null {
  const slug = repo.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(\.git)?\/?$/)?.[1];
  return slug ? `https://raw.githubusercontent.com/${slug}/${ref}/` : null;
}

const kindsOf = (manifest: Record<string, unknown>): Kind[] | null => {
  const kinds = KINDS.filter((kind) => manifest[kind] !== undefined);
  return kinds.length > 0 ? kinds : null;
};

async function iconAt(files: string, path: unknown, problems: string[], loadFile: Load): Promise<string | null> {
  const inside = pathInside(path);
  if (inside === null || !inside.endsWith(".svg")) return null;
  const response = await loadFile(files + inside);
  if (!response.ok) {
    problems.push(`its icon ${inside} answered ${response.status}`);
    return null;
  }
  const svg = (await response.text()).trim();
  return isIcon(svg) ? svg : null;
}

/** Every picture plugin.json lists, or null when any of them isn't an image at its address, so a bad run never drops one. */
async function screenshotsAt(files: string, listed: unknown, problems: string[], loadFile: Load): Promise<Screenshot[] | null> {
  if (!Array.isArray(listed)) return null;
  const pictures = listed.flatMap((picture: { path?: unknown; caption?: unknown }) => {
    const path = pathInside(picture?.path);
    return path !== null && isText(picture?.caption) ? [{ url: files + path, caption: picture.caption }] : [];
  });
  if (pictures.length === 0) return null;
  const notImages = (
    await Promise.all(
      pictures.map(async ({ url }) => {
        const response = await loadFile(url, "HEAD");
        return response.ok && response.headers.get("content-type")?.startsWith("image/") ? [] : [`${url} answered ${response.status} ${response.headers.get("content-type") ?? ""}`.trim()];
      }),
    )
  ).flat();
  problems.push(...notImages);
  return notImages.length === 0 ? pictures : null;
}

export async function pageAt(files: string, manifest: Record<string, unknown>, problems: string[], loadFile: Load = load): Promise<PluginPage> {
  return {
    icon: await iconAt(files, manifest.icon, problems, loadFile),
    description: isText(manifest.description) ? manifest.description : null,
    tagline: isTagline(manifest.tagline) ? manifest.tagline : null,
    screenshots: await screenshotsAt(files, manifest.screenshots, problems, loadFile),
    kinds: kindsOf(manifest),
  };
}

/** The entry with what the page gives in place of the catalog's own, each field where it was. */
export function withPage(entry: CatalogEntry, page: PluginPage): CatalogEntry {
  const given = Object.fromEntries(PAGE_FIELDS.flatMap((field) => (page[field] === null ? [] : [[field, page[field]]])));
  return { ...entry, ...given };
}

export const changedFields = (before: CatalogEntry, after: CatalogEntry) =>
  PAGE_FIELDS.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));

/** The release Mirador installs for a catalog plugin, and the commit its tag must point at. */
export interface Pin {
  release: string;
  commit: string;
}

/** A release with the plugin API it needs. */
export interface PinnedRelease extends Pin {
  api: number;
}

/** The release Miradors take whose plugin API is too old for the entry's own, with what it says about itself where that differs from the entry. */
export interface OlderRelease extends PinnedRelease, Partial<Pick<CatalogEntry, (typeof PAGE_FIELDS)[number]>> {}

const pinOf = ({ release, commit }: CatalogEntry): Pin | null => (release && commit ? { release, commit } : null);

/** Each release's commit by version, from `git ls-remote --tags`: an annotated tag's peeled line wins over the tag object. */
export function releaseCommits(lsRemoteOutput: string): Map<string, string> {
  const refs = lsRemoteOutput.split("\n").flatMap((line) => {
    const [commit, ref] = line.trim().split(/\s+/);
    const tag = ref?.match(/^refs\/tags\/v(\d+\.\d+\.\d+)(\^\{\})?$/);
    return commit && tag?.[1] ? [{ release: tag[1], commit, peeled: tag[2] !== undefined }] : [];
  });
  const peeledLast = refs.toSorted((one, other) => Number(one.peeled) - Number(other.peeled));
  return new Map(peeledLast.map(({ release, commit }) => [release, commit]));
}

/** Why a pin's tag no longer vouches for it; null while it points at the pinned commit. */
export function movedTag({ release, commit }: Pin, commits: Map<string, string>): string | null {
  const now = commits.get(release);
  if (now === commit) return null;
  return now ? `v${release} now points at ${now}, not the pinned ${commit}; the pin stays` : `v${release} is gone from the repo; the pin stays`;
}

export const pluginApiOf = ({ api }: Manifest): number | null => (typeof api === "number" && Number.isInteger(api) && api >= 1 ? api : null);

/** The releases before `pin`, newest first, without the revoked ones. */
export const releasesBefore = (pin: Pin, commits: Map<string, string>, revoked: Set<string>): Pin[] =>
  [...commits]
    .filter(([release, commit]) => !revoked.has(commit) && Bun.semver.order(release, pin.release) < 0)
    .sort(([one], [other]) => Bun.semver.order(other, one))
    .map(([release, commit]) => ({ release, commit }));

/**
 * Of the releases, newest first, the newest one for each plugin API older than `api`, down to one that every Mirador
 * that reads pins runs. One that isn't a plugin yet, or whose plugin.json gives another version than its tag, is passed over.
 */
export async function newestForOlderApis(api: number, releases: Pin[], manifestAt: (release: Pin) => Promise<Manifest | null>): Promise<{ release: PinnedRelease; manifest: Manifest }[]> {
  const found: { release: PinnedRelease; manifest: Manifest }[] = [];
  let oldest = api;
  for (const release of releases) {
    if (oldest <= OLDEST_API) break;
    const manifest = await manifestAt(release);
    const needs = manifest && manifest.version === release.release ? pluginApiOf(manifest) : null;
    if (manifest === null || needs === null || needs >= oldest) continue;
    found.push({ release: { ...release, api: needs }, manifest });
    oldest = needs;
  }
  return found;
}

/** An older release, with each field of its page the entry doesn't hold the same. */
export function olderRelease(entry: CatalogEntry, release: PinnedRelease, page: PluginPage): OlderRelease {
  const own = PAGE_FIELDS.filter((field) => page[field] !== null && JSON.stringify(page[field]) !== JSON.stringify(entry[field]));
  return { ...release, ...Object.fromEntries(own.map((field) => [field, page[field]])) };
}

export type PinChoice = { pin: Pin; problem: null } | { pin: null; problem: string };

/**
 * The newest release past the pinned one whose commit isn't revoked, else the pin as it is. A pinned tag that now
 * points elsewhere is a problem, never a new pin: whoever moved it may be the harm the pin keeps out.
 */
export function chosenPin(pinned: Pin | null, commits: Map<string, string>, revoked: Set<string>): PinChoice {
  const moved = pinned && movedTag(pinned, commits);
  if (moved) return { pin: null, problem: moved };
  const newer = [...commits].filter(([release, commit]) => !revoked.has(commit) && (pinned === null || Bun.semver.order(release, pinned.release) > 0));
  const [newest] = newer.sort(([one], [other]) => Bun.semver.order(other, one));
  if (newest) return { pin: { release: newest[0], commit: newest[1] }, problem: null };
  if (pinned && revoked.has(pinned.commit)) return { pin: null, problem: `the pinned v${pinned.release} is revoked and no newer release is; pin an earlier one by hand` };
  return pinned ? { pin: pinned, problem: null } : { pin: null, problem: "tags no release to pin" };
}

/** The entry pinned to its release and to the ones for older plugin APIs, right after its repo. */
export function withPin(entry: CatalogEntry, { release, commit, api }: PinnedRelease, older: OlderRelease[] = []): CatalogEntry {
  const pin = { release, commit, api, ...(older.length > 0 ? { older } : {}) };
  const fields = Object.entries(entry).flatMap(([field, value]): [string, unknown][] => {
    if (PIN_FIELDS.includes(field)) return [];
    return field === "repo" ? [[field, value], ...Object.entries(pin)] : [[field, value]];
  });
  return Object.fromEntries(fields) as CatalogEntry;
}

const pageOf = (repo: string) => repo.replace(/\.git$/, "").replace(/\/$/, "");

/** Where to read what a pin bump brings, for whoever reviews it. */
export const compareUrl = (repo: string, from: string, to: string) => `${pageOf(repo)}/compare/${from}...${to}`;

/** Where to read a whole release, when none before it was read. */
const treeUrl = (repo: string, commit: string) => `${pageOf(repo)}/tree/${commit}`;

async function releaseCommitsOf(repo: string) {
  const listed = await Bun.$`git ls-remote --tags -- ${repo}`.quiet().nothrow();
  if (listed.exitCode !== 0) throw new Error(`git ls-remote failed: ${listed.stderr.toString().trim()}`);
  return releaseCommits(listed.stdout.toString());
}

/** The plugin.json of a GitHub repo at a commit; null where it has none. */
async function manifestAt(repo: string, commit: string): Promise<Manifest | null> {
  const response = await load(`${rawFilesOf(repo, commit)}plugin.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`its plugin.json at ${commit.slice(0, 7)} answered ${response.status}`);
  return response.json();
}

function pinNote(entry: CatalogEntry, pinned: Pin | null, pin: Pin) {
  if (pinned === null) return `pinned at ${pin.release} (${pin.commit.slice(0, 7)})`;
  if (pinned.commit === pin.commit) return null;
  return `${pinned.release} → ${pin.release}: read what it brings at ${compareUrl(entry.repo, pinned.commit, pin.commit)}`;
}

/** What a bump changes for Miradors too old for the entry's own release; nothing while they keep what they had. */
export function olderNotes(entry: CatalogEntry, older: OlderRelease[]): string[] {
  const read = [pinOf(entry), ...(entry.older ?? [])].filter((pin) => pin !== null);
  const had = new Map((entry.older ?? []).map(({ api, commit }) => [api, commit]));
  return older
    .filter(({ api, commit }) => had.get(api) !== commit)
    .map(({ release, commit, api }) => {
      const forOlder = `${release} for Miradors that speak plugin API ${api} but not the newest release's`;
      if (read.some((pin) => pin.commit === commit)) return `keeps ${forOlder}`;
      const lastRead = read.filter((pin) => Bun.semver.order(pin.release, release) < 0).sort((one, other) => Bun.semver.order(other.release, one.release))[0];
      return `pins ${forOlder}: read ${lastRead ? `what it brings at ${compareUrl(entry.repo, lastRead.commit, commit)}` : `it at ${treeUrl(entry.repo, commit)}`}`;
    });
}

interface Synced {
  entry: CatalogEntry;
  note: string | null;
  problems: string[];
}

async function synced(entry: CatalogEntry, revoked: Set<string>): Promise<Synced> {
  const unchanged = (problem: string): Synced => ({ entry, note: null, problems: [problem] });
  try {
    if (entry.branch) return unchanged("follows a branch, which can't be pinned; list a release instead");
    const pinned = pinOf(entry);
    const commits = await releaseCommitsOf(entry.repo);
    const choice = chosenPin(pinned, commits, revoked);
    if (choice.problem !== null) return unchanged(choice.problem);
    const moved = (entry.older ?? []).filter(({ commit }) => !revoked.has(commit)).flatMap((older) => movedTag(older, commits) ?? []);
    if (moved.length > 0) return unchanged(moved.join("; "));
    const { pin } = choice;
    const files = rawFilesOf(entry.repo, pin.commit);
    if (files === null) return unchanged("isn't on GitHub, whose raw file addresses the sync reads; pin it by hand");
    const manifest = await manifestAt(entry.repo, pin.commit);
    if (manifest === null) return unchanged(`its plugin.json at v${pin.release} is missing`);
    if (manifest.version !== pin.release) return unchanged(`its plugin.json at v${pin.release} gives version ${manifest.version}, which Mirador refuses`);
    const api = pluginApiOf(manifest);
    if (api === null) return unchanged(`its plugin.json at v${pin.release} names no plugin API`);
    const problems: string[] = [];
    const described = withPage(entry, await pageAt(files, manifest, problems));
    const forOlderApis = await newestForOlderApis(api, releasesBefore(pin, commits, revoked), ({ commit }) => manifestAt(entry.repo, commit));
    const older = await Promise.all(
      forOlderApis.map(async (found) => olderRelease(described, found.release, await pageAt(rawFilesOf(entry.repo, found.release.commit)!, found.manifest, problems))),
    );
    const after = withPin(described, { ...pin, api }, older);
    const changed = changedFields(entry, after);
    const notes = [pinNote(entry, pinned, pin), ...olderNotes(entry, older), changed.length > 0 ? `its page at ${pin.release}: ${changed.join(", ")}` : null].filter(Boolean);
    return { entry: after, note: notes.length > 0 ? notes.join("; ") : null, problems };
  } catch (error) {
    return unchanged(error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  const index: { plugins: CatalogEntry[]; revoked: { commit: string; reason: string }[] } = await Bun.file(INDEX_PATH).json();
  const revoked = new Set(index.revoked.map(({ commit }) => commit));
  const results = await Promise.all(index.plugins.map((entry) => synced(entry, revoked)));
  const notes = results.flatMap(({ entry, note }) => (note ? [`- ${entry.name} ${note}`] : []));
  const problems = results.flatMap(({ entry, problems }) => problems.map((problem) => `- ${entry.name}: ${problem}`));
  const text = `${JSON.stringify({ ...index, plugins: results.map(({ entry }) => entry) }, null, 2)}\n`;
  if (text !== (await Bun.file(INDEX_PATH).text())) await Bun.write(INDEX_PATH, text);
  console.log(notes.length > 0 ? notes.join("\n") : "Every plugin is pinned at its newest release, and its page matches its plugin.json.");
  if (problems.length > 0) {
    console.error(`These keep what they had:\n${problems.join("\n")}`);
    process.exit(1);
  }
}

if (import.meta.main) await main();
