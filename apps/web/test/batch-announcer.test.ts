import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  batchEvents,
  type AnnounceableEvent,
} from "../src/lib/a11y/batch-announcer.ts";

describe("Batched Live Announcer Pure Logic (TDD)", () => {
  const sampleEvents: AnnounceableEvent[] = [
    { id: "ev-1", title: "Dragon raid on the western gate", timestamp: 1000 },
    { id: "ev-2", title: "Drought reduces water yields", timestamp: 2500 },
    { id: "ev-3", title: "Harvest festival blooms", timestamp: 3200 },
    { id: "ev-4", title: "Plague contained in lower quarter", timestamp: 3900 },
    { id: "ev-5", title: "New trade caravan arrives", timestamp: 3950 },
  ];

  it("grouping: groups chronicle events into at most one message per 4000ms window", () => {
    const multiWindowEvents: AnnounceableEvent[] = [
      { id: "w1-a", title: "Event A", timestamp: 500 },
      { id: "w1-b", title: "Event B", timestamp: 2000 },
      { id: "w2-a", title: "Event C", timestamp: 4500 },
      { id: "w2-b", title: "Event D", timestamp: 6000 },
      { id: "w3-a", title: "Event E", timestamp: 9000 },
    ];

    const messages = batchEvents(multiWindowEvents, { windowMs: 4000 });
    assert.equal(messages.length, 3);
    assert.equal(messages[0], "Event A. Event B");
    assert.equal(messages[1], "Event C. Event D");
    assert.equal(messages[2], "Event E");
  });

  it("cap: caps each message at 3 events plus 'and N more'", () => {
    // 5 events all in window 0 (0..3999ms)
    const messages = batchEvents(sampleEvents, { windowMs: 4000 });
    assert.equal(messages.length, 1);
    assert.equal(
      messages[0],
      "Dragon raid on the western gate. Drought reduces water yields. Harvest festival blooms, and 2 more",
    );

    // Exactly 3 events -> no 'and N more'
    const threeEvents = sampleEvents.slice(0, 3);
    const threeMsg = batchEvents(threeEvents, { windowMs: 4000 });
    assert.equal(threeMsg.length, 1);
    assert.equal(
      threeMsg[0],
      "Dragon raid on the western gate. Drought reduces water yields. Harvest festival blooms",
    );

    // 4 events -> 'and 1 more'
    const fourEvents = sampleEvents.slice(0, 4);
    const fourMsg = batchEvents(fourEvents, { windowMs: 4000 });
    assert.equal(
      fourMsg[0],
      "Dragon raid on the western gate. Drought reduces water yields. Harvest festival blooms, and 1 more",
    );
  });

  it("paused: returns empty announcements when paused is true", () => {
    const messages = batchEvents(sampleEvents, { paused: true });
    assert.deepEqual(messages, []);

    // Empty events list also returns empty
    assert.deepEqual(batchEvents([], { paused: false }), []);
  });

  it("ordering: orders deterministically by time/step and tie-breaks by id", () => {
    // Scrambled order with identical timestamps
    const sameTimeEvents: AnnounceableEvent[] = [
      { id: "c-id", title: "Charlie Event", timestamp: 1000 },
      { id: "a-id", title: "Alpha Event", timestamp: 1000 },
      { id: "b-id", title: "Bravo Event", timestamp: 1000 },
    ];

    const messages1 = batchEvents(sameTimeEvents);
    const messages2 = batchEvents([...sameTimeEvents].reverse());

    // Both must yield Alpha, Bravo, Charlie stably based on ID tie-break
    assert.equal(messages1[0], "Alpha Event. Bravo Event. Charlie Event");
    assert.equal(messages2[0], "Alpha Event. Bravo Event. Charlie Event");
  });

  it("step fallback: works with step attribute when timestamp is absent", () => {
    const stepEvents: AnnounceableEvent[] = [
      { id: "s1", title: "Step 1 Event", step: 1000 },
      { id: "s2", title: "Step 2 Event", step: 2000 },
      { id: "s3", title: "Step 5 Event", step: 5000 },
    ];

    const messages = batchEvents(stepEvents, { windowMs: 4000 });
    assert.equal(messages.length, 2);
    assert.equal(messages[0], "Step 1 Event. Step 2 Event");
    assert.equal(messages[1], "Step 5 Event");
  });
});
