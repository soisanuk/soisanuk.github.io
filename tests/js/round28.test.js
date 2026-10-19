// Round 28 (2026-10-19) — Khun Preeya, nineteen years teaching Thai to
// foreigners (lens: pedagogy — what does the Restaurant's ordering beat
// actually teach, and what does it teach wrong).
//
// Her verdict on v1: "recognition with a composition step, not production",
// and worse — passable without reading a single Thai word from the second
// sitting on. The chips sat in a fixed order, the target was English, and the
// arrival card translated whatever you tapped back into English, so every
// order taught four position→English facts whether or not you read a chip.
// Half the targets were not dishes, every soup came on a plate, every learner
// said ครับ, and a miss never showed the right word. Each is pinned below.
//
// Run with: node --test tests/js/

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

for (const f of ["data.js", "examples.js", "tokeniser.js", "thai-script.js", "restaurant.js"]) {
  vm.runInThisContext(
    readFileSync(new URL(`../../web/js/${f}`, import.meta.url), "utf8"),
    { filename: f }
  );
}
globalThis.WORD_MAP = Object.fromEntries(WORDS.map(w => [w[0], w]));
const unresolved = th => _tokenise(th).filter(t => !t.word && /[ก-๎]/.test(t.text)).map(t => t.text);

// A seedable rng so the simulations below are reproducible.
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

describe("F1 — the drill cannot be passed by position alone", () => {
  // The Thai-blind learner: never reads a chip. Remembers, per slot, which
  // POSITION produced which English on the arrival card, and taps it when
  // the target asks for that English again. With a fixed chip order this
  // climbs toward full marks; with a fresh permutation per order it cannot.
  function blind(sittings, chipOrder, rand) {
    const known = {};
    const scores = [];
    for (let s = 0; s < sittings; s++) {
      let right = 0;
      for (let o = 0; o < 5; o++) {
        const t = _rstTarget(rand);
        const order = { pt: _RST_PARTICLES[0] };
        for (const sl of _RST_SLOTS) {
          if (!sl.graded) continue;
          const perm = chipOrder(sl, rand);
          const want = t[sl.key] ? (sl.key === "q" ? String(t[sl.key].n) : t[sl.key].en) : null;
          if (want === null) { order[sl.key] = null; continue; }   // nothing to learn from an unstated slot
          known[sl.key] ??= {};
          const pos = known[sl.key][want];
          const posIdx = pos !== undefined ? pos : Math.floor(rand() * perm.length);
          const chip = sl.list[perm[posIdx]];
          order[sl.key] = chip;
          known[sl.key][sl.key === "q" ? String(chip.n) : chip.en] = posIdx;
        }
        if (_rstDiff(t, order).length === 0) right++;
      }
      scores.push(right);
    }
    return scores;
  }
  const fixed = sl => sl.list.map((_, i) => i);
  const shuffled = (sl, rand) => _rstShuffle(sl.list.map((_, i) => i), rand);
  const expect = (chipOrder, runs = 3000) => {
    const rand = lcg(28);
    const sum = [0, 0, 0, 0];
    for (let i = 0; i < runs; i++) blind(4, chipOrder, rand).forEach((v, k) => sum[k] += v);
    return sum.map(v => v / runs);
  };

  test("with a fresh permutation per order, position learning stays at chance", () => {
    const e = expect(shuffled);
    assert.ok(e[3] < 0.6, `Thai-blind learner scored ${e[3].toFixed(2)}/5 by the fourth sitting — chips are not shuffled`);
  });

  test("…and the simulation is sensitive: with a fixed order it climbs", () => {
    // Guards the test above against a blind learner that is simply too dumb
    // to learn anything. Fixed chips must let it climb, or the first test is
    // passing by examining nothing.
    const e = expect(fixed);
    assert.ok(e[3] > 1.5, `fixed-order blind learner only reached ${e[3].toFixed(2)}/5 — the simulation cannot see the shortcut`);
    assert.ok(e[3] > e[0], "the fixed-order learner should improve across sittings");
  });

  test("_rstShuffle is a real permutation and not the skewed sort-comparator shuffle", () => {
    const rand = lcg(7);
    const counts = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
    for (let i = 0; i < 20000; i++) _rstShuffle([0, 1, 2, 3, 4], rand).forEach((v, pos) => counts[v][pos]++);
    // Each item lands in each slot about 20% of the time; round 18 measured
    // the comparator shuffle at 28/19 on four items.
    for (const row of counts) for (const c of row) assert.ok(Math.abs(c / 20000 - 0.2) < 0.02, `skew: ${c / 20000}`);
  });
});

describe("F3 — a miss shows the right order, in Thai the learner can say", () => {
  test("_rstWantedLine is the target composed with the learner's own particle", () => {
    const t = _rstTarget(lcg(3));
    const said = { ...t, m: _RST_METHODS[(_RST_METHODS.indexOf(t.m) + 1) % 5], pt: _RST_PARTICLES[1] };
    const line = _rstWantedLine(t, said);
    assert.ok(line.endsWith("ค่ะ"), `should end with the learner's particle: ${line}`);
    assert.ok(line.includes(t.p.th + t.m.th), `should contain the wanted dish: ${line}`);
    assert.deepEqual(unresolved(line), []);
  });

  test("every possible wanted line resolves token by token", () => {
    const rand = lcg(11); const bad = new Set();
    for (let i = 0; i < 2000; i++) {
      const t = _rstTarget(rand);
      for (const pt of _RST_PARTICLES) for (const u of unresolved(_rstWantedLine(t, { pt }))) bad.add(u);
    }
    assert.deepEqual([...bad], []);
  });
});

describe("F4 — a target is always a dish a kitchen can act on", () => {
  test("every target is one of the orderable protein × method pairs", () => {
    const ok = new Set(_RST_DISHES.map(([p, m]) => _RST_PROTEINS[p].th + _RST_METHODS[m].th));
    const rand = lcg(4); const seen = new Set();
    for (let i = 0; i < 3000; i++) { const t = _rstTarget(rand); seen.add(t.p.th + t.m.th); }
    for (const d of seen) assert.ok(ok.has(d), `${d} was drawn as a target but is not an orderable dish`);
    assert.ok(seen.size >= 12, `only ${seen.size} distinct dishes drawn in 3000 targets`);
  });

  test("the unorderable cells are still reachable as WRONG answers", () => {
    // The chips offer every method, so ไก่นึ่ง can still be composed and served
    // as a literal plate — it just never appears as what the table wants.
    const th = _rstCompose({ p: _RST_PROTEINS[1], m: _RST_METHODS[4], q: null, h: null, pt: _RST_PARTICLES[0] });
    assert.equal(th, "ขอไก่นึ่งครับ");
    assert.deepEqual(unresolved(th), []);
  });

  test("seven of the thirty grid cells are WORDS entries — not eight", () => {
    // Round 28 corrected the design doc: หมูปิ้ง's ปิ้ง is not a method chip.
    let n = 0; for (const p of _RST_PROTEINS) for (const m of _RST_METHODS) if (WORD_MAP[p.th + m.th]) n++;
    assert.equal(n, 7);
  });
});

describe("F5 — the template no longer teaches three things wrong", () => {
  const T = { p: _RST_PROTEINS[1], m: _RST_METHODS[0], q: null, h: null, pt: _RST_PARTICLES[0] }; // grilled chicken, as it comes

  test("the shortest real order is a complete order", () => {
    assert.equal(_rstCompose(T), "ขอไก่ย่างครับ");
    _rstSaid = { ...T };
    assert.equal(_rstFilled(), true, "protein + method + particle must be enough to place an order");
  });

  test("soup takes ถ้วย, everything else จาน", () => {
    const soup = { p: _RST_PROTEINS[4], m: _RST_METHODS[3], q: _RST_QTY[1], h: null, pt: _RST_PARTICLES[0] };
    assert.equal(_rstCompose(soup), "ขอกุ้งต้มสองถ้วยครับ");
    assert.ok(WORD_MAP["ถ้วย"], "ถ้วย must be a course word");
    const plate = { ...soup, m: _RST_METHODS[1] };
    assert.ok(_rstCompose(plate).includes("จาน"));
  });

  test("a dish that takes no spice has no spice in its target, and stating one is a miss", () => {
    const rand = lcg(5);
    for (let i = 0; i < 2000; i++) {
      const t = _rstTarget(rand);
      if (_RST_NO_HEAT_METHODS.has(t.m.th)) assert.equal(t.h, null, `${t.p.th + t.m.th} should not ask for spice`);
    }
    const said = { ...T, h: _RST_HEAT[1] };
    assert.deepEqual(_rstDiff(T, said).map(d => d.slot), ["h"], "เผ็ดน้อย on grilled chicken is a miss");
  });

  test("unstated quantity and หนึ่ง are the same plate", () => {
    assert.deepEqual(_rstDiff(T, { ...T, q: _RST_QTY[0] }), []);
    assert.deepEqual(_rstDiff({ ...T, q: _RST_QTY[0] }, T), []);
    assert.equal(_rstDiff(T, { ...T, q: _RST_QTY[2] })[0].slot, "q");
  });
});

describe("F6 / F8 — the particle is the learner's, and every chip has English", () => {
  test("ค่ะ is a choice and never graded", () => {
    const t = _rstTarget(lcg(6));
    const a = { ...t, pt: _RST_PARTICLES[0] }, b = { ...t, pt: _RST_PARTICLES[1] };
    assert.deepEqual(_rstDiff(t, a), []); assert.deepEqual(_rstDiff(t, b), []);
    assert.ok(_rstCompose(b).endsWith("ค่ะ"));
  });

  test("every chip on every slot carries an English gloss", () => {
    for (const s of _RST_SLOTS) for (const it of s.list)
      assert.ok(it.en, `${it.th} has no English — "But you said ${it.th}." leaves the weakest learner with nothing`);
  });

  test("a wrong slot the learner left empty gets a question, not a quote of nothing", () => {
    const want = { ...T6(), h: _RST_HEAT[2] };
    const said = { ...want, h: null };
    const diff = _rstDiff(want, said);
    assert.equal(diff[0].slot, "h");
    const line = _rstWaiterLine(diff);
    assert.ok(!line.includes("undefined") && !line.includes("null"), line);
    assert.deepEqual(unresolved(line), [], line);
  });
  function T6() { return { p: _RST_PROTEINS[4], m: _RST_METHODS[3], q: null, h: null, pt: _RST_PARTICLES[0] }; } // prawn soup
});
