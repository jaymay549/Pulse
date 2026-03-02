import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVendorsList } from "./useSupabaseVendorData";

export function useVendorSearch(
  excludeNames?: string[],
  includeNames?: string[]
) {
  const [search, setSearch] = useState("");

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendor-list-for-search"],
    queryFn: fetchVendorsList,
    staleTime: 10 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (search.trim().length < 2) return [];

    const query = search.toLowerCase();
    const excluded = new Set(
      (excludeNames || []).map((n) => n.toLowerCase())
    );

    // Start with database vendors
    const dbResults = vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(query) &&
        !excluded.has(v.name.toLowerCase())
    );

    // Merge in includeNames (already-added vendors not in the DB list)
    const dbNameSet = new Set(vendors.map((v) => v.name.toLowerCase()));
    const extraResults = (includeNames || [])
      .filter(
        (n) =>
          n.toLowerCase().includes(query) &&
          !excluded.has(n.toLowerCase()) &&
          !dbNameSet.has(n.toLowerCase())
      )
      .map((n) => ({ name: n, count: 0 }));

    return [...dbResults, ...extraResults].slice(0, 8);
  }, [search, vendors, excludeNames, includeNames]);

  return { vendors, search, setSearch, filtered };
}
