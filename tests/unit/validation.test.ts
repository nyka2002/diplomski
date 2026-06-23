import { describe, it, expect } from "vitest";
import { registerSchema, passwordChangeSchema } from "@/lib/validation/auth";
import { listingSchema } from "@/lib/validation/listing";

// Helper: first error code (the stable KEY) for a field.
const firstError = (result: { success: boolean; error?: any }, path: string) =>
  result.success ? null : result.error.issues.find((i: any) => i.path.join(".") === path)?.message;

const validRegister = {
  firstName: "Marija",
  lastName: "Horvat",
  username: "marija_test",
  email: "marija@example.com",
  phone: "+385 91 234 5678",
  password: "secret123",
  confirm: "secret123",
};

describe("registerSchema", () => {
  it("accepts a fully valid registration", () => {
    expect(registerSchema.safeParse(validRegister).success).toBe(true);
  });

  it("rejects an invalid email with the emailInvalid key", () => {
    const r = registerSchema.safeParse({ ...validRegister, email: "not-an-email" });
    expect(firstError(r, "email")).toBe("emailInvalid");
  });

  it("rejects a password without a digit (passwordNumber)", () => {
    const r = registerSchema.safeParse({ ...validRegister, password: "onlyletters", confirm: "onlyletters" });
    expect(firstError(r, "password")).toBe("passwordNumber");
  });

  it("rejects a too-short username (usernameMin)", () => {
    expect(firstError(registerSchema.safeParse({ ...validRegister, username: "ab" }), "username")).toBe(
      "usernameMin",
    );
  });

  it("flags a confirm mismatch", () => {
    const r = registerSchema.safeParse({ ...validRegister, confirm: "different1" });
    expect(firstError(r, "confirm")).toBe("confirmMismatch");
  });

  it("allows an empty optional phone", () => {
    expect(registerSchema.safeParse({ ...validRegister, phone: "" }).success).toBe(true);
  });
});

describe("passwordChangeSchema", () => {
  it("rejects a weak new password", () => {
    const r = passwordChangeSchema.safeParse({ current: "x", newPw: "short", confirm: "short" });
    expect(firstError(r, "newPw")).toBe("passwordMin");
  });
});

const validListing = {
  type: "sale",
  status: "active",
  title: "Modern studio",
  titleHr: "Moderni studio",
  priceEur: "185000",
  priceDisplay: "€185,000",
  city: "Zagreb, Centar",
  areaM2: "38",
  rooms: "0",
  description: "A nice studio.",
  descriptionHr: "Lijep studio.",
  images: ["https://example.com/a.jpg"],
  sellerEmail: "",
  sourceUrl: "",
};

describe("listingSchema", () => {
  it("accepts a valid listing (string numbers coerced)", () => {
    const r = listingSchema.safeParse(validListing);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.priceEur).toBe(185000);
      expect(r.data.rooms).toBe(0);
    }
  });

  it("rejects a non-positive price (numberPositive)", () => {
    expect(firstError(listingSchema.safeParse({ ...validListing, priceEur: "0" }), "priceEur")).toBe(
      "numberPositive",
    );
  });

  it("rejects a non-numeric area (numberInvalid)", () => {
    expect(firstError(listingSchema.safeParse({ ...validListing, areaM2: "abc" }), "areaM2")).toBe(
      "numberInvalid",
    );
  });

  it("rejects an invalid source URL", () => {
    expect(firstError(listingSchema.safeParse({ ...validListing, sourceUrl: "not a url" }), "sourceUrl")).toBe(
      "urlInvalid",
    );
  });
});
