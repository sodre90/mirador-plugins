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
- `icon` (optional): the plugin's icon as SVG text, the same as the `icon.svg` its `plugin.json` names; up to 64 KB. Without one, Mirador shows a coloured letter
- `tagline` (optional): one line on what the plugin does, for its tile in Plugins…; up to 120 characters. Without one, the tile shows the start of `description`
- `kinds` (optional): what the plugin's `plugin.json` brings, `"app"`, `"canvas"` or both, so its tile shows the same badges before it is installed as after
- `screenshots` (optional): pictures of the plugin at work for its page in Plugins…, each `{ "url", "caption" }`, with the URL an https link to a file of the plugin's repo at a release tag, such as `https://raw.githubusercontent.com/sodre90/mirador-media/v1.1.3/screenshots/trimmed-timeline.png`

## Releases

A plugin gives its release in its `plugin.json` as `version`, `x.y.z`, and tags each release `v<version>`, such as `v1.2.0`. Mirador installs the newest release tag and offers newer ones as updates. It refuses a release whose `plugin.json` gives another version than its tag, and it doesn't load a plugin without a version. A repo that tags no release installs from its default branch.
