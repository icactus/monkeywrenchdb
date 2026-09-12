import json
import re
import socket
import subprocess
import unittest
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent

_CATALOG = None


def catalog():
    global _CATALOG
    if _CATALOG is None:
        _CATALOG = php_json("fetch_catalog.php")
    return _CATALOG


PART_KEYS = {"metric_arr_id", "instrument_id", "instrument_name", "part_number",
             "instrument_key", "edition_label", "is_score"}
PIECE_KEYS = {"piece_id", "piece_name", "composer_first", "composer_last",
              "category_name", "solo_instrument_id", "recording_count", "parts"}


def php_include(script, get=None):
    get = get or {}
    code = "$_GET = json_decode('%s', true); include %s;" % (
        json.dumps(get), json.dumps(script))
    proc = subprocess.run(["php", "-r", code], cwd=ROOT,
                          capture_output=True, text=True, timeout=120)
    return proc


def php_json(script, get=None):
    proc = php_include(script, get)
    assert proc.returncode == 0, "php %s failed: %s" % (script, proc.stderr[-500:])
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        raise AssertionError("php %s returned non-JSON: %r" % (script, proc.stdout[:300]))


def db_available():
    try:
        data = catalog()
        return isinstance(data, dict) and "pieces" in data
    except Exception:
        return False


class CatalogLiveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not db_available():
            raise unittest.SkipTest("local database unavailable")
        cls.catalog = catalog()

    def test_top_level_shape(self):
        self.assertIn("pieces", self.catalog)
        self.assertIn("instruments", self.catalog)
        self.assertGreater(len(self.catalog["pieces"]), 200)
        self.assertGreater(len(self.catalog["instruments"]), 10)

    def test_piece_and_part_schema(self):
        for piece in self.catalog["pieces"]:
            self.assertTrue(PIECE_KEYS <= set(piece), piece.get("piece_id"))
            self.assertIsInstance(piece["recording_count"], int)
            self.assertGreaterEqual(piece["recording_count"], 0)
            self.assertGreater(len(piece["parts"]), 0)
            for part in piece["parts"]:
                self.assertTrue(PART_KEYS <= set(part), part)
                self.assertIsInstance(part["is_score"], bool)

    def test_instrument_list_is_stable_and_unique(self):
        names = self.catalog["instruments"]
        self.assertEqual(len(names), len(set(names)))
        self.assertTrue(all(name.strip() for name in names))
        again = php_json("fetch_catalog.php")["instruments"]
        self.assertEqual(names, again)

    def test_instruments_exclude_scores(self):
        for name in self.catalog["instruments"]:
            self.assertNotIn("score", name.lower())

    def test_never_embeds_sync_payloads(self):
        raw = subprocess.run(["php", "fetch_catalog.php"], cwd=ROOT,
                             capture_output=True, text=True, timeout=120).stdout
        self.assertNotIn("metric_arr_data", raw)
        self.assertNotIn("times_arr_data", raw)
        self.assertLess(len(raw), 512 * 1024)

    def test_recording_count_matches_recordings_endpoint(self):
        piece = next(p for p in self.catalog["pieces"] if p["recording_count"] > 0)
        rows = php_json("fetchrecordings_data.php", {"pieceId": piece["piece_id"]})
        rows = rows if isinstance(rows, list) else rows.get("recordings", [])
        self.assertEqual(len(rows), piece["recording_count"])


class RecordingsEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not db_available():
            raise unittest.SkipTest("local database unavailable")

    def test_missing_params_returns_error(self):
        data = php_json("fetchrecordings_data.php")
        self.assertIn("error", data)

    def test_unknown_piece_returns_empty_list(self):
        self.assertEqual(php_json("fetchrecordings_data.php", {"pieceId": 999999}), [])

    def test_valid_piece_returns_metadata_only(self):
        cat = catalog()
        piece = next(p for p in cat["pieces"] if p["recording_count"] > 0)
        data = php_json("fetchrecordings_data.php", {"pieceId": piece["piece_id"]})
        rows = data if isinstance(data, list) else data["recordings"]
        self.assertGreater(len(rows), 0)
        for row in rows:
            self.assertIn("recording_id", row)
            self.assertNotIn("times_arr_data", row)
            self.assertNotIn("metric_arr_data", row)


class PieceSearchEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not db_available():
            raise unittest.SkipTest("local database unavailable")
        cat = catalog()
        cls.instrument_id = cat["pieces"][0]["parts"][0]["instrument_id"]

    def test_empty_instrument_ids_returns_empty_list(self):
        self.assertEqual(php_json("fetch_pieces.php"), [])

    def test_garbage_instrument_ids_returns_empty_list(self):
        self.assertEqual(php_json("fetch_pieces.php", {"instrumentIds": "abc"}), [])

    def test_valid_instrument_returns_playable_rows(self):
        data = php_json("fetch_pieces.php", {"instrumentIds": str(self.instrument_id)})
        rows = data if isinstance(data, list) else data.get("pieces", [])
        self.assertGreater(len(rows), 0)
        for row in rows:
            self.assertIn("piece_id", row)
            self.assertIn("metric_arr_id", row)
            self.assertGreater(len(row["parts"]), 0)
            self.assertIn("instrument_name", row["parts"][0])
            self.assertGreaterEqual(int(row.get("total_recordings_value", 0)), 0)


class InstrumentsEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not db_available():
            raise unittest.SkipTest("local database unavailable")

    def test_instrument_groups_shape(self):
        data = php_json("fetchinstruments_data.php")
        groups = data if isinstance(data, list) else list(data.values())
        self.assertGreater(len(groups), 0)


class CatalogHttpHeadersTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = 8139
        try:
            cls.server = subprocess.Popen(
                ["php", "-S", "127.0.0.1:%d" % cls.port, "-t", str(ROOT)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError:
            raise unittest.SkipTest("php built-in server unavailable")
        for _ in range(50):
            try:
                socket.create_connection(("127.0.0.1", cls.port), timeout=0.2).close()
                break
            except OSError:
                import time
                time.sleep(0.1)
        else:
            cls.server.terminate()
            raise unittest.SkipTest("php built-in server did not start")

    @classmethod
    def tearDownClass(cls):
        cls.server.terminate()
        cls.server.wait(timeout=10)

    def test_catalog_serves_json_with_private_cache(self):
        with urllib.request.urlopen(
                "http://127.0.0.1:%d/fetch_catalog.php" % self.port, timeout=60) as res:
            self.assertIn("application/json", res.headers.get("Content-Type", ""))
            cache = res.headers.get("Cache-Control", "")
            self.assertIn("private", cache)
            self.assertIn("max-age=300", cache)
            body = json.load(res)
        self.assertIn("pieces", body)


class HomepageWiringTests(unittest.TestCase):
    def src(self, name):
        return (ROOT / name).read_text()

    def test_homepage_php_provides_every_id_the_js_expects(self):
        php = self.src("homepage.php")
        for name in set(re.findall(r"\$\('([a-z-]+)'\)", self.src("js/homepage.js"))):
            self.assertIn('id="study-%s"' % name, php, "study-" + name)

    def test_player_dropdown_lives_in_player_dom(self):
        self.assertIn("recordings-dropdown",
                      self.src("index.php") + self.src("stripped-synpdf.js"))

    def test_index_wires_homepage_module(self):
        index = self.src("index.php")
        self.assertIn("homepage.php", index)
        self.assertIn("js/homepage.js", index)
        self.assertIn("assets/css/homepage.css", index)
        self.assertIn("fetch_catalog.php", self.src("js/homepage.js"))


if __name__ == "__main__":
    unittest.main()
