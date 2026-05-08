import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateNetLeaderboardAmount } from "./leaderboard";

describe("calculateNetLeaderboardAmount", () => {
  it("subtracts returns from monthly sales amount and quantity", () => {
    const result = calculateNetLeaderboardAmount({
      sales: [{ amount: 100, quantity: 2 }],
      returns: [{ amount: 50, quantity: 1 }],
    });

    assert.deepEqual(result, { amount: 50, quantity: 1 });
  });
});
