# Piece and part requests

`requests.php` lets signed-in users request one piece or individual part every
seven days, with at most two unfinished requests. Composer, piece, and part are
required. A YouTube video link is optional. Google sign-in identifies the requester. Request drafts survive
sign-in, and users see only their own requests and replies.

The primary super user has unlimited submissions, with no weekly cooldown or
unfinished-request cap. This uses the current database administrator role and
`MW_SUPER_ADMIN_USER_ID` (defaults to user ID 1), matching the PDF upload queue;
it does not depend on an email address. Other administrators retain normal limits.

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
unable to add count as finished. Administrator replies and status changes notify
the requester on-site.

Requesters can use **Send reply** under each of their requests to answer questions
or provide more details. Both sides see the conversation with each author labeled.
Replies do not consume a request allowance or change its status, and remain
available on completed requests. Only the owner can post as the requester.

When signed in, users see a bell with the number of requests with unread updates
next to their account menu, plus a count beside **My Requests**. Clicking the bell
opens **Unread updates** and scrolls to the list. Each updated request shows a
**New update** notice with its latest status and date, followed by any replies.
Only notices that enter the viewport are acknowledged; filtered-out requests,
other pages, and updates arriving after the displayed version remain unread.
Acknowledgment is stored per request in the database, so it persists across
logouts, devices, and browsers. Deleted requests do not generate notifications.

Administrators also see new incoming requests and requester replies in the same
bell. The bell opens **New requests & replies** in the admin queue; a separate
count appears beside **Request queue**. Viewing an incoming notice clears it for
that administrator only, across sessions and devices. Filtered-out requests stay
unread. Requests submitted by the administrator, deleted requests, and requests
already in progress or finished are excluded unless they have unread requester
replies. Acknowledgments cover only the displayed version, so a newer reply stays
unread. Personal request updates continue to use **My Requests** and are available
from the bell after incoming requests
have been viewed. These are site indicators only; no push permission is requested.

Each successfully submitted new request or requester reply also sends an email to
`icactusmusic@gmail.com`, including the requester, composer, piece, part, optional
YouTube recording, reply text when applicable, and a link to the administrator
queue. Email is sent through PHP's `mail()` using `requests@monkeywrenchdb.org`
as the sender. Rejected or
duplicate submissions do not send email. A mail failure is logged without
interrupting the saved request or its on-site notification.

## Setup and release

Before publishing the page, create the request and notification InnoDB tables:

```sh
php scripts/setup-requests.php
```

On the production checkout, pass the private database configuration explicitly:

```sh
php scripts/setup-requests.php --config=/home/monkcdmb/phpfiles/config.php
```

The setup script is idempotent and does not modify existing users or catalog data.
Run it again when upgrading an existing installation to add deletion support,
notification versions, requester reply authorship, and administrator view receipts.
Run this migration before deploying the new PHP files. It preserves existing
administrator replies and read receipts.
`.cpanel.yml` copies the PHP page, private storage helper, and existing asset
directories. The server must provide a working PHP `mail()` transport for incoming
request emails; no additional Google scopes are needed. Follow the normal
deployment workflow after running the migration.

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
history, requester replies, super user quota exemptions, captured email delivery
and failures, unread updates, acknowledgment ownership, and stale-page races. No
real emails are sent by the tests. Use `--browser` to hold the temporary fixture
open for a browser check, then press Enter to clean up.
