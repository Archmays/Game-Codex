import {
  POINTER_COMMIT_RATIO,
  POINTER_DRAG_START_PX,
  POINTER_MIN_COMMIT_PX,
  POINTER_VELOCITY_PX_PER_MS,
  beginPointerGesture,
  finishPointerGesture,
  updatePointerGesture
} from "../games/equation-slider/pointer-state";

describe("equation slider pointer gesture state", () => {
  it("does not enter drag before 14px and enters drag at exactly 14px", () => {
    const initial = beginPointerGesture({
      pointerId: 7,
      reelId: "left-reel",
      clientY: 100,
      time: 10
    });

    const beforeThreshold = updatePointerGesture(
      initial,
      100 + POINTER_DRAG_START_PX - 1,
      20,
      80
    );
    const atThreshold = updatePointerGesture(
      beforeThreshold.gesture,
      100 + POINTER_DRAG_START_PX,
      30,
      80
    );

    expect(beforeThreshold.gesture.dragging).toBe(false);
    expect(atThreshold.gesture.dragging).toBe(true);
  });

  it.each([
    ["positive", 480, 64],
    ["negative", -280, -64]
  ] as const)("clamps a %s preview to one tile height", (_name, clientY, expectedOffset) => {
    const initial = beginPointerGesture({
      pointerId: 1,
      reelId: "reel",
      clientY: 0,
      time: 0
    });

    const preview = updatePointerGesture(initial, clientY, 20, 64);

    expect(preview.offsetY).toBe(expectedOffset);
    expect(Math.abs(preview.offsetY)).toBeLessThanOrEqual(64);
  });

  it.each([
    ["downward", "up", 40],
    ["upward", "down", -40]
  ] as const)(
    "maps a physical %s swipe to the %s one-step reel action",
    (_physicalDirection, expectedDirection, clientY) => {
      const gesture = beginPointerGesture({
        pointerId: 2,
        reelId: "right-reel",
        clientY: 0,
        time: 0
      });
      const preview = updatePointerGesture(gesture, clientY, 100, 100);

      expect(finishPointerGesture(preview.gesture, 100)).toEqual({
        commit: true,
        direction: expectedDirection,
        suppressClick: true
      });
    }
  );

  it("does not commit a slow drag below the 35% distance threshold", () => {
    const tileHeight = 100;
    const belowThreshold = tileHeight * POINTER_COMMIT_RATIO - 1;
    const gesture = beginPointerGesture({
      pointerId: 3,
      reelId: "middle-reel",
      clientY: 0,
      time: 0
    });
    const preview = updatePointerGesture(gesture, belowThreshold, 1_000, tileHeight);

    expect(preview.gesture.dragging).toBe(true);
    expect(finishPointerGesture(preview.gesture, tileHeight)).toEqual({
      commit: false,
      suppressClick: true
    });
  });

  it("commits at exactly 35% of one tile", () => {
    const tileHeight = 100;
    const gesture = beginPointerGesture({
      pointerId: 4,
      reelId: "left-reel",
      clientY: 0,
      time: 0
    });
    const preview = updatePointerGesture(
      gesture,
      tileHeight * POINTER_COMMIT_RATIO,
      1_000,
      tileHeight
    );

    expect(finishPointerGesture(preview.gesture, tileHeight)).toMatchObject({
      commit: true,
      direction: "up"
    });
  });

  it("commits a short fast flick at the velocity threshold", () => {
    const tileHeight = 100;
    const duration = Math.floor(POINTER_MIN_COMMIT_PX / POINTER_VELOCITY_PX_PER_MS);
    const gesture = beginPointerGesture({
      pointerId: 5,
      reelId: "left-reel",
      clientY: 0,
      time: 10
    });
    const preview = updatePointerGesture(
      gesture,
      -POINTER_MIN_COMMIT_PX,
      10 + duration,
      tileHeight
    );

    expect(POINTER_MIN_COMMIT_PX).toBeLessThan(tileHeight * POINTER_COMMIT_RATIO);
    expect(POINTER_MIN_COMMIT_PX / duration).toBeGreaterThanOrEqual(
      POINTER_VELOCITY_PX_PER_MS
    );
    expect(finishPointerGesture(preview.gesture, tileHeight)).toMatchObject({
      commit: true,
      direction: "down"
    });
  });

  it("collapses an overlong swipe to one bounded preview and one direction action", () => {
    const gesture = beginPointerGesture({
      pointerId: 6,
      reelId: "operator-reel",
      clientY: 20,
      time: 0
    });
    const preview = updatePointerGesture(gesture, 2_020, 250, 72);
    const finish = finishPointerGesture(preview.gesture, 72);

    expect(preview.offsetY).toBe(72);
    expect(finish).toEqual({
      commit: true,
      direction: "up",
      suppressClick: true
    });
    expect(["up", "down"]).toContain(finish.direction);
  });

  it("returns new state without mutating the gesture supplied by the caller", () => {
    const initial = Object.freeze(
      beginPointerGesture({
        pointerId: 9,
        reelId: "immutable-reel",
        clientY: 50,
        time: 100
      })
    );
    const snapshot = { ...initial };

    const preview = updatePointerGesture(initial, 80, 140, 60);
    const previewSnapshot = { ...preview.gesture };
    finishPointerGesture(preview.gesture, 60);

    expect(initial).toEqual(snapshot);
    expect(preview.gesture).not.toBe(initial);
    expect(preview.gesture).toEqual(previewSnapshot);
    expect(preview.gesture).toMatchObject({
      lastY: 80,
      lastAt: 140,
      dragging: true
    });
  });
});
