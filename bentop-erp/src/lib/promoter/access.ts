export type TemporaryLocationWindow = {
  locationId: string;
  startsAt: Date;
  endsAt: Date;
};

export function getAllowedPromoterLocationIds(input: {
  now: Date;
  defaultLocationId: string | null | undefined;
  temporaryLocations: TemporaryLocationWindow[];
}): string[] {
  const allowedLocationIds = new Set<string>();

  if (input.defaultLocationId) {
    allowedLocationIds.add(input.defaultLocationId);
  }

  for (const temporaryLocation of input.temporaryLocations) {
    if (input.now >= temporaryLocation.startsAt && input.now <= temporaryLocation.endsAt) {
      allowedLocationIds.add(temporaryLocation.locationId);
    }
  }

  return [...allowedLocationIds];
}

export function assertPromoterLocationAllowed(input: {
  requestedLocationId: string;
  allowedLocationIds: string[];
}): void {
  if (!input.allowedLocationIds.includes(input.requestedLocationId)) {
    throw new Error("PROMOTER_LOCATION_NOT_ALLOWED");
  }
}
