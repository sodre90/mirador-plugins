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
- `repo`: an https git URL anyone can clone
- `branch` (optional): a branch to install and follow instead of the releases; leave it out for a plugin that tags releases

Then run `bun scripts/sync-catalog.ts`. It reads the `plugin.json` of the plugin's newest release and fills in what the plugin says about itself there, so its page in Plugins… looks the same before it is installed as after:

- `icon`: the SVG file its `icon` names, as text; up to 64 KB. Without one, Mirador shows a coloured letter
- `description`: its `description`, in place of the one above
- `tagline`: its `tagline`, one line for its tile in Plugins…; up to 120 characters. Without one, the tile shows the start of `description`
- `kinds`: `"app"`, `"canvas"` or both, as its `app` and `canvas` say, for the badges on its tile
- `screenshots`: each picture its `screenshots` lists, `{ "path", "caption" }`, as `{ "url", "caption" }` with the URL a link to the file at the release tag, such as `https://raw.githubusercontent.com/sodre90/mirador-media/v1.1.4/screenshots/trimmed-timeline.png`

A field the plugin's `plugin.json` leaves out keeps what the entry has, so for a plugin that doesn't describe itself yet, write those fields here by hand. The script reads GitHub repos only: an entry elsewhere keeps what it has.

Every morning a workflow runs the script and opens a pull request with what the plugins' new releases changed. Read the taglines before merging: those of plugins a user hasn't installed go into their agents' prompts.

## Releases

A plugin gives its release in its `plugin.json` as `version`, `x.y.z`, and tags each release `v<version>`, such as `v1.2.0`. Mirador installs the newest release tag and offers newer ones as updates. It refuses a release whose `plugin.json` gives another version than its tag, and it doesn't load a plugin without a version. A repo that tags no release installs from its default branch.
