import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveUserPrice } from "./user-price";

test("users without a group pay the default price", () => {
  assert.equal(resolveUserPrice({ defaultPrice: 150_000, groupId: null }), 150_000);
});

test("group members pay the group price, else the default", () => {
  assert.equal(
    resolveUserPrice({ defaultPrice: 150_000, groupId: "g1", groupPrice: 130_000 }),
    130_000,
  );
  assert.equal(resolveUserPrice({ defaultPrice: 150_000, groupId: "g1" }), 150_000);
});

test("a user's own price wins over the group and the default", () => {
  assert.equal(
    resolveUserPrice({
      defaultPrice: 150_000,
      groupId: "g1",
      groupPrice: 130_000,
      userPrice: 120_000,
    }),
    120_000,
  );
  assert.equal(
    resolveUserPrice({ defaultPrice: 150_000, groupId: null, userPrice: 160_000 }),
    160_000,
  );
});
