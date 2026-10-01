import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveUserPrice } from "./user-price";

test("users without a group pay their personal price, else the default", () => {
  assert.equal(resolveUserPrice({ defaultPrice: 150_000, groupId: null }), 150_000);
  assert.equal(
    resolveUserPrice({ defaultPrice: 150_000, groupId: null, personalPrice: 140_000 }),
    140_000,
  );
});

test("group members pay the group price and never their personal price", () => {
  assert.equal(
    resolveUserPrice({
      defaultPrice: 150_000,
      groupId: "g1",
      groupPrice: 130_000,
      personalPrice: 120_000,
    }),
    130_000,
  );
  assert.equal(
    resolveUserPrice({ defaultPrice: 150_000, groupId: "g1", personalPrice: 120_000 }),
    150_000,
  );
});
