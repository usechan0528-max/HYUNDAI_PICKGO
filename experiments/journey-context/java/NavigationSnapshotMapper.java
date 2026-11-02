package journey.experiment;

import ai.pleos.playground.navi.data.DrivingInfo;
import ai.pleos.playground.navi.data.DrivingState;

/** Compile-only read boundary. No navigation requests, destination changes or SDK execution. */
public final class NavigationSnapshotMapper {
    private NavigationSnapshotMapper() {}
    public enum Status { COPIED, NO_DRIVING_INFO, NO_DESTINATION_STATE, INVALID_DURATION }
    // Source docs define duration as seconds from current position to target.
    // Distance docs say "from the start": never expose it as remaining distance.
    public record Snapshot(int estimatedRemainingSeconds, int distanceFromStartMetersRaw,
                           long receivedMonotonicNanos) {}
    public record Result(Status status, Snapshot snapshot) {}

    public static Result copy(DrivingInfo info, long receivedMonotonicNanos) {
        if (info == null) return new Result(Status.NO_DRIVING_INFO, null);
        DrivingState destination = info.getDestination();
        if (destination == null) return new Result(Status.NO_DESTINATION_STATE, null);
        int seconds = destination.getDuration();
        if (seconds < 0) return new Result(Status.INVALID_DURATION, null);
        // Zero does not prove arrival. Receipt does not establish route association or freshness.
        return new Result(Status.COPIED, new Snapshot(seconds, destination.getDistance(),
            receivedMonotonicNanos));
    }
}
