# Recording sync credit

The score is the sum of `measures_synced`: one point for each entry in a
recording's primary `times_arr_data`, including time zero and every repeat
occurrence. It does not count distinct `mix` values or add a per-recording bonus.
Alternate timing arrays are reported for review and never added to the primary
array's count. A malformed or empty primary array blocks the whole backfill
until reviewed. No timing data is rewritten by the backfill.

## Setup and historical credit

Run the CLI script from the repository checkout. It uses `phpfiles/config.php`
unless a different configuration is supplied. Both the migration and backfill
are rerunnable. Applying also creates the contribution table if needed.

First identify the owner's user ID and the highest historical recording ID:

```sql
SELECT id, name FROM users WHERE role = 'admin';
SELECT MAX(recording_id) FROM recordings;
```

Fix the cutoff at the historical maximum so later reruns cannot claim new
recordings for the historical owner. Dry runs do not create tables or credits:

```bash
php scripts/backfill-recording-sync-contributions.php --user-id=1 --through-recording-id=651
```

The local November 2026 snapshot has 622 recordings through ID 651, totaling
575,151 measures. Apply the reviewed backfill:

```bash
php scripts/backfill-recording-sync-contributions.php --user-id=1 --through-recording-id=651 --apply
```

These IDs/counts describe the local snapshot. Audit the target database before
using them elsewhere. Overrides are accepted only for malformed primary timings;
each requires a positive count and an explanation stored in `audit_note`.
Legacy `contributed_at` stays NULL because original submission dates are unknown.

For a production checkout, add
`--config=/home/monkcdmb/phpfiles/config.php`. Apply the migration/backfill
**before** deploying the changed submit and timing update handlers. The standalone
SQL migration is `docs/migrations/2026-11-recording-sync-contributions.sql`.
The new private helper is included in `.cpanel.yml`.

The November 2 production audit has 635 recordings through ID 667, totaling
587,603 playback-order entries:

```bash
php scripts/backfill-recording-sync-contributions.php --config=/home/monkcdmb/phpfiles/config.php --user-id=1 --through-recording-id=667 --apply
```

Before backfilling production, recording 249 (Beethoven Op. 131, American String
Quartet, 2013) was repaired at the owner's request. Its primary timing field had
two 1,581-entry JSON arrays joined by an apostrophe. All measure indices matched;
three timestamps differed. The second array was retained byte for byte in both
the database and `data/times/249.json`, locally and in production. A complete
production database backup was downloaded before this repair. No count override
is needed after the repair.

## Submission and correction behavior

`mwSyncSubmitRecording()` derives the count from validated timing JSON and takes
the submitting user ID from the authenticated handler. The current dispatcher
continues to require an administrator; a future public page can use the same
helper after its own authentication and submission checks.

The recording and contribution are saved in one transaction. Submissions of the
same YouTube ID for the same piece are serialized: an identical retry by its
owner returns the existing recording; other duplicate submissions are rejected.
The same video may cover different pieces. The contribution table's recording
primary key also prevents awarding an existing recording again.

`mwSyncUpdateRecording()` updates timings and the original contributor's count in
one transaction. Corrections replace the count, retain authorship and dates, and
cannot undo revocation. Older recordings without a credit are not automatically
claimed by the correcting user. Removing a recording or replacing an unavailable
video does not erase its historical credit.

To revoke invalid credit, use `mwSyncRevokeRecordingCredit()` with a reason. The
stored count and authorship remain available for audit, and the cache is refreshed.

## Admin leaderboard

The leaderboard opens in a popup from the desktop and mobile Admin menus, like
Help and About. The page embeds its rows from a private JSON file, so opening or
reopening the popup performs no network request and no database query. Ties share
a rank (1, 1, 3); user ID provides stable ordering within ties. Empty display
names fall back to `User ID`, and revoked credits are excluded. Tier visuals and
secondary metrics are deferred.

`phpfiles/cache/recording-leaderboard.json` is generated after committed recording
submissions, timing corrections, backfills and credit revocations. Display name
changes at sign-in also refresh it. Writers serialize with a file lock and query
the latest committed scores after taking the lock, then publish the complete JSON
with an atomic rename. Failed rebuilds preserve the previous file. Cache files
are private, generated at runtime and excluded from Git.

Create the initial snapshot before deploying the popup, or rebuild after manual
SQL changes (including user deletion/role changes):

```bash
php scripts/rebuild-leaderboard-cache.php
# Production checkout:
php scripts/rebuild-leaderboard-cache.php --config=/home/monkcdmb/phpfiles/config.php
```

The authenticated `leaderboard-data.php` endpoint remains only for the explicit
retry button if page rendering could not read the cache. It validates the current
database role but reads all scores from the JSON file; it never aggregates them.
The popup shows the snapshot loaded with the page until that page is reloaded.

The underlying all-time score query is:

```sql
SELECT c.user_id, u.name, SUM(c.measures_synced) AS score
FROM recording_sync_contributions c
JOIN users u ON u.id = c.user_id
WHERE c.revoked_at IS NULL
GROUP BY c.user_id, u.name
ORDER BY score DESC, c.user_id ASC;
```

`measures_synced` uses BIGINT UNSIGNED; totals are derived from contributions
rather than maintaining a second user counter.

## Validation

```bash
php tests/recording-sync-contributions.test.php
node --test tests/yubsync-submit.test.cjs
```
