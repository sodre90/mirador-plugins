import { describe, expect, test } from "bun:test";
import { changedFields, chosenPin, compareUrl, pageAt, pathInside, rawFilesOf, releaseCommits, withPage, withPin, type CatalogEntry, type PluginPage } from "./sync-catalog.ts";

const FILES = "https://raw.githubusercontent.com/someone/plugin/v1.2.0/";
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>\n';

const entry: CatalogEntry = {
  name: "plugin",
  title: "Plugin",
  description: "The catalog's description.",
  tagline: "The catalog's tagline.",
  kinds: ["canvas"],
  recommendWhen: "the user wants it",
  repo: "https://github.com/someone/plugin.git",
  icon: "<svg/>",
  screenshots: [{ url: "https://raw.githubusercontent.com/someone/plugin/v1.0.0/old.png", caption: "Old" }],
};

const nothing: PluginPage = { icon: null, description: null, tagline: null, screenshots: null, kinds: null };

/** Answers as a repo whose files are `files`, each path's text or content type. */
const repoWith =
  (files: Record<string, { text?: string; type?: string }>) =>
  async (url: string): Promise<Response> => {
    const file = files[url.slice(FILES.length)];
    return file ? new Response(file.text ?? "", { headers: { "content-type": file.type ?? "text/plain" } }) : new Response("", { status: 404 });
  };

const [A, B, C, D] = ["a".repeat(40), "b".repeat(40), "c".repeat(40), "d".repeat(40)];

describe("releaseCommits", () => {
  test("takes an annotated tag's peeled commit, not the tag object, and leaves out tags that aren't releases", () => {
    const listed = [`${A}\trefs/tags/v0.3.3`, `${B}\trefs/tags/v0.3.3^{}`, `${C}\trefs/tags/v0.4.0`, `${D}\trefs/tags/nightly`, `${D}\trefs/tags/v0.5.0-rc1`, ""].join("\n");
    expect(releaseCommits(listed)).toEqual(new Map([["0.3.3", B], ["0.4.0", C]]));
  });
});

describe("chosenPin", () => {
  const commits = new Map([["0.9.0", A], ["0.10.0", B]]);

  test("pins the newest release when nothing is pinned yet", () => {
    expect(chosenPin(null, commits, new Set())).toEqual({ pin: { release: "0.10.0", commit: B }, problem: null });
  });

  test("moves the pin to a newer release", () => {
    expect(chosenPin({ release: "0.9.0", commit: A }, commits, new Set())).toEqual({ pin: { release: "0.10.0", commit: B }, problem: null });
  });

  test("keeps the pin when nothing newer is out", () => {
    expect(chosenPin({ release: "0.10.0", commit: B }, commits, new Set())).toEqual({ pin: { release: "0.10.0", commit: B }, problem: null });
  });

  test("refuses to move on when the pinned tag now points at another commit", () => {
    expect(chosenPin({ release: "0.9.0", commit: C }, commits, new Set())).toEqual({ pin: null, problem: `v0.9.0 now points at ${A}, not the pinned ${C}; the pin stays` });
  });

  test("refuses to move on when the pinned tag is gone", () => {
    expect(chosenPin({ release: "0.8.0", commit: C }, commits, new Set()).problem).toBe("v0.8.0 is gone from the repo; the pin stays");
  });

  test("never pins a revoked commit", () => {
    expect(chosenPin({ release: "0.9.0", commit: A }, commits, new Set([B]))).toEqual({ pin: { release: "0.9.0", commit: A }, problem: null });
  });

  test("says so when the pinned commit is revoked and nothing newer can replace it", () => {
    expect(chosenPin({ release: "0.10.0", commit: B }, commits, new Set([B])).problem).toBe("the pinned v0.10.0 is revoked and no newer release is; pin an earlier one by hand");
  });

  test("says so when the repo tags no release", () => {
    expect(chosenPin(null, new Map(), new Set()).problem).toBe("tags no release to pin");
  });
});

describe("withPin", () => {
  test("puts release and commit right after the repo, replacing the old pin", () => {
    const pinned = withPin({ ...entry, release: "1.0.0", commit: A }, { release: "1.1.0", commit: B });
    const fields = Object.keys(pinned);
    expect(fields.slice(fields.indexOf("repo"), fields.indexOf("repo") + 3)).toEqual(["repo", "release", "commit"]);
    expect(pinned).toMatchObject({ release: "1.1.0", commit: B });
  });
});

test("compareUrl links what a bump brings", () => {
  expect(compareUrl("https://github.com/someone/plugin.git", A, B)).toBe(`https://github.com/someone/plugin/compare/${A}...${B}`);
});

describe("rawFilesOf", () => {
  test("gives a GitHub repo's raw address at the ref, with or without .git", () => {
    expect(rawFilesOf("https://github.com/someone/plugin.git", "v1.2.0")).toBe(FILES);
    expect(rawFilesOf("https://github.com/someone/plugin", "v1.2.0")).toBe(FILES);
  });

  test("is null for a repo elsewhere", () => {
    expect(rawFilesOf("https://gitlab.com/someone/plugin.git", "v1.2.0")).toBeNull();
  });
});

describe("pathInside", () => {
  test("drops a leading ./ and refuses paths that leave the folder", () => {
    expect(pathInside("./screenshots/a.png")).toBe("screenshots/a.png");
    expect(pathInside("../elsewhere.png")).toBeNull();
    expect(pathInside("/etc/passwd")).toBeNull();
    expect(pathInside(42)).toBeNull();
  });
});

describe("pageAt", () => {
  test("reads the icon file, the texts, the kinds and each picture's address at the release", async () => {
    const problems: string[] = [];
    const manifest = {
      icon: "icon.svg",
      description: "What it does.",
      tagline: "One line.",
      canvas: { host: "host.ts", view: "view.js" },
      screenshots: [{ path: "./screenshots/at-work.png", caption: "At work" }],
    };
    const page = await pageAt(FILES, manifest, problems, repoWith({ "icon.svg": { text: ICON }, "screenshots/at-work.png": { type: "image/png" } }));
    expect(page).toEqual({
      icon: ICON.trim(),
      description: "What it does.",
      tagline: "One line.",
      screenshots: [{ url: `${FILES}screenshots/at-work.png`, caption: "At work" }],
      kinds: ["canvas"],
    });
    expect(problems).toEqual([]);
  });

  test("gives nothing for fields Mirador wouldn't show: a long tagline, a blank description, a non-SVG icon, a picture without caption", async () => {
    const manifest = { icon: "icon.png", description: " ", tagline: "x".repeat(121), screenshots: [{ path: "a.png" }] };
    expect(await pageAt(FILES, manifest, [], repoWith({}))).toEqual(nothing);
  });

  test("keeps the catalog's pictures when any listed one isn't an image there, and says which", async () => {
    const problems: string[] = [];
    const manifest = {
      screenshots: [
        { path: "a.png", caption: "A" },
        { path: "missing.png", caption: "Missing" },
      ],
    };
    const page = await pageAt(FILES, manifest, problems, repoWith({ "a.png": { type: "image/png" } }));
    expect(page.screenshots).toBeNull();
    expect(problems).toEqual([`${FILES}missing.png answered 404`]);
  });

  test("keeps the catalog's icon when the file plugin.json names can't be fetched", async () => {
    const problems: string[] = [];
    expect((await pageAt(FILES, { icon: "icon.svg" }, problems, repoWith({}))).icon).toBeNull();
    expect(problems).toEqual(["its icon icon.svg answered 404"]);
  });
});

describe("withPage", () => {
  test("takes what plugin.json gives and keeps the rest, each field where it was", () => {
    const after = withPage(entry, { ...nothing, tagline: "A new tagline.", kinds: ["app", "canvas"] });
    expect(Object.keys(after)).toEqual(Object.keys(entry));
    expect(after).toEqual({ ...entry, tagline: "A new tagline.", kinds: ["app", "canvas"] });
    expect(changedFields(entry, after)).toEqual(["tagline", "kinds"]);
  });

  test("adds a field the catalog didn't have at the end", () => {
    const { screenshots: _, ...withoutPictures } = entry;
    const pictures = [{ url: `${FILES}a.png`, caption: "A" }];
    const after = withPage(withoutPictures, { ...nothing, screenshots: pictures });
    expect(Object.keys(after).at(-1)).toBe("screenshots");
    expect(after.screenshots).toEqual(pictures);
  });

  test("changes nothing when plugin.json gives nothing", () => {
    expect(withPage(entry, nothing)).toEqual(entry);
  });
});
