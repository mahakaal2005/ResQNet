from tracking.kalman_tracker import BBoxDetection, SortTracker, _iou


def _walk_sequence(n_frames: int = 20, start_x: float = 100.0) -> list[list[BBoxDetection]]:
    frames = []
    for i in range(n_frames):
        det = BBoxDetection(
            detection_id=f"DET-{i:03d}",
            drone_id="DRONE-01",
            timestamp=f"t{i}",
            x=start_x + i * 3.0,
            y=200.0 + i * 1.0,
            w=40.0,
            h=40.0,
        )
        frames.append([det])
    return frames


def test_iou_identical_boxes_is_one():
    box = (0.0, 0.0, 10.0, 10.0)
    assert _iou(box, box) == 1.0


def test_iou_non_overlapping_boxes_is_zero():
    assert _iou((0.0, 0.0, 10.0, 10.0), (100.0, 100.0, 10.0, 10.0)) == 0.0


def test_tracking_identity_persists_across_20_frame_sequence_no_id_switches():
    tracker = SortTracker()
    track_ids_seen = []

    for frame in _walk_sequence(20):
        updated = tracker.update(frame)
        track_ids_seen.append(updated[0].track_id)

    assert all(tid is not None for tid in track_ids_seen)
    assert len(set(track_ids_seen)) == 1, f"expected one stable track_id, got {set(track_ids_seen)}"


def test_two_far_apart_detections_get_different_track_ids():
    tracker = SortTracker()
    frame = [
        BBoxDetection("DET-A", "DRONE-01", "t0", x=0.0, y=0.0, w=20.0, h=20.0),
        BBoxDetection("DET-B", "DRONE-01", "t0", x=500.0, y=400.0, w=20.0, h=20.0),
    ]
    updated = tracker.update(frame)

    assert updated[0].track_id != updated[1].track_id


def test_track_dropped_after_max_missed_frames_then_new_id_assigned():
    tracker = SortTracker(max_missed_frames=2)

    first = tracker.update([BBoxDetection("DET-01", "DRONE-01", "t0", 100.0, 100.0, 40.0, 40.0)])
    original_id = first[0].track_id

    tracker.update([])
    tracker.update([])
    tracker.update([])

    reappeared = tracker.update(
        [BBoxDetection("DET-02", "DRONE-01", "t4", 100.0, 100.0, 40.0, 40.0)]
    )

    assert reappeared[0].track_id != original_id


def test_crossing_paths_do_not_swap_identities():
    """Two people crossing paths: greedy nearest-centroid matching would
    likely swap IDs at the crossing point since the other target becomes
    momentarily closer. Kalman prediction + Hungarian assignment on IoU
    should keep each track's own box in its own lane.

    Per-frame displacement (6px) is small relative to box size (30px), as is
    realistic for consecutive video frames -- IoU-based association only
    works when motion is small relative to box size, regardless of how good
    the velocity prediction is (a purely geometric constraint)."""
    tracker = SortTracker()

    # Person A moves left->right, person B moves right->left, crossing near frame 8.
    frames = []
    for i in range(16):
        a = BBoxDetection("A", "DRONE-01", f"t{i}", x=0.0 + i * 6, y=100.0, w=30.0, h=30.0)
        b = BBoxDetection("B", "DRONE-01", f"t{i}", x=100.0 - i * 6, y=100.0, w=30.0, h=30.0)
        frames.append([a, b])

    id_history_a, id_history_b = [], []
    for frame in frames:
        updated = tracker.update(frame)
        by_det_id = {d.detection_id: d for d in updated}
        id_history_a.append(by_det_id["A"].track_id)
        id_history_b.append(by_det_id["B"].track_id)

    # each stays on a single, distinct track_id for the whole sequence
    assert len(set(id_history_a)) == 1
    assert len(set(id_history_b)) == 1
    assert id_history_a[0] != id_history_b[0]
