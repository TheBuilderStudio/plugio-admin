"use client";

import { createContext, useContext } from "react";

const AdminReadOnlyContext = createContext(false);

export function AdminReadOnlyProvider({
  isReadOnly,
  children,
}: {
  isReadOnly: boolean;
  children: React.ReactNode;
}) {
  return (
    <AdminReadOnlyContext.Provider value={isReadOnly}>
      {children}
    </AdminReadOnlyContext.Provider>
  );
}

/** Prefer this over reading env in client components — matches server assertAdminWritable(). */
export function useAdminReadOnly(): boolean {
  return useContext(AdminReadOnlyContext);
}
