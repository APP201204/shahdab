import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Login · SHADAB RestaurantOS" }],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { phone, password },
      {
        onSuccess: () => {
          toast.success("Welcome back");
          navigate({ to: "/" });
        },
        onError: (err: any) => {
          toast.error(err.message ?? "Login failed");
        },
      }
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-card"
      >
        <h1 className="text-center text-2xl font-semibold">SHADAB RestaurantOS</h1>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9876543210"
            autoComplete="tel"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={!phone || !password || login.isPending}
        >
          {login.isPending ? "Logging in…" : "Login"}
        </Button>
      </form>
    </div>
  );
}
