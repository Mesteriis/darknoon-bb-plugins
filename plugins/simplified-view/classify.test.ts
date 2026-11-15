import { describe, expect, it } from "vitest";
import { classifyRows, latestTurn, rowTurn } from "./classify";

const T = "thr_x";
const row = (id: string, isMessageColumn = false) => ({ id: `${T}:${id}`, isMessageColumn });
const a = (turn: string, item: string) =>
  row(`assistant:kind:assistant|turn:${turn}|parent:root|item:${item}`, true);

describe("rowTurn", () => {
  it("reads turn ids from assistant, work and turn rows", () => {
    expect(rowTurn("assistant:kind:assistant|turn:ab-t4|parent:root|item:ab-i1")).toBe("ab-t4");
    expect(rowTurn("ab-t1:work-summary:thr_x:command:ab-i13")).toBe("ab-t1");
    expect(rowTurn("ab-t9:turn:0")).toBe("ab-t9");
    expect(rowTurn("user-seed:5")).toBeNull();
    expect(rowTurn("command:ab-i10")).toBeNull();
  });
});

describe("latestTurn", () => {
  it("finds the last turn in this thread", () => {
    expect(latestTurn(T, [row("ab-t1:turn:0"), row("user-seed:2", true), { id: "thr_y:ab-t9:turn:0", isMessageColumn: false }])).toBe("ab-t1");
  });
});

describe("classifyRows", () => {
  const rows = [
    row("user-seed:1", true), // human
    row("ab-t1:turn:0"), // "Worked for"
    a("ab-t1", "i1"), // progress note
    row("command:ab-i2"), // "Sent to <thread>"
    row("user-seed:2"), // "Message from <thread>" (generated title row)
    a("ab-t1", "i3"), // final reply
    row("user-seed:3", true), // human
    row("ab-t2:work-summary:thr_x:command:ab-i4"),
    a("ab-t2", "i5"),
  ];

  it("shows human messages and the last reply per finished turn", () => {
    const v = classifyRows(T, rows, false);
    const shown = [...v].filter(([, s]) => s === "show").map(([id]) => id.slice(T.length + 1));
    expect(shown).toEqual([
      "user-seed:1",
      "assistant:kind:assistant|turn:ab-t1|parent:root|item:i3",
      "user-seed:3",
      "assistant:kind:assistant|turn:ab-t2|parent:root|item:i5",
    ]);
  });

  it("hides every agent message of the running turn", () => {
    const v = classifyRows(T, rows, true);
    expect(v.get(`${T}:assistant:kind:assistant|turn:ab-t2|parent:root|item:i5`)).toBe("hide");
    expect(v.get(`${T}:assistant:kind:assistant|turn:ab-t1|parent:root|item:i3`)).toBe("show");
  });
  const reply = `${T}:assistant:kind:assistant|turn:ab-t2|parent:root|item:i5`;
  it("keeps the previous reply visible right after you send", () => {
    const sent = [...rows, row("user-seed:4", true)];
    expect(classifyRows(T, sent, true).get(reply)).toBe("show");
  });

  it("keeps the previous reply visible while the sent message is optimistic", () => {
    const sending = [...rows, row("r-VbKCsD0tePzb8eNy1gsqN", true)];
    const v = classifyRows(T, sending, true);
    expect(v.get(reply)).toBe("show");
    expect(v.get(`${T}:r-VbKCsD0tePzb8eNy1gsqN`)).toBe("show");
  });

  it("keeps the previous reply visible when bb reports running before the sent message appears", () => {
    expect(classifyRows(T, rows, true, "ab-t2").get(reply)).toBe("show");
  });

  it("keeps hiding the running turn after a steer", () => {
    const steered = [...rows, { ...row("user-seed:4", true), isSteer: true }];
    expect(classifyRows(T, steered, true).get(reply)).toBe("hide");
  });

  it("treats a turn with a Worked-for row as finished", () => {
    const done = [...rows, row("ab-t2:turn:0")];
    expect(classifyRows(T, done, true).get(reply)).toBe("show");
  });

  it("ignores rows from other threads", () => {
    expect(classifyRows(T, [{ id: "thr_y:user-seed:1", isMessageColumn: true }], false).size).toBe(0);
  });
});
