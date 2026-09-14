"use client";

import { useEffect } from "react";
import type { Permissions } from "@/lib/permissions";
import { mountErp, type ErpView } from "./erp-legacy-core";

export default function ErpLegacyClient({ view, permissions }: { view: ErpView; permissions: Permissions }) {
  useEffect(() => {
    mountErp(view, permissions);
    // The container's innerHTML is fully owned by erp-legacy-core from here
    // on (imperative DOM, same approach as the original mockup) — React
    // never diffs children into #view-root itself, so this is safe.
  }, [view, permissions]);

  return (
    <div>
      <div id="view-root" />
      <div className="overlay" id="overlay">
        <div className="modal" id="modal" />
      </div>
      <div className="toast" id="toast" />
    </div>
  );
}
