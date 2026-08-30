from validation.ground_truth import GroundTruthCase, score_against_ground_truth, summarize


def test_exact_match_has_zero_error_and_is_within_reported_error():
    truth = GroundTruthCase("DET-01", expected_latitude=10.0, expected_longitude=20.0)
    result = score_against_ground_truth(10.0, 20.0, reported_error_m=5.0, truth=truth)

    assert result.error_m == 0.0
    assert result.within_reported_error is True


def test_large_actual_error_flagged_as_miscalibrated():
    truth = GroundTruthCase("DET-01", expected_latitude=10.0, expected_longitude=20.0)
    # ~1.1 degrees off ~= well over 100km, reported error is tiny
    result = score_against_ground_truth(11.0, 20.0, reported_error_m=5.0, truth=truth)

    assert result.error_m > 100_000
    assert result.within_reported_error is False


def test_summarize_empty_results():
    assert summarize([]) == {
        "count": 0,
        "mean_error_m": 0.0,
        "max_error_m": 0.0,
        "calibration_rate": 0.0,
    }


def test_summarize_computes_mean_max_and_calibration_rate():
    truth = GroundTruthCase("DET-01", expected_latitude=0.0, expected_longitude=0.0)
    good = score_against_ground_truth(0.0, 0.0, reported_error_m=5.0, truth=truth)
    bad = score_against_ground_truth(1.0, 0.0, reported_error_m=5.0, truth=truth)

    summary = summarize([good, bad])

    assert summary["count"] == 2
    assert summary["calibration_rate"] == 0.5
    assert summary["max_error_m"] > summary["mean_error_m"]
