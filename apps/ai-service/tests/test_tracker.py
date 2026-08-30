from tracking.tracker import MAX_MATCH_DISTANCE_PX, Tracker, TrackedDetection


def _synthetic_walk_sequence(n_frames: int = 20) -> list[list[TrackedDetection]]:
    """One person walking a smooth path across 20 frames, small per-frame
    displacement well under MAX_MATCH_DISTANCE_PX -- should never ID-switch."""
    frames = []
    for i in range(n_frames):
        det = TrackedDetection(
            detection_id=f"DET-{i:03d}",
            drone_id="DRONE-01",
            timestamp=f"2026-08-27T10:{30 + i // 60:02d}:{(i * 2) % 60:02d}Z",
            centroid_x=100.0 + i * 3.0,  # small, steady drift per frame
            centroid_y=200.0 + i * 1.0,
        )
        frames.append([det])
    return frames


def test_tracking_identity_persists_across_20_frame_sequence_no_id_switches():
    tracker = Tracker()
    track_ids_seen = []

    for frame in _synthetic_walk_sequence(20):
        updated = tracker.update(frame)
        track_ids_seen.append(updated[0].track_id)

    assert all(tid is not None for tid in track_ids_seen)
    assert len(set(track_ids_seen)) == 1, f"expected one stable track_id, got {set(track_ids_seen)}"


def test_two_far_apart_detections_get_different_track_ids():
    tracker = Tracker()

    frame = [
        TrackedDetection("DET-A", "DRONE-01", "t0", centroid_x=50.0, centroid_y=50.0),
        TrackedDetection("DET-B", "DRONE-01", "t0", centroid_x=500.0, centroid_y=400.0),
    ]
    updated = tracker.update(frame)

    assert updated[0].track_id != updated[1].track_id


def test_track_dropped_after_max_missed_frames_then_new_id_assigned():
    tracker = Tracker(max_missed_frames=2)

    first = tracker.update([TrackedDetection("DET-01", "DRONE-01", "t0", 100.0, 100.0)])
    original_id = first[0].track_id

    # target vanishes for longer than max_missed_frames (empty frames)
    tracker.update([])
    tracker.update([])
    tracker.update([])

    reappeared = tracker.update([TrackedDetection("DET-02", "DRONE-01", "t4", 100.0, 100.0)])

    assert reappeared[0].track_id != original_id


def test_match_distance_threshold_respected():
    tracker = Tracker()
    tracker.update([TrackedDetection("DET-01", "DRONE-01", "t0", 0.0, 0.0)])

    just_outside = MAX_MATCH_DISTANCE_PX + 5
    far_frame = tracker.update(
        [TrackedDetection("DET-02", "DRONE-01", "t1", just_outside, 0.0)]
    )

    # beyond the match radius -> treated as a new track, not the same person
    assert far_frame[0].track_id != "TRACK-0001"
