import { getSubjectFilters } from "../apps/hub/filters";
import { calculate, formatCardValue } from "../games/make-target";

describe("learning game optimizations", () => {
  it("keeps make-target card calculations and display values explicit", () => {
    expect(calculate(8, 1, "-")).toBe(7);
    expect(calculate(3, 8, "×")).toBe(24);
    expect(calculate(8, 2, "÷")).toBe(4);
    expect(calculate(5, 2, "÷")).toBeNull();
    expect(formatCardValue(7)).toBe("7");
  });





  it("derives stable subject filters for the hub", () => {
    expect(
      getSubjectFilters([
        { subject: "识字" },
        { subject: "数学" },
        { subject: "识字" },
        { subject: "英语" }
      ])
    ).toEqual(["全部", "识字", "数学", "英语"]);
  });

});
