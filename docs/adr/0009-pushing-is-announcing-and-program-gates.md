# Pushing is announcing, and the program is gated

The repository is public. Anything pushed to it is public at once, including branches, pull requests, deploy previews and CI logs. So only facts the Organizers have announced go into git.

Program data needs a separate guard. Accepted Sessions appear in the Sessionize API as soon as speakers are notified, which can be weeks before the Organizers announce them. Two flags on each Edition, `speakersPublic` and `schedulePublic`, are flipped by the pull request that makes each announcement. `src/lib/program.ts` is the only code that reads program data. It applies a field allowlist and the gates at fetch time, before anything is written, cached or hashed.

## Consequences

- Pull request and preview builds run on test data with the gates closed. Real data is reviewed from a local build.
- The speakers gate releases Speakers and Session titles and abstracts, with no times or rooms. The schedule gate adds times and rooms. Private CFP questions are never read.
- Early keynote reveals are added as repo content in the pull request that announces them.
- Snapshots of Past Editions go through the same allowlist.
- Tests plant a marker string in unannounced fixture data. It must never appear in the built site, logs, search index or open data.
