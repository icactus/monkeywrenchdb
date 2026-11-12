# Monkey Wrench Database

**Monkey Wrench Database** is a passion project by Isaac Trapkus, bassist with the New York Philharmonic. It provides a platform for synchronized sheet music and recordings, leveraging algorithmic staff detection and manual syncing.

## Origins & Credits

This project is built on a heavily modified core of **SynPdf** by Willem Vree, which is licensed under the GPL. Without his amazing open source project, none of this would be possible.

## License

The source code for this project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. 
This ensures that any modifications or network deployments of this software contribute back to the open source community.

See the [LICENSE](LICENSE) file for details.

### ⚠️ Important: Database Content is Proprietary
The database content (timestamps, sync maps, metadata, SQL dumps) is **NOT** open source. It is proprietary and currently excluded from the AGPL license.
See [DATA_LICENSE](DATA_LICENSE) for usage terms regarding the data.

## Trademarks
The "Monkey Wrench Database" name and logo are trademarks of Isaac Trapkus. You may not use them in a commercial product or service without prior written permission.


## Contributing

Without the help of volunteers, this database will not be able to scale. If you find this project valuable and want to contribute (code fixes, syncing music, or otherwise), I'd love to hear from you.

Contact: **icactusmusic AT gmail DOT com**

### JavaScript dependencies and PDF tests

The website serves its browser libraries directly from the repository, including
PDF.js and its matching worker, jQuery, PDF-lib, and the edit mode ONNX Runtime.
Running or deploying the website requires no npm installation or JavaScript build
step.

Node.js is used for automated JavaScript tests. The PDF passage swapper tests also
use the development dependency `@napi-rs/canvas` to render PDFs outside a browser.
To install that test dependency and run those tests:

```sh
npm ci
npm run test:pdf
```

Other JavaScript tests can be run with `node --test tests/<name>.test.cjs`.
The generated `node_modules/` directory is ignored and should not be committed.

### Static JSON maintenance

Normal recording and measure saves update the affected static JSON automatically.
To rebuild the files after initial setup, recovery, or direct database changes,
run the CLI-only exporter from the repository:

```sh
php scripts/export_static_json.php
```

By default it uses the repository's database configuration and writes to `data/`.
For a separate database configuration and deployed site directory, specify both:

```sh
php scripts/export_static_json.php --config=/path/to/config.php --webroot=/path/to/public_html
```

The exporter is kept out of the deployed web root. Deployment removes the old
public `export_static_json.php` copy. Use `--help` to see all options.

The player uses immutable assets under `data/library/` and shared catalog/part
snapshots. `library-manifest.php` reads a small file-backed pointer; normal page
loads do not rebuild snapshots or query MySQL for this data. The player checks
that pointer using POST to bypass CDN rules that force caching of GET responses.
GET requests also support ETag revalidation.

Deployment builds these snapshots once. After direct database edits, rebuild them
from the repository (normal recording saves, part saves, and live corrections do
this automatically):

```sh
php scripts/rebuild-library-cache.php
# Separate production configuration and site directory:
php scripts/rebuild-library-cache.php --config=/path/to/config.php --webroot=/path/to/public_html
```

Old content hashes remain available so in-flight readers can finish using a
consistent revision. Keep `data/library/` and `phpfiles/cache/library/` writable by
the PHP user. Any CDN rule for `/data/library/` should allow caching JSON and
respect the immutable paths; the manifest freshness check must reach PHP.
