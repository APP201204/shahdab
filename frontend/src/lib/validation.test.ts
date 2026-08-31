import { describe, it, expect } from "vitest";
import {
  organizationSchema,
  staffSchema,
  reservationSchema,
  paymentSchema,
  getFirstError,
} from "@/lib/validation";

describe("validation schemas", () => {
  it("requires organization name, slug, timezone and currency", () => {
    const result = organizationSchema.safeParse({
      name: "",
      slug: "",
      timezone: "",
      currency: "",
    });
    expect(result.success).toBe(false);
    expect(getFirstError(result)).toContain("Organization name");
  });

  it("rejects an organization slug with invalid characters", () => {
    const result = organizationSchema.safeParse({
      name: "Shahdab",
      slug: "Shahdab Demo",
      timezone: "Asia/Kolkata",
      currency: "INR",
    });
    expect(result.success).toBe(false);
    expect(getFirstError(result)).toContain("lowercase");
  });

  it("accepts a valid organization", () => {
    const result = organizationSchema.safeParse({
      name: "Shahdab",
      slug: "shahdab",
      timezone: "Asia/Kolkata",
      currency: "INR",
    });
    expect(result.success).toBe(true);
  });

  it("requires a valid email when provided", () => {
    const result = staffSchema.safeParse({
      name: "A",
      phone: "+1",
      email: "not-an-email",
      password: "pass",
    });
    expect(result.success).toBe(false);
    expect(getFirstError(result)).toContain("Invalid email");
  });

  it("requires a positive party size", () => {
    const result = reservationSchema.safeParse({
      guest_name: "A",
      guest_phone: "+1",
      party_size: 0,
      reservation_time: new Date().toISOString(),
      floor_id: "flr-001",
    });
    expect(result.success).toBe(false);
    expect(getFirstError(result)).toContain("at least 1");
  });

  it("rejects payment amounts of zero or less", () => {
    const result = paymentSchema.safeParse({
      payment_method: "cash",
      amount: 0,
    });
    expect(result.success).toBe(false);
    expect(getFirstError(result)).toContain("greater than 0");
  });

  it("accepts a valid payment", () => {
    const result = paymentSchema.safeParse({
      payment_method: "upi",
      amount: 250,
      transaction_ref: "upi-123",
    });
    expect(result.success).toBe(true);
  });
});
