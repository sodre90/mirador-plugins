# Official Mirador plugins

The plugins listed in Settings → Plugins of [Mirador](https://github.com/sodre90/mirador), and offered by its agents when one would help.

`index.json` lists them. Each one lives in a repo of its own, which Mirador clones and builds when the user installs it. The ones marked `comesWithMirador` ship with Mirador and need no install.

| Plugin | What it does |
| --- | --- |
| [Media](https://github.com/sodre90/mirador-media) | Edit a video or a photo with the agent. |
| [Google Docs](https://github.com/sodre90/mirador-google-docs) | Edit a Google Doc with the agent; changes arrive as suggestions. |
| Checklist | The steps of the agent's work, ticked as they go. Comes with Mirador. |
| Code review | Code reviews and guided tours of the code flow. Comes with Mirador. |

## Listing a plugin

Add an entry to `index.json`:

- `name`: the `name` in the plugin's `plugin.json`
- `title`: as Settings shows it
- `description`: a sentence on what it does
- `recommendWhen`: when an agent should offer it, completing "Recommend it when …"
- `repo`: an https git URL anyone can clone
- `branch` (optional): the branch to install; otherwise the repo's default branch
