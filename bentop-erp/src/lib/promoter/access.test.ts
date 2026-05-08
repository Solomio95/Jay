import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertPromoterLocationAllowed,
  getAllowedPromoterLocationIds,
} from "./access";

describe("getAllowedPromoterLocationIds", () => {
  it("returns only the default location when temporary locations are expired", () => {
    const allowedLocationIds = getAllowedPromoterLocationIds({
      now: new Date("2026-05-05T12:00:00.000Z"),
      defaultLocationId: "location-default",
      temporaryLocations: [
        {
          locationId: "location-expired",
          startsAt: new Date("2026-05-01T00:00:00.000Z"),
          endsAt: new Date("2026-05-04T23:59:59.999Z"),
        },
      ],
    });

    assert.deepEqual(allowedLocationIds, ["location-default"]);
  });

  it("includes temporary cover locations when now is within startsAt and endsAt", () => {
    const allowedLocationIds = getAllowedPromoterLocationIds({
      now: new Date("2026-05-05T12:00:00.000Z"),
      defaultLocationId: "location-default",
      temporaryLocations: [
        {
          locationId: "location-cover",
          startsAt: new Date("2026-05-05T00:00:00.000Z"),
          endsAt: new Date("2026-05-05T23:59:59.999Z"),
        },
      ],
    });

    assert.deepEqual(allowedLocationIds, ["location-default", "location-cover"]);
  });
});

describe("assertPromoterLocationAllowed", () => {
  it("throws when the requested location is not allowed", () => {
    assert.throws(
      () =>
        assertPromoterLocationAllowed({
          requestedLocationId: "location-other",
          allowedLocationIds: ["location-default"],
        }),
      /PROMOTER_LOCATION_NOT_ALLOWED/
    );
  });
});
