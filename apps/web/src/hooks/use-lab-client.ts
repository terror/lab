import { useContext } from "react";
import { LabContext } from "@/providers/lab";

export function useLabClient() {
  const client = useContext(LabContext);

  if (client === undefined) {
    throw new Error("Lab hooks require a LabProvider.");
  }

  return client;
}
