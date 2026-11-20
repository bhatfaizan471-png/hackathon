import React, { useState, useEffect } from "react";
import { useTenant } from "../context/TenantContext";
import { computeSha256 } from "../utils/crypto";
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export default function EgressPanel() {
  const { telemetry, activeTenant } = useTenant();
  const [selectedPayload, setSelectedPayload] = useState(null);
  const [tamperedPayloadJson, setTamperedPayloadJson] = useState("");
  const [computedHash, setComputedHash] = useState("");
  const [isTampered, setIsTampered] = useState(false);

  const latestTelemetry = telemetry[telemetry.length - 1];

  useEffect(() => {
    if (latestTelemetry && !selectedPayload) {
      setSelectedPayload(latestTelemetry);
    }
  }, [latestTelemetry, selectedPayload]);

  useEffect(() => {
    if (selectedPayload) {
      const cleanCopy = { ...selectedPayload };
      delete cleanCopy.received_time_utc;
      delete cleanCopy.payload_sha256;
      delete cleanCopy.ingest_latency_ms;
      delete cleanCopy.id;
      const jsonStr = JSON.stringify(cleanCopy, null, 2);
      setTamperedPayloadJson(jsonStr);
      setIsTampered(false);
    }
  }, [selectedPayload]);

  useEffect(() => {
    if (tamperedPayloadJson) {
      computeSha256(tamperedPayloadJson).then(setComputedHash);
    }
  }, [tamperedPayloadJson]);

  const originalHash = selectedPayload?.payload_sha256;
  const isMatch = computedHash && originalHash && computedHash.toLowerCase() === originalHash.toLowerCase();

  const handleSimulateTamper = () => {
    try {
      const parsed = JSON.parse(tamperedPayloadJson);
      parsed.leak_injected_password = "StolenCredentials123";
      setTamperedPayloadJson(JSON.stringify(parsed, null, 2));
      setIsTampered(true);
    } catch (e) {
      // ignore
    }
  };

  const handleReset = () => {
    if (selectedPayload) {
      const cleanCopy = { ...selectedPayload };
      delete cleanCopy.received_time_utc;
      delete cleanCopy.payload_sha256;
      delete cleanCopy.ingest_latency_ms;
      delete cleanCopy.id;
      setTamperedPayloadJson(JSON.stringify(cleanCopy, null, 2));
      setIsTampered(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Cryptographic Egress Proof Panel</h2>
        <p className="text-xs text-slate-400">
          Proves that SaaS received exactly what the local collector sent, with zero modification or sensitive data leak.
        </p>
      </div>

      {/* Proof Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs text-slate-400">Payload ID:</div>
            <div className="text-sm font-mono text-cyan-400 font-bold">{selectedPayload?.id || "None selected"}</div>
          </div>
          <div className="flex items-center space-x-3">
            {isMatch ? (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-800/60 text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>HASH MATCH (AUTHENTIC)</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-950 border border-rose-800/60 text-rose-400 text-xs font-bold">
                <XCircle className="h-4 w-4" />
                <span>HASH MISMATCH (TAMPERED / CORRUPTED)</span>
              </div>
            )}
          </div>
        </div>

        {/* SHA-256 Hashes Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tier 1 Sent SHA-256 (Egress Log)</span>
            <div className="font-mono text-xs text-emerald-400 break-all mt-2">
              {originalHash || "Awaiting payload..."}
            </div>
          </div>

          <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Computed Received SHA-256</span>
            <div className={`font-mono text-xs break-all mt-2 ${isMatch ? "text-emerald-400" : "text-rose-400"}`}>
              {computedHash || "Computing..."}
            </div>
          </div>
        </div>

        {/* JSON Inspector & Interactive Tamper Test */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Exact Egress Payload Body</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSimulateTamper}
                className="px-2.5 py-1 text-xs rounded bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 transition"
              >
                Inject Fake Secret (Tamper Demo)
              </button>
              <button
                onClick={handleReset}
                className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Reset
              </button>
            </div>
          </div>

          <textarea
            value={tamperedPayloadJson}
            onChange={(e) => setTamperedPayloadJson(e.target.value)}
            rows={12}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>
    </div>
  );
}
