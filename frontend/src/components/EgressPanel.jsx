import React, { useState, useEffect } from "react";
import { useTenant } from "../context/TenantContext";
import { computeSha256 } from "../utils/crypto";
import { CheckCircle2, XCircle } from "lucide-react";

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
        <h2 className="text-xl font-bold text-[#1c382b] tracking-tight">Cryptographic Egress Proof Panel</h2>
        <p className="text-xs text-[#756449]">
          Proves that SaaS received exactly what the local collector sent, with zero modification or sensitive data leak.
        </p>
      </div>

      {/* Proof Card */}
      <div className="rounded-3xl border border-[#e5dec9] bg-[#faf7f2] p-6 space-y-6 shadow-xs card-hover">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#eee8dc] pb-4">
          <div>
            <div className="text-xs text-[#756449] font-medium">Payload Document ID:</div>
            <div className="text-sm font-mono text-[#1c382b] font-bold">{selectedPayload?.id || "None selected"}</div>
          </div>
          <div className="flex items-center space-x-3">
            {isMatch ? (
              <div className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-2xl bg-[#e6ede7] border border-[#cbdccf] text-[#1c382b] text-xs font-bold shadow-2xs">
                <CheckCircle2 className="h-4 w-4 text-[#37543e]" />
                <span>HASH MATCH (AUTHENTIC)</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                <XCircle className="h-4 w-4" />
                <span>HASH MISMATCH (TAMPERED / CORRUPTED)</span>
              </div>
            )}
          </div>
        </div>

        {/* SHA-256 Hashes Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-[#f5f1e8] p-4 border border-[#e5dec9]">
            <span className="text-[11px] font-bold text-[#756449] uppercase tracking-wider">Tier 1 Sent SHA-256 (Egress Log)</span>
            <div className="font-mono text-xs text-[#1c382b] font-bold break-all mt-2">
              {originalHash || "Awaiting payload..."}
            </div>
          </div>

          <div className="rounded-2xl bg-[#f5f1e8] p-4 border border-[#e5dec9]">
            <span className="text-[11px] font-bold text-[#756449] uppercase tracking-wider">Computed Received SHA-256</span>
            <div className={`font-mono text-xs font-bold break-all mt-2 ${isMatch ? "text-[#1c382b]" : "text-rose-700"}`}>
              {computedHash || "Computing..."}
            </div>
          </div>
        </div>

        {/* JSON Inspector & Interactive Tamper Test */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#24221f]">Exact Egress Payload Body</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSimulateTamper}
                className="px-3 py-1.5 text-xs rounded-xl bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 font-semibold transition btn-tactile cursor-pointer"
              >
                Inject Fake Secret (Tamper Demo)
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs rounded-xl bg-[#f4efe6] text-[#544733] hover:bg-[#e6ede7] hover:text-[#1c382b] border border-[#ded2be] font-semibold transition btn-tactile cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          <textarea
            value={tamperedPayloadJson}
            onChange={(e) => setTamperedPayloadJson(e.target.value)}
            rows={12}
            className="w-full bg-[#f4efe6] border border-[#ded2be] rounded-2xl p-3.5 font-mono text-xs text-[#24221f] focus:outline-none focus:ring-2 focus:ring-[#37543e]/20 focus:border-[#37543e] transition-all"
          />
        </div>
      </div>
    </div>
  );
}
