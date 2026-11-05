"""Render the real PHP shell to verify search metadata without a database."""
import json
import subprocess
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class MetadataParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.titles = []
        self.meta = {}
        self.canonicals = []
        self.structured_data = []
        self.excluded_ids = set()
        self._title = None
        self._json = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self._title = ""
        if tag == "meta":
            self.meta[attrs.get("name") or attrs.get("property")] = attrs.get("content")
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs["href"])
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self._json = ""
        if "data-nosnippet" in attrs and attrs.get("id"):
            self.excluded_ids.add(attrs["id"])

    def handle_data(self, data):
        if self._title is not None:
            self._title += data
        if self._json is not None:
            self._json += data

    def handle_endtag(self, tag):
        if tag == "title" and self._title is not None:
            self.titles.append(self._title)
            self._title = None
        if tag == "script" and self._json is not None:
            self.structured_data.append(json.loads(self._json))
            self._json = None


def render(host="monkeywrenchdb.org", overrides=None, query=None, https=True):
    values = {
        "_SERVER": {"HTTP_HOST": host, "REMOTE_ADDR": "127.0.0.1", "SERVER_PORT": "443" if https else "80", "HTTPS": "on" if https else "off"},
        "_GET": query or {},
        **(overrides or {}),
    }
    encoded = json.dumps(values, ensure_ascii=True)
    code = "$values = json_decode(" + json.dumps(encoded) + ", true); extract($values); include 'index.php';"
    result = subprocess.run(["php", "-r", code], cwd=ROOT, capture_output=True, text=True, check=True, timeout=15)
    parser = MetadataParser()
    parser.feed(result.stdout)
    return parser


class PageMetadataTests(unittest.TestCase):
    def test_homepage_title_and_description_explain_the_product(self):
        page = render()
        self.assertEqual(len(page.titles), 1)
        self.assertTrue(page.titles[0].startswith("Monkey Wrench Database |"))
        self.assertIn("Sheet Music Synced with YouTube", page.titles[0])
        for phrase in ["Free sheet music", "YouTube performances", "instrumental parts", "measure", "recordings"]:
            self.assertIn(phrase, page.meta["description"])
        self.assertEqual(page.meta["description"], page.meta["og:description"])
        self.assertEqual(page.meta["og:title"], page.titles[0])

    def test_homepage_aliases_and_tracking_queries_use_one_canonical(self):
        for host in ["monkeywrenchdb.org", "www.monkeywrenchdb.org"]:
            for https in [True, False]:
                with self.subTest(host=host, https=https):
                    page = render(host=host, https=https, query={"no_track": "1"})
                    self.assertEqual(page.canonicals, ["https://monkeywrenchdb.org/"])
                    self.assertEqual(page.meta["og:url"], page.canonicals[0])
                    self.assertEqual(page.structured_data[0]["url"], page.canonicals[0])

    def test_site_name_is_valid_structured_data_on_the_homepage(self):
        page = render()
        self.assertEqual(len(page.structured_data), 1)
        site = page.structured_data[0]
        self.assertEqual(site["@type"], "WebSite")
        self.assertEqual(site["@context"], "https://schema.org")
        self.assertEqual(site["name"], "Monkey Wrench Database")
        self.assertEqual(site["name"], page.meta["og:site_name"])
        self.assertEqual(site["name"], page.meta["application-name"])

    def test_catalog_and_dialogs_cannot_become_search_snippets(self):
        page = render()
        self.assertTrue({"study-home", "about", "help", "history-modal", "favorites-modal", "sidecontent"} <= page.excluded_ids)
        self.assertNotIn("noindex", page.meta.get("robots", ""))
        self.assertNotIn("nosnippet", page.meta.get("robots", ""))

    def test_piece_metadata_survives_shell_rendering_and_html_escaping(self):
        title = 'Dvořák - "Rusalka" & </title><script>alert(1)</script> | Monkey Wrench Database'
        description = 'Follow Dvořák’s "Rusalka" & compare performances.'
        canonical = "https://monkeywrenchdb.org/piece/dvorak-rusalka"
        page = render(overrides={"pageTitle": title, "metaDescription": description, "canonicalUrl": canonical, "seoLandingConfig": {"pieceId": 1}})
        self.assertEqual(page.titles, [title])
        self.assertEqual(page.meta["description"], description)
        self.assertEqual(page.meta["og:title"], title)
        self.assertEqual(page.canonicals, [canonical])
        self.assertEqual(page.structured_data, [], "piece pages must not replace their identity with homepage site-name markup")


if __name__ == "__main__":
    unittest.main()
