import { describe, it, expect } from "vitest";
import { detectLead } from "./email-detector";

describe("detectLead", () => {
  it("extracts name + email from typical Progressive Lead sentence", () => {
    const msg = "Sure, I'm Sarah and my email is sarah@example.com";
    expect(detectLead(msg)).toEqual({
      email: "sarah@example.com",
      name: "Sarah",
    });
  });

  it("extracts email when name is not given", () => {
    expect(detectLead("you can reach me at alex@test.org")).toEqual({
      email: "alex@test.org",
      name: null,
    });
  });

  it("returns null when no email appears", () => {
    expect(detectLead("Tell me more about K-Pop Business track.")).toBeNull();
  });

  it("prefers the first valid email if multiple appear", () => {
    expect(
      detectLead("Write to first@a.com or second@b.com please.")?.email,
    ).toBe("first@a.com");
  });

  it("ignores obviously invalid strings", () => {
    expect(detectLead("not-an-email-@")).toBeNull();
  });
});
