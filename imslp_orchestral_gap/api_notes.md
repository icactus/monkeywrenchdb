# IMSLP API Notes

Use the IMSLP custom API instead of repeated HTML scraping whenever possible.

## Important

- Do not commit the real IMSLP API account token to the repo.
- Put it in `config.json` or an environment variable such as `IMSLP_API_ACCOUNT`.
- Default to a conservative delay. Use 3 seconds between requests unless you have a reason to go slower.

## URL format

The custom API uses path-like segments:

`https://imslp.org/imslpscripts/API.ISCR.php?account=<token>/disclaimer=accepted/type=3/limit=20/sort=modified/retformat=pretty`

Main record types:

- `type=1`: composer records
- `type=2`: work records
- `type=3`: file records

Important fields:

- `id`: record ID
- `parent`: parent ID
- `search`: fulltext search
- `start`: row offset or modified-time condition
- `limit`: max records
- `sort`: sort column, `*modified` for descending modified time
- `metadata=yes`: include query metadata
- `version=<n>`: lock API version

Encoding rules:

- `id`, `parent`, and `search` are base64url-encoded by default.
- `rawinput` disables that encoding for fields after it.
- `search` format before encoding is:
  `search=<type>:<search string>`

Signature support:

- If the account has a password, append `signature=<sha1(query_string_without_signature + password)>`.
- The client script supports that so the password stays out of the URL construction logic.

## Known notes from the earlier IMSLP e-mail exchange

- The API account is different from the normal wiki account.
- Max limit is `1000` items per query.
- Wait between queries.
- For raw wiki text, use the MediaWiki API instead of the custom IMSLP API.

## Recommended strategy

1. Use the custom IMSLP API for bulk listing and metadata when possible.
2. Sleep 3 seconds between API requests.
3. Only hit actual work pages when the API output is not enough.
4. Cache responses to disk so reruns do not repeat the same requests.
