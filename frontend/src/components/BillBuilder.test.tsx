import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BillBuilder } from "@/components/BillBuilder";

describe("BillBuilder", () => {
  it("calculates subtotal, discount, tax and total correctly", () => {
    render(
      <BillBuilder
        currency="₹"
        lines={[
          { name: "Paneer Tikka", quantity: 2, unitPrice: 320 },
          { name: "Naan", quantity: 4, unitPrice: 60 },
        ]}
        discounts={[
          { type: "flat", value: 50, amount: 50, itemName: null, reason: null },
        ]}
        taxes={[
          { name: "CGST", amount: 18.5 },
          { name: "SGST", amount: 18.5 },
        ]}
        paid={400}
      />
    );

    const subtotal = 320 * 2 + 60 * 4; // 880
    const discount = 50;
    const tax = 18.5 + 18.5; // 37
    const total = subtotal - discount + tax; // 867
    const due = total - 400; // 467

    expect(screen.getByText(`₹${subtotal.toFixed(2)}`)).toBeDefined();
    expect(screen.getByText(`₹${total.toFixed(2)}`)).toBeDefined();
    expect(screen.getByText(`₹${due.toFixed(2)}`)).toBeDefined();
  });

  it("shows a zero due when the bill is fully paid", () => {
    render(
      <BillBuilder
        currency="₹"
        lines={[{ name: "Chai", quantity: 1, unitPrice: 60 }]}
        discounts={[]}
        taxes={[{ name: "GST", amount: 5 }]}
        paid={65}
      />
    );

    expect(screen.getByText("₹0.00")).toBeDefined();
  });
});
