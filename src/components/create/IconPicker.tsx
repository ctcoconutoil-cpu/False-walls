"use client";
import { WallIcon } from "@/components/wall/icons";
import { WALL_ICON_KEYS } from "@/lib/constants";
import { cx } from "@/lib/utils";

const LABEL: Record<string, string> = { ask: "Question", mega: "Megaphone", chat: "Speech bubble", game: "Game controller", ball: "Ball", bulb: "Light bulb" };

/** Every post carries one big icon chosen here. It is the first thing people see on the wall. */
export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Pick an icon <span className="font-normal text-chalk-dim">(required)</span></legend>
      <div className="grid grid-cols-6 gap-2">
        {WALL_ICON_KEYS.map((k) => (
          <label key={k} className={cx("grid h-12 cursor-pointer place-items-center rounded-xl border-2 text-chalk", value === k ? "border-mustard bg-night-3 text-mustard" : "border-night-3 bg-night-2")}>
            <input type="radio" name="wall_icon" value={k} checked={value === k} onChange={() => onChange(k)} className="sr-only" required />
            <WallIcon name={k} size={26} /><span className="sr-only">{LABEL[k] ?? k[0].toUpperCase() + k.slice(1)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
