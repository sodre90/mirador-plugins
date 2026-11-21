# Official Mirador plugins

The plugins listed in Plugins… of [Mirador](https://github.com/sodre90/mirador), and offered by its agents when one would help.

`index.json` lists them. Each one lives in a repo of its own, which Mirador clones and builds when the user installs it. Mirador installs the checklist and code review plugins by itself at its first start; they can be removed like any other.

| Plugin | What it does |
| --- | --- |
| [Media](https://github.com/sodre90/mirador-media) | Edit a video or a photo with the agent. |
| [Google Docs](https://github.com/sodre90/mirador-google-docs) | Edit a Google Doc with the agent; changes arrive as suggestions. |
| [NeoManuscript](https://github.com/akanto/neo-manuscript) | A LaTeX and Markdown editor with a live PDF, which the agent edits with you. |
| [GitHub](https://github.com/sodre90/mirador-github) | A workspace's GitHub issues and pull requests in a tab beside the chat. |
| [Jira](https://github.com/sodre90/mirador-jira) | A workspace's Jira issues and sprint board in a tab beside the chat. |
| [Beads](https://github.com/sodre90/mirador-beads-ui) | A workspace's beads in a tab beside the chat. |
| [Delegate](https://github.com/sodre90/mirador-delegate) | Hands easy tasks to another profile, such as a local model. |
| [Race](https://github.com/sodre90/mirador-race) | Several agents race one task, each in a worktree of its own; you take the best work, or combine it. |
| [LiteLLM](https://github.com/sodre90/mirador-litellm) | What you spent through a LiteLLM proxy, in the statusline and a window of its own. |
| [Usage](https://github.com/sodre90/mirador-usage) | Where your conversations could spend fewer tokens, on the context meter with Compact now. |
| [Routines](https://github.com/sodre90/mirador-routines) | Runs a prompt in a workspace on a schedule, each run a conversation of its own. |
| [Spectra Council](https://github.com/akanto/spectra-council) | Several models review your code on their own, then argue out each finding. |
| [Checklist](https://github.com/sodre90/mirador-checklist) | The steps of the agent's work, ticked as they go. Installed with Mirador. |
| [Code review](https://github.com/sodre90/mirador-review) | Code reviews and guided tours of the code flow. Installed with Mirador. |

## Listing a plugin

Add an entry to `index.json`:

- `name`: the `name` in the plugin's `plugin.json`
- `title`: as Plugins… shows it
- `description`: a sentence on what it does
- `recommendWhen`: when an agent should offer it, completing "Recommend it when …"
- `repo`: an https git URL anyone can clone, of a plugin that tags releases

Then run `bun scripts/sync-catalog.ts`. It pins the plugin to its newest release and fills in what the plugin says about itself in that release's `plugin.json`, so its page in Plugins… looks the same before it is installed as after:

- `release` and `commit`: the release Mirador installs, `x.y.z`, and the commit its tag `v<release>` points at (an annotated tag's own commit, not the tag object)
- `icon`: the SVG file its `icon` names, as text; up to 64 KB. Without one, Mirador shows a coloured letter
- `description`: its `description`, in place of the one above
- `tagline`: its `tagline`, one line for its tile in Plugins…; up to 120 characters. Without one, the tile shows the start of `description`
- `kinds`: `"app"`, `"canvas"` or both, as its `app` and `canvas` say, for the badges on its tile
- `screenshots`: each picture its `screenshots` lists, `{ "path", "caption" }`, as `{ "url", "caption" }` with the URL a link to the file at the pinned commit

A field the plugin's `plugin.json` leaves out keeps what the entry has, so for a plugin that doesn't describe itself yet, write those fields here by hand. The script reads GitHub repos only: pin an entry elsewhere by hand.

## Reviewing releases

Mirador installs a catalog plugin only at its pinned commit, and updates it, by itself or when the user agrees, only to the release this catalog pins. A plugin's new release reaches users when this repo's pin moves, not when its maintainer tags it, so this repo is what users trust.

Every morning a workflow runs the script and opens a pull request that moves the pins to the plugins' new releases, each with a link to the code it brings. Read that code before merging: once merged, every Mirador with the plugin installs it, and its host code runs with all of Mirador's access. Read the taglines too: those of plugins a user hasn't installed go into their agents' prompts. After releasing a plugin of your own, start the workflow at once with `gh workflow run sync-catalog.yml`.

When a pinned tag moves to another commit, or disappears, the script keeps the pin and the workflow fails, as that is what a harmful maintainer, or someone holding their GitHub token, would do.

## Revoking a release

To pull back a harmful release that went out, add its commit to `revoked`, with the reason users will read:

```json
"revoked": [{ "commit": "<the full 40-character commit>", "reason": "It sends your files to a server of its own." }]
```

Mirador stops loading a plugin at a revoked commit and tells its users why, and never installs or updates to one; the script never pins one. Pin the plugin to a release that's safe, by hand if no newer one is.

## Releases

A plugin gives its release in its `plugin.json` as `version`, `x.y.z`, and tags each release `v<version>`, such as `v1.2.0`. Mirador refuses a release whose `plugin.json` gives another version than its tag, and it doesn't load a plugin without a version. A plugin installed from outside this catalog follows its repo's newest release tag, or its default branch when it tags none.
