import { isStep06EvidenceAttempt, resolveAppRoute } from "../src/app-route";

const resolve = (query = "") => resolveAppRoute(new URLSearchParams(query));

describe("Hanzi V2 STEP 06 default route promotion", () => {
  it("routes root and explicit alias to My Game World", () => {
    expect(resolve()).toEqual({ kind: "world", explicit: false });
    expect(resolve("world=my-game-world")).toEqual({ kind: "world", explicit: true });
  });

  it("keeps play, observe, review, and explicit classic ahead of world", () => {
    expect(resolve("play=hanzi-v2-golden-slice&world=my-game-world").kind).toBe("play");
    expect(resolve("observe=hanzi-v2-step06&hub=classic").kind).toBe("observe-step06");
    expect(resolve("review=hanzi-v2-step05&hub=classic").kind).toBe("review-step05");
    expect(resolve("hub=classic&world=my-game-world").kind).toBe("classic-hub");
  });

  it("does not mistake STEP 05 review evidence for a STEP 06 child route", () => {
    expect(isStep06EvidenceAttempt(new URLSearchParams("evidence=EC04FECD4B04F294"))).toBe(false);
    expect(isStep06EvidenceAttempt(new URLSearchParams("evidence=hanzi-v2-step06"))).toBe(true);
    expect(isStep06EvidenceAttempt(new URLSearchParams("session=s06-12345678"))).toBe(true);
  });
});
