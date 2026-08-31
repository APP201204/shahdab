import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inputClass } from "@/lib/styles";
import { Plus } from "lucide-react";


interface MenuVariant {
  id: string;
  name: string;
  price: number;
}

interface MenuModifier {
  id: string;
  name: string;
}

interface MenuItemCardProps {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  variants: MenuVariant[];
  modifiers: MenuModifier[];
  outOfStock: boolean;
  onAdd: (item: {
    menuItemId: string;
    variantId: string;
    modifierIds: string[];
    quantity: number;
    unitPrice: number;
  }) => void;
}

export function MenuItemCard({
  id,
  name,
  description,
  imageUrl,
  variants,
  modifiers,
  outOfStock,
  onAdd,
}: MenuItemCardProps) {
  const defaultVariant = useMemo(
    () => variants[0],
    [variants]
  );
  const [selectedVariantId, setSelectedVariantId] = useState(
    defaultVariant?.id ?? ""
  );
  const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(
    new Set()
  );
  const [quantity, setQuantity] = useState(1);

  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;

  const add = () => {
    if (!selectedVariant || outOfStock) return;
    onAdd({
      menuItemId: id,
      variantId: selectedVariant.id,
      modifierIds: Array.from(selectedModifiers),
      quantity,
      unitPrice: selectedVariant.price,
    });
    setQuantity(1);
    setSelectedModifiers(new Set());
  };

  return (
    <div
      className={cn(
        "rounded-md border p-3 transition-shadow hover:shadow-md",
        outOfStock && "cursor-not-allowed opacity-50"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium">{name}</h4>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {outOfStock && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
            Out of stock
          </span>
        )}
      </div>

      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="mt-2 h-24 w-full rounded-md object-cover"
        />
      ) : (
        <div className="mt-2 h-24 w-full rounded-md bg-muted" aria-label="Menu item image placeholder" role="img" />
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {variants.map((v) => (
          <label
            key={v.id}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-1 text-sm",
              selectedVariantId === v.id
                ? "border-primary bg-primary/10"
                : "border-input hover:bg-muted"
            )}
          >
            <input
              type="radio"
              name={`variant-${id}`}
              className="sr-only"
              value={v.id}
              checked={selectedVariantId === v.id}
              onChange={() => setSelectedVariantId(v.id)}
            />
            {v.name} — ₹{v.price}
          </label>
        ))}
      </div>

      {modifiers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {modifiers.map((mod) => (
            <label
              key={mod.id}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 text-xs",
                selectedModifiers.has(mod.id)
                  ? "border-primary bg-primary/10"
                  : "border-input hover:bg-muted"
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedModifiers.has(mod.id)}
                onChange={(e) => {
                  const next = new Set(selectedModifiers);
                  if (e.target.checked) next.add(mod.id);
                  else next.delete(mod.id);
                  setSelectedModifiers(next);
                }}
              />
              {mod.name}
            </label>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            className={cn(inputClass, "w-16 px-2 py-1")}
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
          {selectedVariant && (
            <span className="text-sm font-medium">
              ₹{selectedVariant.price}
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={add}
          disabled={outOfStock}
          aria-label="Add to cart"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
