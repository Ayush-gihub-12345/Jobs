import { useState } from "react";

export const FILTER_KEYS = [
  "skills", "types", "levels", "categories", "companies",
  "location", "remote", "maxYears", "postedWithin",
];

/** URLSearchParams-shaped filter state that isn't synced to the address bar. */
export function useFilterState() {
  const [params, setParams] = useState(new URLSearchParams());

  const get = (k: string) => params.get(k) ?? "";
  const getList = (k: string) => (params.get(k) ? params.get(k)!.split(",") : []);
  const set = (k: string, v: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v) next.set(k, v); else next.delete(k);
      return next;
    });
  };
  const toggleList = (k: string, v: string) => {
    const cur = getList(k);
    set(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(","));
  };
  const clear = () => setParams(new URLSearchParams());

  return { params, get, getList, set, toggleList, clear };
}
