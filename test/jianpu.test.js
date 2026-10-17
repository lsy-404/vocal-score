import test from "node:test";
import assert from "node:assert/strict";
import { parsePitch, rhythmLines } from "../src/lib/jianpu.js";

function node(name, value = "", children = []) {
  return { localName: name, textContent: value, children };
}

function note(step, octave, alter = 0) {
  return node("note", "", [node("pitch", "", [node("step", step), node("alter", String(alter)), node("octave", String(octave))])]);
}

test("maps pitches to movable do in major and minor keys", () => {
  assert.deepEqual(parsePitch(note("C", 4), "C"), { label: "1", octaveShift: 0, midi: 60 });
  assert.deepEqual(parsePitch(note("D", 4), "C"), { label: "2", octaveShift: 0, midi: 62 });
  assert.deepEqual(parsePitch(note("F", 4, 1), "C"), { label: "♯4", octaveShift: 0, midi: 66 });
  assert.deepEqual(parsePitch(note("A", 4), "A", true), { label: "1", octaveShift: 0, midi: 69 });
  assert.deepEqual(parsePitch(note("C", 5), "C"), { label: "1", octaveShift: 1, midi: 72 });
  assert.deepEqual(parsePitch(note("B", 3), "C"), { label: "7", octaveShift: -1, midi: 59 });
});

test("maps note values to numbered-notation rhythm underlines", () => {
  assert.equal(rhythmLines("quarter"), 0);
  assert.equal(rhythmLines("eighth"), 1);
  assert.equal(rhythmLines("16th"), 2);
  assert.equal(rhythmLines("32nd"), 3);
  assert.equal(rhythmLines("whole"), 0);
});
