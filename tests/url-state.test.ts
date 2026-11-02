import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, cloneState, parseQuery, serializeState } from "../src/lib/url-state";

describe("url-state", () => {
  it("U1 empty query", () => {
    const r = parseQuery("");
    expect(r.state).toEqual(DEFAULT_STATE);
    expect(r.hadInvalid).toBe(false);
  });
  it("U2 default serializes to empty", () => expect(serializeState(DEFAULT_STATE)).toBe(""));
  it("U3 round trip", () => {
    const s = cloneState(DEFAULT_STATE);
    s.dca.amount = "250";
    s.be.target = "";
    s.tab = "be";
    const q = serializeState(s);
    expect(q).toBe("?tab=be&dca_amt=250&be_target=");
    expect(parseQuery(q).state).toEqual(s);
  });
  it("U4 mixed", () => {
    const { state, hadInvalid } = parseQuery("?cur=PHP&dd_value=5000&dd_pcts=10,25,100");
    expect(state.currency).toBe("PHP");
    expect(state.dd.value).toBe("5000");
    expect(state.dd.pcts).toEqual(["10", "25", "100"]);
    expect(hadInvalid).toBe(false);
  });
  it("U5 bad number", () => {
    const r = parseQuery("?dca_amt=abc");
    expect(r.state.dca.amount).toBe("100");
    expect(r.hadInvalid).toBe(true);
  });
  it("U6 bad enums", () => {
    const r = parseQuery("?tab=evil&cur=usd");
    expect(r.state.tab).toBe("dca");
    expect(r.state.currency).toBe("USD");
    expect(r.hadInvalid).toBe(true);
  });
  it("U7 bad list item", () => {
    const r = parseQuery("?dd_pcts=10,x,20");
    expect(r.state.dd.pcts).toEqual(DEFAULT_STATE.dd.pcts);
    expect(r.hadInvalid).toBe(true);
  });
  it("U8 list too long", () => {
    const r = parseQuery("?dca_prices=" + Array(121).fill("10").join(","));
    expect(r.state.dca.prices.length).toBe(120);
    expect(r.hadInvalid).toBe(true);
  });
  it("U9 unknown keys ignored", () => {
    const r = parseQuery("?unknown=1&dca_fee=0.5");
    expect(r.state.dca.fee).toBe("0.5");
    expect(r.hadInvalid).toBe(false);
  });
  it("U10 oversized query", () => {
    const r = parseQuery("?dca_amt=1&x=" + "a".repeat(8000));
    expect(r.state).toEqual(DEFAULT_STATE);
    expect(r.hadInvalid).toBe(true);
  });
  it("U11 out of range is the calc's job", () => {
    const r = parseQuery("?dca_fee=150");
    expect(r.state.dca.fee).toBe("150");
    expect(r.hadInvalid).toBe(false);
  });
  it("U12 grouping stripped", () => expect(parseQuery("?dca_amt=1%2C000").state.dca.amount).toBe("1000"));
  it("U13 markup rejected", () => {
    const r = parseQuery("?dca_amt=<script>");
    expect(r.state.dca.amount).toBe("100");
    expect(r.hadInvalid).toBe(true);
  });
  it("U14 first duplicate wins", () => expect(parseQuery("?dca_amt=1&dca_amt=2").state.dca.amount).toBe("1"));
  it("serialize drops blank list rows and invalid numbers", () => {
    const s = cloneState(DEFAULT_STATE);
    s.dca.prices = ["10", "", "abc", "20"];
    s.dca.fee = "x";
    expect(serializeState(s)).toBe("?dca_prices=10%2C20");
  });
  it("serialize empty default-nonempty list", () => {
    const s = cloneState(DEFAULT_STATE);
    s.dd.pcts = [];
    expect(serializeState(s)).toBe("?dd_pcts=");
    expect(parseQuery("?dd_pcts=").state.dd.pcts).toEqual([]);
  });
});
