package journey.experiment;

import ai.pleos.playground.location.fused.model.LocationData;

/** Compile-only boundary experiment. Does not initialize or run the SDK. */
public final class LocationSnapshotMapper {
    private LocationSnapshotMapper() {}

    // SDK timestamp and confidence remain uninterpreted until their semantics are verified.
    public record Snapshot(double latitude, double longitude, double altitude,
                           float headingRaw, float confidenceRaw,
                           long sdkTimestampMillisRaw, long receivedMonotonicNanos) {}

    public enum Status { COPIED, NO_LOCATION, INVALID_COORDINATES }
    // Snapshot is present only for COPIED. No personal coordinates are logged.
    public record Result(Status status, Snapshot snapshot) {}

    // Caller must capture receivedMonotonicNanos at callback receipt, using one clock domain.
    // Optional raw metadata may be non-finite; consumers must validate before using it.
    public static Result copy(LocationData location, long receivedMonotonicNanos) {
        if (location == null) return new Result(Status.NO_LOCATION, null);
        double latitude = location.getLatitude();
        double longitude = location.getLongitude();
        if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Double.isFinite(longitude) || longitude < -180 || longitude > 180) return new Result(Status.INVALID_COORDINATES, null);
        return new Result(Status.COPIED, new Snapshot(latitude, longitude, location.getAltitude(),
            location.getHeading(), location.getConfidence(), location.getTimestampMillis(),
            receivedMonotonicNanos));
    }
}
