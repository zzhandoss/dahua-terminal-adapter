import { describe, expect, it } from "vitest";
import { MockPersonStore } from "../../../src/infra/mock/person-store.js";

describe("MockPersonStore", () => {
  it("finds person by exact configured selector", () => {
    const store = new MockPersonStore();
    const results = store.search({
      selector: "accessUser.Condition.CitizenIDNo",
      value: "900101000001",
      limit: 5
    });

    expect(results.length).toBe(1);
    expect(results[0]?.userId).toBe("tp-0001");
  });

  it("returns empty for unknown selector", () => {
    const store = new MockPersonStore();
    const noMatch = store.search({
      selector: "unknown.selector",
      value: "900101000001",
      limit: 5
    });

    expect(noMatch).toEqual([]);
  });
});
