"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { fetchUnit } from "@/lib/checkin/api";
import type { UnitInfo } from "@/lib/checkin/types";

/**
 * Print-ready break-room poster: big QR, the promise in one breath, the
 * trust URL. Beautiful enough to survive a break room wall.
 */
export default function Poster({ code }: { code: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [unit, setUnit] = useState<UnitInfo | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const url = `${window.location.origin}/p/${code}`;
    QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: "#0b1220" } }).then(setQr);
    fetchUnit(code).then(setUnit);
  }, [code]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-200 p-6 print:bg-white print:p-0">
      <div className="w-full max-w-[210mm] bg-white p-14 text-slate-900 shadow-2xl print:shadow-none">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.3em] text-teal-700">
          Pulse · {unit ? unit.unit_name : code}
        </p>
        <h1 className="mt-4 text-center text-5xl font-bold leading-tight tracking-tight">
          How was your shift?
        </h1>

        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code for ${origin}/p/${code}`} className="mx-auto mt-10 w-72" />
        ) : (
          <div className="mx-auto mt-10 h-72 w-72 animate-pulse bg-slate-100" />
        )}
        <p className="mt-3 text-center font-mono text-sm text-slate-500">
          {origin}/p/{code}
        </p>

        <div className="mx-auto mt-10 max-w-md text-center">
          <p className="text-2xl font-semibold leading-snug">
            30 seconds. No login. No names.
          </p>
          <p className="mt-3 text-lg leading-snug text-slate-600">
            Nothing is shown to anyone until 5+ of you respond.
          </p>
        </div>

        <p className="mt-12 text-center text-sm text-slate-500">
          The full promise, in plain English: <strong>{origin}/trust</strong>
        </p>

        <button
          onClick={() => window.print()}
          className="mx-auto mt-10 block rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white print:hidden"
        >
          Print this poster
        </button>
      </div>
    </main>
  );
}
