import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";

describe("StatusBadge", () => {
  it("renders the status text by default", () => {
    render(<StatusBadge status="occupied" />);
    expect(screen.getByText("occupied")).toBeDefined();
  });

  it("uses a custom label when provided", () => {
    render(<StatusBadge status="reserved" label="Booked" />);
    expect(screen.getByText("Booked")).toBeDefined();
  });

  it("renders cancelled status", () => {
    render(<StatusBadge status="cancelled" />);
    expect(screen.getByText("cancelled")).toBeDefined();
  });
});
