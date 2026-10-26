# Official Mirador plugins

The plugins listed in Settings → Plugins of [Mirador](https://github.com/sodre90/mirador), and offered by its agents when one would help.

`index.json` lists them. Each one lives in a repo of its own, which Mirador clones and builds when the user installs it. Mirador installs the checklist and code review plugins by itself at its first start; they can be removed like any other.

| Plugin | What it does |
| --- | --- |
| [Media](https://github.com/sodre90/mirador-media) | Edit a video or a photo with the agent. |
| [Google Docs](https://github.com/sodre90/mirador-google-docs) | Edit a Google Doc with the agent; changes arrive as suggestions. |
| [Checklist](https://github.com/sodre90/mirador-checklist) | The steps of the agent's work, ticked as they go. Installed with Mirador. |
| [Code review](https://github.com/sodre90/mirador-review) | Code reviews and guided tours of the code flow. Installed with Mirador. |

## Listing a plugin

Add an entry to `index.json`:

- `name`: the `name` in the plugin's `plugin.json`
- `title`: as Settings shows it
- `description`: a sentence on what it does
- `recommendWhen`: when an agent should offer it, completing "Recommend it when …"
- `repo`: an https git URL anyone can clone
- `branch` (optional): a branch to install and follow instead of the releases; leave it out for a plugin that tags releases

## Releases

A plugin gives its release in its `plugin.json` as `version`, `x.y.z`, and tags each release `v<version>`, such as `v1.2.0`. Mirador installs the newest release tag and offers newer ones as updates. It refuses a release whose `plugin.json` gives another version than its tag, and it doesn't load a plugin without a version. A repo that tags no release installs from its default branch.
