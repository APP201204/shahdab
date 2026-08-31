import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Login } from "@/pages/Login";

function LocationDisplay() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("Login", () => {
  afterEach(cleanup);

  it("logs in a captain and redirects to /tables", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.selectOptions(screen.getByLabelText(/staff/i), "staff-003");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      const el = screen.queryByTestId("location");
      expect(el).not.toBeNull();
      expect(el!.textContent).toBe("/tables");
    });
  });

  it("logs in a cashier and redirects to /billing", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.selectOptions(screen.getByLabelText(/staff/i), "staff-006");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      const el = screen.queryByTestId("location");
      expect(el).not.toBeNull();
      expect(el!.textContent).toBe("/billing");
    });
  });
});
