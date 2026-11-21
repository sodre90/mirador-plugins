// Fills each plugin's icon, description, tagline, screenshots and kinds in index.json from the plugin.json of its newest
// release, so a plugin describes itself in one place. A field plugin.json doesn't give, or gives in a form Mirador
// wouldn't show, keeps the catalog's value, and so does every field of a plugin that couldn't be read.

const INDEX_PATH = new URL("../index.json", import.meta.url).pathname;
const GIVE_UP_AFTER_MILLISECONDS = 20_000;
const MAX_ICON_BYTES = 64 * 1024;
const MAX_TAGLINE_LENGTH = 120;
const RELEASE_TAG = /^v(\d+\.\d+\.\d+)$/;
const KINDS = ["app", "canvas"] as const;
const PAGE_FIELDS = ["icon", "description", "tagline", "screenshots", "kinds"] as const;

type Kind = (typeof KINDS)[number];

export interface Screenshot {
  url: string;
  caption: string;
}

export interface CatalogEntry {
  name: string;
  repo: string;
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

/** The newest release tag `git ls-remote --tags --refs` lists, as Mirador would install it; null when there is none. */
export function newestReleaseTag(lsRemoteOutput: string): string | null {
  const tags = lsRemoteOutput.split("\n").flatMap((line) => line.split("refs/tags/")[1]?.trim() ?? []);
  const releases = tags.filter((tag) => RELEASE_TAG.test(tag));
  return releases.sort((one, other) => Bun.semver.order(other.slice(1), one.slice(1)))[0] ?? null;
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

/** The ref the catalog's pictures point at: the branch it follows, or the release Mirador installs. */
async function refOf({ repo, branch }: CatalogEntry): Promise<string | null> {
  if (branch) return branch;
  const listed = await Bun.$`git ls-remote --tags --refs -- ${repo}`.quiet().nothrow();
  if (listed.exitCode !== 0) throw new Error(`git ls-remote failed: ${listed.stderr.toString().trim()}`);
  return newestReleaseTag(listed.stdout.toString());
}

interface Synced {
  entry: CatalogEntry;
  note: string | null;
  problems: string[];
}

async function synced(entry: CatalogEntry): Promise<Synced> {
  const unchanged = (note: string | null, problems: string[] = []): Synced => ({ entry, note, problems });
  try {
    const ref = await refOf(entry);
    if (ref === null) return unchanged("tags no release, so its pictures can't point at one; left as it is");
    const files = rawFilesOf(entry.repo, ref);
    if (files === null) return unchanged("isn't on GitHub, whose raw file addresses the catalog uses; left as it is");
    const response = await load(`${files}plugin.json`);
    if (!response.ok) return unchanged(null, [`its plugin.json at ${ref} answered ${response.status}`]);
    const manifest = await response.json();
    const version = ref.match(RELEASE_TAG)?.[1];
    if (version && manifest.version !== version) return unchanged(null, [`its plugin.json at ${ref} gives version ${manifest.version}, which Mirador refuses`]);
    const problems: string[] = [];
    const after = withPage(entry, await pageAt(files, manifest, problems));
    const changed = changedFields(entry, after);
    return { entry: after, note: changed.length > 0 ? `${ref}: ${changed.join(", ")}` : null, problems };
  } catch (error) {
    return unchanged(null, [error instanceof Error ? error.message : String(error)]);
  }
}

async function main() {
  const index: { plugins: CatalogEntry[] } = await Bun.file(INDEX_PATH).json();
  const results = await Promise.all(index.plugins.map(synced));
  const notes = results.flatMap(({ entry, note }) => (note ? [`- ${entry.name} ${note}`] : []));
  const problems = results.flatMap(({ entry, problems }) => problems.map((problem) => `- ${entry.name}: ${problem}`));
  const text = `${JSON.stringify({ ...index, plugins: results.map(({ entry }) => entry) }, null, 2)}\n`;
  if (text !== (await Bun.file(INDEX_PATH).text())) await Bun.write(INDEX_PATH, text);
  console.log(notes.length > 0 ? notes.join("\n") : "Every plugin's page matches its plugin.json.");
  if (problems.length > 0) {
    console.error(`Couldn't read these, so their entries keep what they had:\n${problems.join("\n")}`);
    process.exit(1);
  }
}

if (import.meta.main) await main();
