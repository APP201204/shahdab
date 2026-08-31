import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db, dataService } from "@/mocks/db";
import { addToWaitlist, estimatedWaitMinutes } from "@/services/waitlist";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { Clock, MessageCircle, User, Users } from "lucide-react";
import type { WaitlistEntry } from "@/types";

export function CustomerQueuePage() {
  const { outletId } = useParams<{ outletId: string }>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [error, setError] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const outlet = useMemo(
    () => db.outlets.find((o) => o.id === outletId),
    [outletId]
  );

  const entry = useMemo(() => {
    if (!entryId) return null;
    return dataService("waitlist").findById(entryId) ?? null;
  }, [entryId, tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const party = useMemo(() => Math.max(1, Number(partySize) || 1), [partySize]);

  const waitMinutes = useMemo(() => {
    if (!outlet) return 0;
    return estimatedWaitMinutes(outlet.id, party);
  }, [outlet, party, tick]);

  if (!outlet) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <p className="text-center text-muted-foreground">
          Invalid or missing outlet. Please scan the QR code again.
        </p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter your WhatsApp number");
      return;
    }
    const created = addToWaitlist({
      organization_id: outlet.organization_id,
      outlet_id: outlet.id,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      party_size: party,
      created_at: new Date().toISOString(),
    });
    setEntryId(created.id);
  };

  const renderStatus = (e: WaitlistEntry) => {
    if (e.status === "seated") {
      const table = db.tables.find((t) => t.id === e.table_id);
      return (
        <div className="space-y-2 rounded-md bg-green-100 p-4 text-green-800">
          <p className="font-semibold">You are seated!</p>
          {table && <p>Please proceed to Table {table.table_number}.</p>}
        </div>
      );
    }
    if (e.status === "notified") {
      const table = db.tables.find((t) => t.id === e.table_id);
      return (
        <div className="space-y-2 rounded-md bg-amber-100 p-4 text-amber-800">
          <p className="flex items-center gap-2 font-semibold">
            <MessageCircle className="h-4 w-4" />
            Your table is ready
          </p>
          <p>
            A WhatsApp message has been sent to {e.customer_phone}. Please
            check in with the host.
          </p>
          {table && <p>Table {table.table_number} is being held for you.</p>}
        </div>
      );
    }
    return (
      <div className="space-y-2 rounded-md border p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Estimated wait: <span className="font-semibold">{e.estimated_wait_minutes} minutes</span>
        </p>
        <p className="text-sm text-muted-foreground">
          You are in the queue. We will notify you on WhatsApp once a table is
          ready.
        </p>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-background p-4 text-foreground sm:items-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold">{outlet.name}</h1>
          <p className="text-sm text-muted-foreground">Digital queue</p>
        </div>

        {!entry ? (
          <>
            <div className="space-y-2 rounded-md bg-muted/50 p-3 text-sm">
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Current estimated wait for {party}: {" "}
                <span className="font-semibold">
                  {waitMinutes === 0 ? "No wait" : `${waitMinutes} minutes`}
                </span>
              </p>
            </div>

            {waitMinutes === 0 && (
              <p className="text-sm text-green-700">
                A table may be available right now. You can still join the queue
                to be safe.
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" /> Name
                </label>
                <input
                  className={inputClass}
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircle className="h-4 w-4" /> WhatsApp number
                </label>
                <input
                  className={inputClass}
                  placeholder="+91-90000-00000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4" /> Number of people
                </label>
                <input
                  type="number"
                  min={1}
                  className={cn(inputClass, "w-32")}
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full">
                Join Queue
              </Button>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Hi {entry.customer_name}, here is your queue status:
            </p>
            {renderStatus(entry)}
          </div>
        )}
      </div>
    </div>
  );
}
