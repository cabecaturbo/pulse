"use client";

import { useEffect } from "react";

export default function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Ask the worker to flush any queued check-ins whenever we come back online.
    const flush = () => navigator.serviceWorker.controller?.postMessage("pulse-flush");
    window.addEventListener("online", flush);
    flush();
    return () => window.removeEventListener("online", flush);
  }, []);
  return null;
}
