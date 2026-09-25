# A shared design foundation that any site may leave

KCD Texas, Cloud Native Texas and a Cloud Native Austin site are planned as one family with three faces. They share a design foundation (colors, type, spacing, basic components), and each keeps its own personality. For now, the foundation sits in its own folder in this repository with no KCD-specific logic. When the second site starts, it moves into a small versioned package.

Each site owns its repository and its choice. It can stay on an old version, override any value, or copy the code in and leave, without asking the other sites.

## Considered Options

- **One repository for all three sites.** The most sharing, but it mixes permissions and blurs ownership between communities.
- **Fully independent copies.** The simplest option, but the designs drift and every fix is made three times.
