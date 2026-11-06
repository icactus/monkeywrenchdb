"""Run the real metadata SELECTs against a small, isolated relational fixture."""
import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class OptionalInstrumentGroupsTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.addCleanup(self.db.close)
        self.db.executescript('''
            CREATE TABLE pieces(piece_id, piece_name, solo_instrument_id, composer_id, category_id);
            CREATE TABLE composers(composer_id, composer_first, composer_last);
            CREATE TABLE piece_categories(category_id, category_name);
            CREATE TABLE instruments(instrument_id, instrument_name, part_number, instrument_key, instrument_group_id);
            CREATE TABLE instrument_group(instrument_group_id, instrument_group_name, instrument_group_order);
            CREATE TABLE metric_arr(metric_arr_id, piece_id, instrument_id, edition_label);
            CREATE TABLE recordings(recording_id, piece_id);
            INSERT INTO pieces VALUES(107, 'Concerto No.2', 72, 1, 1);
            INSERT INTO composers VALUES(1, 'Giovanni', 'Bottesini');
            INSERT INTO piece_categories VALUES(1, 'Concerto');
            INSERT INTO instrument_group VALUES(1, 'Strings', 3), (5, 'Scores', 1), (8, 'Keyboard', 2);
            INSERT INTO instruments VALUES
                (72, 'Double Bass', 'Solo', '', 1),
                (39, 'Orchestra Full Score', NULL, '', 5),
                (50, 'Piano', NULL, '', 8),
                (83, 'Manuscript', 'Piano', '', NULL),
                (84, 'Manuscript', 'Double Bass', '', 999);
            INSERT INTO metric_arr VALUES
                (296, 107, 72, NULL), (297, 107, 39, NULL), (298, 107, 50, NULL),
                (299, 107, 83, NULL), (300, 107, 84, 'Autograph');
            INSERT INTO recordings VALUES(197, 107), (198, 107);
        ''')

    def query(self, filename, method, parameters=()):
        source = (ROOT / filename).read_text()
        sql = re.search(r'->' + method + r'\(\s*"(.*?)"\s*\)', source, re.S).group(1)
        return self.db.execute(sql, parameters).fetchall()

    def test_player_includes_piano_manuscript_for_every_recording(self):
        for recording in (197, 198):
            rows = self.query('get_recording_instruments.php', 'prepare', (recording,))
            manuscript = next(row for row in rows if row['instrument_id'] == 83)
            self.assertEqual(manuscript['metric_arr_id'], 299)
            self.assertEqual(manuscript['part_number'], 'Piano')

    def test_grouped_parts_keep_their_order_and_ungrouped_parts_follow(self):
        rows = self.query('get_recording_instruments.php', 'prepare', (197,))
        self.assertEqual([row['instrument_id'] for row in rows], [72, 39, 50, 83, 84])

    def test_catalog_keeps_standard_piano_and_manuscript_as_distinct_parts(self):
        rows = self.query('fetch_catalog.php', 'query')
        self.assertEqual({row['metric_arr_id'] for row in rows}, {296, 297, 298, 299, 300})
        self.assertTrue(all(row['recording_count'] == 2 for row in rows))

    def test_unknown_group_id_does_not_hide_a_valid_instrument(self):
        rows = self.query('fetch_catalog.php', 'query')
        manuscript = next(row for row in rows if row['instrument_id'] == 84)
        self.assertEqual(manuscript['edition_label'], 'Autograph')


if __name__ == '__main__':
    unittest.main()
