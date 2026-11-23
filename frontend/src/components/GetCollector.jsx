import React, { useState } from "react";
import {
  Download,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Server,
  KeyRound,
  Cpu,
  Layers,
  HelpCircle,
  Trash2,
  ExternalLink,
  Lock,
} from "lucide-react";

const SHA256_HASH = "e1c42cbcab543353cce03e2db86b97691e91d59104b570d241627136cb54cd30";
const GITHUB_REPO = "https://github.com/bhatfaizan471-png/hackathon.git";
const BACKEND_URL = "https://hackathon-2-09sm.onrender.com";

export default function GetCollector({ onBack }) {
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(null);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    if (key === "sha") {
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    } else {
      setCopiedCmd(key);
      setTimeout(() => setCopiedCmd(null), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#24221f] font-sans relative overflow-x-hidden pb-16">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] bg-[#60896a]/8 rounded-full blur-3xl animate-soft-pulse" />
        <div className="absolute top-1/2 -left-32 w-[420px] h-[420px] bg-[#b5a281]/12 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-[360px] h-[360px] bg-[#37543e]/6 rounded-full blur-3xl" />
      </div>

      {/* Top Header Bar */}
      <header className="border-b border-[#e5dec9] bg-[#faf7f2]/95 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="h-0.5 bg-gradient-to-r from-[#1c382b] via-[#60896a] to-[#b5a281] w-full" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-[#1c382b] flex items-center justify-center shadow-sm">
              <Server className="h-4 w-4 text-[#cbdccf]" />
            </div>
            <div>
              <span className="font-bold text-[#1c382b] text-base tracking-tight">Nexus Observe</span>
              <span className="ml-2 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#e6ede7] text-[#1c382b] border border-[#cbdccf]">
                Collector Setup
              </span>
            </div>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-[#ded2be] bg-[#faf7f2] hover:bg-[#f2ece0] text-xs font-semibold text-[#544733] btn-tactile cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 relative z-10">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#e6ede7] border border-[#cbdccf] text-[#1c382b] text-xs font-semibold shadow-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-[#37543e]" />
            <span>Privacy-First Two-Tier Observability</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1c382b] tracking-tight">
            Install the Nexus Collector
          </h1>
          <p className="text-sm text-[#544733] leading-relaxed">
            Stream real-time host performance (CPU, memory, disk, network loss) to your Nexus Observe dashboard with
            cryptographic privacy guarantees and zero personal identifiable data transmission.
          </p>
        </div>

        {/* Privacy Callout Banner */}
        <div className="bg-[#eef4f0] border border-[#cbdccf] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="h-10 w-10 rounded-xl bg-[#1c382b] flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5 text-[#cbdccf]" />
          </div>
          <div className="text-xs text-[#24221f] leading-relaxed flex-1">
            <span className="font-bold text-[#1c382b]">Zero PII Guarantee: </span>
            The collector captures system performance counters only. It never accesses, stores, or transmits usernames,
            passwords, hostnames, IP addresses, private keys, or command outputs. Host identity is pseudonymous.
          </div>
        </div>

        {/* Before You Start Card */}
        <div className="bg-[#faf7f2] border border-[#e5dec9] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-[#eee8dc] pb-3">
            <CheckCircle2 className="h-4 w-4 text-[#37543e]" />
            <h2 className="text-sm font-bold text-[#1c382b] uppercase tracking-wide">Before You Start (Prerequisites)</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl border border-[#ded2be] bg-[#f4f0e6]/60 space-y-1">
              <span className="font-bold text-[#1c382b] block">1. Windows 10 or 11</span>
              <p className="text-[#544733]">64-bit Windows PC or laptop with internet access.</p>
            </div>
            <div className="p-3.5 rounded-xl border border-[#ded2be] bg-[#f4f0e6]/60 space-y-1">
              <span className="font-bold text-[#1c382b] block">2. Python 3.10+</span>
              <p className="text-[#544733]">
                Download from <a href="https://www.python.org/" target="_blank" rel="noreferrer" className="underline font-semibold text-[#1c382b]">python.org</a>.
                Check <em>"Add python.exe to PATH"</em> during install.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-[#ded2be] bg-[#f4f0e6]/60 space-y-1">
              <span className="font-bold text-[#1c382b] block">3. Workspace Credentials</span>
              <p className="text-[#544733]">
                Your administrator provides <strong>Tenant ID</strong>, <strong>Collector ID</strong>, and <strong>Collector Key</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Installation Options (Two Cards: Easy ZIP vs GitHub Clone) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Easy Way: ZIP Download */}
          <div className="bg-[#faf7f2] border-2 border-[#37543e]/40 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5 relative">
            <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-[#1c382b] text-[#faf7f2] text-[10px] font-bold tracking-wider uppercase">
              Recommended: Easiest Setup
            </div>

            <div className="space-y-4 pt-1">
              <div className="flex items-center space-x-2">
                <Download className="h-5 w-5 text-[#37543e]" />
                <h3 className="text-base font-bold text-[#1c382b]">Option A: Download Standalone ZIP</h3>
              </div>
              <p className="text-xs text-[#544733] leading-relaxed">
                Pre-packaged standalone collector with one-click setup scripts. No git commands or repository cloning needed.
              </p>

              {/* Big Download Button */}
              <div className="pt-2">
                <a
                  href="/downloads/nexus-collector.zip"
                  download="nexus-collector.zip"
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl shadow-md shadow-[#1c382b]/15 text-xs font-bold text-[#faf7f2] bg-[#1c382b] hover:bg-[#14291f] btn-tactile transition-all"
                >
                  <Download className="h-4 w-4" />
                  <span>Download nexus-collector.zip (25.3 KB)</span>
                </a>
              </div>

              {/* SHA-256 Box */}
              <div className="p-3 rounded-xl border border-[#ded2be] bg-[#f4f0e6]/70 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#756449]">
                  <span>SHA-256 Checksum</span>
                  <button
                    onClick={() => copyToClipboard(SHA256_HASH, "sha")}
                    className="flex items-center space-x-1 text-[10px] text-[#1c382b] hover:underline cursor-pointer"
                  >
                    {copiedSha ? <Check className="h-3 w-3 text-[#37543e]" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedSha ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="font-mono text-[10px] text-[#24221f] break-all select-all bg-[#faf7f2] p-1.5 rounded border border-[#e5dec9]">
                  {SHA256_HASH}
                </div>
              </div>

              {/* Instructions steps */}
              <div className="space-y-2 text-xs pt-1">
                <div className="flex items-start space-x-2">
                  <span className="h-5 w-5 rounded-full bg-[#e6ede7] text-[#1c382b] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Unzip <code className="bg-[#f2ece0] px-1 rounded">nexus-collector.zip</code> to a folder on your computer.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="h-5 w-5 rounded-full bg-[#e6ede7] text-[#1c382b] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>Double-click <code className="bg-[#f2ece0] px-1 rounded font-semibold text-[#1c382b]">setup.bat</code>. Enter your Tenant ID, Collector ID, and Collector Key when prompted.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="h-5 w-5 rounded-full bg-[#e6ede7] text-[#1c382b] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>Double-click <code className="bg-[#f2ece0] px-1 rounded font-semibold text-[#1c382b]">run_collector.bat</code> to start streaming metrics.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Developer Way: GitHub Clone */}
          <div className="bg-[#faf7f2] border border-[#e5dec9] rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Terminal className="h-5 w-5 text-[#1c382b]" />
                <h3 className="text-base font-bold text-[#1c382b]">Option B: Clone with Git</h3>
              </div>
              <p className="text-xs text-[#544733] leading-relaxed">
                For developers who want full repository source code and terminal workflow.
              </p>

              {/* Terminal Command Blocks with Copy */}
              <div className="space-y-2.5">
                {[
                  { id: "cmd1", label: "Clone repository", cmd: `git clone ${GITHUB_REPO}` },
                  { id: "cmd2", label: "Enter directory", cmd: "cd hackathon" },
                  { id: "cmd3", label: "Open in VS Code (optional)", cmd: "code ." },
                ].map((item) => (
                  <div key={item.id} className="p-2.5 rounded-xl border border-[#ded2be] bg-[#f4f0e6]/70">
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#756449] mb-1">
                      <span>{item.label}</span>
                      <button
                        onClick={() => copyToClipboard(item.cmd, item.id)}
                        className="flex items-center space-x-1 text-[#1c382b] hover:underline cursor-pointer"
                      >
                        {copiedCmd === item.id ? <Check className="h-2.5 w-2.5 text-[#37543e]" /> : <Copy className="h-2.5 w-2.5" />}
                        <span>{copiedCmd === item.id ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <code className="block font-mono text-[11px] text-[#1c382b] bg-[#faf7f2] p-1.5 rounded border border-[#e5dec9] select-all">
                      {item.cmd}
                    </code>
                  </div>
                ))}
              </div>

              {/* Quick CLI Steps */}
              <div className="space-y-1.5 text-xs text-[#544733] pt-1">
                <p>Run these commands inside <code className="bg-[#f2ece0] px-1 rounded">hackathon</code>:</p>
                <div className="p-2.5 rounded-xl bg-[#24221f] text-[#faf7f2] font-mono text-[11px] space-y-1">
                  <div className="text-emerald-400"># 1. Setup environment</div>
                  <div>python -m venv .venv</div>
                  <div>.\.venv\Scripts\python.exe -m pip install -r collector\requirements.txt</div>
                  <div className="text-emerald-400 pt-1"># 2. Configure credentials</div>
                  <div>copy settings.example.env .env</div>
                  <div className="text-emerald-400 pt-1"># 3. Test and run</div>
                  <div>.\.venv\Scripts\python.exe -m collector.check</div>
                  <div>.\.venv\Scripts\python.exe -m collector.collector</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Check It Worked Card */}
        <div className="bg-[#faf7f2] border border-[#e5dec9] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-[#eee8dc] pb-3">
            <CheckCircle2 className="h-4 w-4 text-[#37543e]" />
            <h2 className="text-sm font-bold text-[#1c382b] uppercase tracking-wide">Check That It Worked</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <span className="font-bold text-[#1c382b]">1. Preflight Verification Output</span>
              <p className="text-[#544733]">
                When <code className="bg-[#f2ece0] px-1 rounded">collector.check</code> runs, you will see a clean green confirmation:
              </p>
              <div className="p-3 rounded-xl bg-[#24221f] text-[#faf7f2] font-mono text-[10px] space-y-0.5">
                <div className="text-emerald-400">PASS: Backend service is reachable (HTTP 200).</div>
                <div className="text-emerald-400">PASS: Authentication verified! Ingest accepted test payload.</div>
                <div className="text-emerald-400">PASS: Tenant boundary and collector key validation succeeded.</div>
                <div className="text-stone-400 pt-1">SUCCESS: Collector is configured correctly and ready to run.</div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-[#1c382b]">2. Live Dashboard Appearance</span>
              <p className="text-[#544733]">
                Once <code className="bg-[#f2ece0] px-1 rounded">run_collector.bat</code> is running, switch to the <strong>Fleet</strong> tab in your Nexus Observe dashboard.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[#544733]">
                <li>Your machine appears with a pseudonymous Source ID (e.g., <code className="font-mono text-[#1c382b]">src_a52e58e393</code>).</li>
                <li>Health status shows a pulsing green beacon with <span className="font-semibold text-emerald-800">Healthy</span>.</li>
                <li>Live CPU, RAM, Disk, and Network bandwidth update every 5 seconds.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* What the Collector Sends (Allow-list vs Prohibited) */}
        <div className="bg-[#faf7f2] border border-[#e5dec9] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-[#eee8dc] pb-3">
            <Cpu className="h-4 w-4 text-[#1c382b]" />
            <h2 className="text-sm font-bold text-[#1c382b] uppercase tracking-wide">
              What the Collector Sends vs. Strictly Never Sends
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Allowed Column */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
              <div className="flex items-center space-x-1.5 font-bold text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <span>Allowed System Metrics (Strict Allow-List)</span>
              </div>
              <ul className="space-y-1 text-emerald-800">
                <li>• <strong>CPU & Memory:</strong> Aggregate system utilization percentage.</li>
                <li>• <strong>Disk:</strong> Percentage of storage space currently utilized.</li>
                <li>• <strong>Network Loss:</strong> Ping packet loss percentage to local gateway.</li>
                <li>• <strong>Bandwidth:</strong> Overall inbound and outbound rate in kbps.</li>
                <li>• <strong>Security Counter:</strong> Aggregate failed login count (number only).</li>
                <li>• <strong>Source ID:</strong> One-way salted SHA-256 hash (never real hostname).</li>
              </ul>
            </div>

            {/* Prohibited Column */}
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
              <div className="flex items-center space-x-1.5 font-bold text-rose-900">
                <XCircle className="h-4 w-4 text-rose-700" />
                <span>Strictly Prohibited & Never Sent</span>
              </div>
              <ul className="space-y-1 text-rose-800">
                <li>• <strong>No Usernames or Passwords:</strong> Never collected or transmitted.</li>
                <li>• <strong>No IP Addresses:</strong> Internal and external IPs are never stored.</li>
                <li>• <strong>No Hostnames:</strong> Machine computer names are hashed locally.</li>
                <li>• <strong>No Raw Log Text:</strong> Log files are scanned for counts only; zero log text is sent.</li>
                <li>• <strong>No Command Lines:</strong> Running process names or CLI args are never read.</li>
                <li>• <strong>No File Paths or Data:</strong> User documents and directories are untouched.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Troubleshooting Section */}
        <div className="bg-[#faf7f2] border border-[#e5dec9] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-[#eee8dc] pb-3">
            <HelpCircle className="h-4 w-4 text-[#756449]" />
            <h2 className="text-sm font-bold text-[#1c382b] uppercase tracking-wide">Troubleshooting Common Issues</h2>
          </div>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl border border-[#ded2be] bg-[#f4f0e6]/50">
              <span className="font-bold text-[#1c382b] block">"Python was not found" or unrecognized command</span>
              <p className="text-[#544733] mt-1">
                Download Python from python.org and re-run the installer. Make sure to check the box
                <em> "Add python.exe to PATH"</em> on the very first screen.
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[#ded2be] bg-[#f4f0e6]/50">
              <span className="font-bold text-[#1c382b] block">"FAIL: Authentication failed (HTTP 401 Unauthorized)"</span>
              <p className="text-[#544733] mt-1">
                Your <code className="bg-[#f2ece0] px-1 rounded">COLLECTOR_KEY</code> or <code className="bg-[#f2ece0] px-1 rounded">COLLECTOR_ID</code> in <code className="bg-[#f2ece0] px-1 rounded">.env</code> is incorrect. Ask your workspace admin to provide your collector secret key.
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[#ded2be] bg-[#f4f0e6]/50">
              <span className="font-bold text-[#1c382b] block">"FAIL: Permission denied (HTTP 403 Forbidden)"</span>
              <p className="text-[#544733] mt-1">
                The collector is registered to a different tenant. Ensure your <code className="bg-[#f2ece0] px-1 rounded">TENANT_ID</code> in <code className="bg-[#f2ece0] px-1 rounded">.env</code> matches your company's tenant identifier.
              </p>
            </div>
            <div className="p-3 rounded-xl border border-[#ded2be] bg-[#f4f0e6]/50">
              <span className="font-bold text-[#1c382b] block">"FAIL: Could not reach backend server"</span>
              <p className="text-[#544733] mt-1">
                Check that you have outbound internet access to <code className="bg-[#f2ece0] px-1 rounded">{BACKEND_URL}</code>. If behind a corporate proxy, configure standard HTTPS proxy environment variables.
              </p>
            </div>
          </div>
        </div>

        {/* How to Stop & Remove Card */}
        <div className="bg-[#faf7f2] border border-[#e5dec9] rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 border-b border-[#eee8dc] pb-3">
            <Trash2 className="h-4 w-4 text-[#756449]" />
            <h2 className="text-sm font-bold text-[#1c382b] uppercase tracking-wide">How to Stop and Remove</h2>
          </div>
          <div className="text-xs text-[#544733] leading-relaxed space-y-2">
            <p>
              <strong>To Stop: </strong> Simply switch to the console window running the collector and press <kbd className="bg-[#ded2be] px-1.5 py-0.5 rounded font-mono text-[11px] text-[#24221f]">Ctrl+C</kbd>, or close the window.
            </p>
            <p>
              <strong>To Completely Uninstall: </strong> Delete the folder. Nexus Observe Collector runs as a self-contained portable script. It installs no Windows services, registers no background startup tasks, and touches no Windows registry entries.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
