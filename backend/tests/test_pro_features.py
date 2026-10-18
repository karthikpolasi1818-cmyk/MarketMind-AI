import unittest
from datetime import date

from app.api.pro_features import calculate_metrics, quality_report


def rows_from_closes(closes):
    result = []
    for i, close in enumerate(closes):
        result.append({
            "price_date": date(2026, 1, i + 1),
            "open": close,
            "high": close + 1,
            "low": close - 1,
            "close": close,
            "adj_close": close,
            "volume": 1000,
            "source": "test",
            "retrieved_at": None,
        })
    return result


class MarketMindProTests(unittest.TestCase):
    def test_period_return_uses_first_and_last_close(self):
        metrics = calculate_metrics(rows_from_closes([100, 110, 105]), "test")
        self.assertAlmostEqual(metrics["period_return_pct"], 5.0, places=4)
        self.assertEqual(metrics["first_close"], 100)
        self.assertEqual(metrics["latest_close"], 105)

    def test_high_low_and_drawdown(self):
        metrics = calculate_metrics(rows_from_closes([100, 120, 90, 105]), "test")
        self.assertEqual(metrics["period_high"], 120)
        self.assertEqual(metrics["period_low"], 90)
        self.assertLess(metrics["max_drawdown_pct"], 0)

    def test_quality_flags_missing_values(self):
        rows = rows_from_closes([100, 101])
        rows[0]["volume"] = None
        report = quality_report("TEST", "1mo", rows)
        self.assertEqual(report["missing_counts"]["volume"], 1)
        self.assertEqual(report["observations"], 2)
        self.assertGreaterEqual(report["quality_score"], 0)
        self.assertLessEqual(report["quality_score"], 100)

    def test_insufficient_history_is_reported(self):
        with self.assertRaises(ValueError):
            calculate_metrics(rows_from_closes([100]), "test")


if __name__ == "__main__":
    unittest.main()