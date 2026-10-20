# Piece and part requests

`requests.php` lets signed-in users request one piece or individual part every
seven days, with at most two unfinished requests. Composer, piece, and part are
required. A YouTube video link is optional. Google sign-in identifies the requester. Request drafts survive
sign-in, and users see only their own requests and replies.

Users can delete their own requests from My requests after confirming. This
removes the request from both their history and the admin queue, and erases its
content and reply history. Deleting an unfinished request returns the request
allowance immediately and frees an unfinished-request slot. Deleting a finished
request does not reset its seven-day limit.

Administrators open **Request queue** from the account menu, or visit
`requests.php?view=admin`. The default queue shows unfinished requests; use the
filter to see completed requests or all requests. The page checks the current
database role, rather than relying on the role cached at login.

Choose a reply preset, edit the text, and choose the status. **Save reply &
notify** saves the message to the requester's history and creates an unread update.
**Save status only** also creates an update when the status actually changes.
Saving the same status without a reply does not create a notification. Added and
unable to add count as finished. No emails or Gmail drafts are created.

When signed in, users see a bell with the number of requests with unread updates
next to their account menu, plus a count beside **My Requests**. Clicking the bell
opens **Unread updates** and scrolls to the list. Each updated request shows a
**New update** notice with its latest status and date, followed by any replies.
Only notices that enter the viewport are acknowledged; filtered-out requests,
other pages, and updates arriving after the displayed version remain unread.
Acknowledgment is stored per request in the database, so it persists across
logouts, devices, and browsers. Deleted requests do not generate notifications.

## Setup and release

Before publishing the page, create the two InnoDB tables:

```sh
php scripts/setup-requests.php
```

On the production checkout, pass the private database configuration explicitly:

```sh
php scripts/setup-requests.php --config=/home/monkcdmb/phpfiles/config.php
```

The setup script is idempotent and does not modify existing users or catalog data.
Run it again when upgrading an existing installation to add deletion support and the update/seen version columns.
`.cpanel.yml` copies the PHP page, private storage helper, and existing asset
directories. No email configuration or additional Google scopes are needed. Follow the normal deployment workflow after running the migration.

## Verification

```sh
php tests/requests.test.php
node --test tests/homepage-search.test.cjs
```

The PHP suite requires a local database account that can create a disposable
test database. It cleans up that database and its temporary web root, and does
not write to real users or requests. It covers required fields, YouTube URL
validation, Unicode, cooldown and unfinished limits, concurrent submissions,
access control, CSRF, escaping, draft preservation, status changes, reply
history, unread updates, acknowledgment ownership, and stale-page races. Use `--browser` to hold the temporary fixture
open for a browser check, then press Enter to clean up.
