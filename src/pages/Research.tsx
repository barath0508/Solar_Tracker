// src/pages/Research.tsx
import { useState } from 'react';
import { BookOpen, FileText, Download, User, Calendar, ExternalLink, Award, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

/* ─── Generate and trigger a real download ─── */
function triggerMockDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const MOCK_BOM_CSV = `Component,Qty,Unit Price (INR),Total (INR),Supplier
ESP32-C6-MINI DevKit,1,450,450,AliExpress / Robu.in
INA219 I2C Power Monitor,1,120,120,Robu.in
DHT11 Temperature Sensor,1,60,60,Amazon India
DS3218 Azimuth Servo (20kg/cm),1,650,650,ServoCity
DS3218 Elevation Servo (15kg/cm),1,550,550,ServoCity
LDR 5mm GL5516,4,5,20,Robu.in
10kΩ Resistor,4,1,4,Local Electronics
Solar Panel 12V 10W,1,800,800,Loom Solar
ESP32-CAM Module,1,380,380,Robu.in
PCB Fabrication (JLCPCB),1,250,250,JLCPCB
Enclosure (ABS),1,200,200,Local
Misc (wires/connectors),1,300,300,Local
,,,
Total,,,,3784 INR
`;

const MOCK_MANUAL_TXT = `
AadhavanAI Solar Tracker – Schematics & Manual v1.0
=====================================================

ESP32-C6 Pin Configuration
---------------------------
GPIO 0  → LDR Top-Left     (ADC1_CH0)
GPIO 1  → LDR Top-Right    (ADC1_CH1)
GPIO 2  → LDR Bottom-Left  (ADC1_CH2)
GPIO 3  → LDR Bottom-Right (ADC1_CH3)
GPIO 6  → INA219 SDA       (I2C)
GPIO 7  → INA219 SCL       (I2C)
GPIO 18 → DHT11 Data
GPIO 20 → Azimuth Servo PWM
GPIO 21 → Elevation Servo PWM
GPIO 9  → Buzzer
3.3V/GND → Common rail

Power Budget (Single Node)
---------------------------
ESP32-C6 Active    : 250 mA @ 3.3V  = 0.83W
Both Servos (load) : 1.5 A @ 5V     = 7.5W
INA219 + DHT11     : 10 mA @ 3.3V   = 0.03W
Total Peak         :                  ~8.36W

Tracking Algorithm
------------------
1. Read all 4 LDR ADC values at 100Hz
2. Compute: δAz = (LDR_TL + LDR_BL) - (LDR_TR + LDR_BR)
3. Compute: δEl = (LDR_TL + LDR_TR) - (LDR_BL + LDR_BR)
4. Apply deadband: if |δAz| < 50 → no azimuth move
5. Step servo by: Δθ = Kp × δAz (default Kp = 0.05°/ADC)
6. Clamp servo range: Azimuth 0–180°, Elevation 15–85°

Fault Codes
-----------
0 = Nominal
1 = Dust/Soiling
2 = Shading
3 = Hotspot/Microcracks
4 = Actuator Blockage
5 = LDR Sensor Failure
6 = High Wind (Safe Stow)
7 = Open Circuit
8 = Short Circuit
9 = Panel Total Failure
`;

const MOCK_PITCH_TXT = `
AadhavanAI Solar Tracker – Investor Pitch Summary
==================================================

Market Opportunity
------------------
India installed 15 GW of solar in 2023-24. Even a 1% penetration of
the rooftop+agricultural solar market represents 150 MW of tracker
opportunity, worth ~₹225 Crore at our target cost.

Efficiency Advantage
--------------------
Fixed tilt panels: 3.5–4.5 kWh/kWp/day in India
AadhavanAI Tracker: 4.5–5.8 kWh/kWp/day (+22–30%)
Payback of additional tracker cost: ~18 months

Financial Model (10kW System)
------------------------------
Fixed panel revenue (yr): ₹1,24,000
Tracker premium revenue : ₹1,58,000  (+₹34,000/yr)
Tracker system cost     : ₹15,000/kW × 10 = ₹1,50,000
ROI on tracker upgrade  : 18 months

Competitive Advantages
----------------------
1. Edge AI running on-chip — no cloud subscription cost
2. Full RBAC management dashboard included
3. OTA firmware updates — no technician visits needed
4. Open hardware Bill of Materials (fully repairable)
5. Telegram alert bot — real-time fleet monitoring
`;

export default function Research() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleDownload = (key: string, filename: string, content: string, mimeType: string) => {
    setDownloading(key);
    setTimeout(() => {
      triggerMockDownload(filename, content, mimeType);
      setDownloading(null);
      setDownloadSuccess(key);
      setTimeout(() => setDownloadSuccess(null), 3000);
    }, 900);
  };

  const citations = [
    {
      title: 'Design and Implementation of an Intelligent Solar Tracking System based on ESP32',
      authors: 'Ledmaoui, A., & Issa, M. G.',
      journal: 'Journal of Renewable Energy Research',
      year: '2023',
      doi: '10.1016/j.jrere.2023.05.012',
      summary: 'Demonstrates 22% yield gain in dry/dusty climates using customized servo tracking and dynamic LDR sensor configurations.',
      tag: 'Hardware & Tracking',
    },
    {
      title: 'Optimizing Photovoltaic Micro-Grids via Microcontroller Edge Computing and CNNs',
      authors: 'Kumar, R., Sharma, V., & Patel, N.',
      journal: 'IEEE Transactions on Industrial Informatics',
      year: '2024',
      doi: '10.1109/TII.2024.3218556',
      summary: 'Evaluates quantization of 1D CNN models to run within 200KB SRAM bounds on embedded hardware for fault diagnostic loops.',
      tag: 'Edge AI & ML',
    },
    {
      title: 'Hotspot Identification and Automated Safeguards in Distributed Solar Arrays',
      authors: 'Babu, S., & Ramakrishnan, G.',
      journal: 'Solar Energy Materials and Solar Cells',
      year: '2025',
      doi: '10.1016/j.solmat.2025.112450',
      summary: 'Analyzes high-side current measurements to identify localized hot-spot resistance spikes and triggers preventative stow angles.',
      tag: 'Fault Detection',
    },
  ];

  const downloads = [
    {
      key: 'bom',
      icon: <FileSpreadsheet className="h-5 w-5" />,
      iconBg: 'bg-emerald-50 text-emerald-600',
      border: 'hover:border-emerald-300',
      title: 'Bill of Materials (BOM)',
      desc: 'Full component list with pricing, suppliers, and cost breakdown.',
      btnLabel: 'CSV',
      filename: 'aadhavanai_bom_v1.0.csv',
      content: MOCK_BOM_CSV,
      mime: 'text/csv',
    },
    {
      key: 'manual',
      icon: <FileText className="h-5 w-5" />,
      iconBg: 'bg-cyan-50 text-cyan-600',
      border: 'hover:border-cyan-300',
      title: 'Schematics & Technical Manual',
      desc: 'ESP32 pin config, power budget, tracking algorithm documentation.',
      btnLabel: 'TXT',
      filename: 'aadhavanai_technical_manual.txt',
      content: MOCK_MANUAL_TXT,
      mime: 'text/plain',
    },
    {
      key: 'pitch',
      icon: <Award className="h-5 w-5" />,
      iconBg: 'bg-purple-50 text-purple-600',
      border: 'hover:border-purple-300',
      title: 'Investor Pitch Summary',
      desc: 'Market projections, ROI calculations, and competitive advantages deck.',
      btnLabel: 'TXT',
      filename: 'aadhavanai_investor_pitch.txt',
      content: MOCK_PITCH_TXT,
      mime: 'text/plain',
    },
  ];

  return (
    <div className="relative min-h-screen bg-slate-50 py-16 px-6 overflow-hidden">
      <div className="absolute top-1/4 left-1/4 h-[350px] w-[350px] bg-amber-500/8 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-0 h-[300px] w-[300px] bg-purple-500/6 rounded-full blur-3xl -z-10" />

      <div className="max-w-6xl mx-auto space-y-16">

        {/* Title */}
        <div className="text-center space-y-3">
          <div className="inline-block text-[10px] font-mono font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            Academic Research
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter">
            Research & Downloads
          </h1>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            Peer-reviewed literature, technical documentation, and open-source assets powering AadhavanAI.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 text-left">

          {/* Citations */}
          <div className="lg:col-span-7 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
                <BookOpen className="text-amber-500 h-5 w-5" /> Literature Citations
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">PEER_REVIEWED_THEORY_INTEGRATION</p>
            </div>

            <div className="space-y-5">
              {citations.map((cite, idx) => (
                <div key={idx} className="glass-card p-6 rounded-2xl border border-slate-200 bg-white hover:border-cyan-300 transition duration-300 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-black text-slate-800 leading-snug font-sans uppercase tracking-wide">{cite.title}</h3>
                    <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border bg-slate-50 text-slate-500 border-slate-200 font-mono whitespace-nowrap">
                      {cite.tag}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1 font-bold"><User className="h-3.5 w-3.5 text-cyan-600" /> {cite.authors}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-cyan-600" /> {cite.year}</span>
                    <span className="text-amber-600 font-extrabold">{cite.journal}</span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">{cite.summary}</p>

                  <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-2.5 flex items-center justify-between">
                    <span>DOI:{' '}
                      <a href={`https://doi.org/${cite.doi}`} target="_blank" rel="noreferrer"
                        className="text-cyan-600 hover:text-cyan-700 underline inline-flex items-center gap-0.5 transition">
                        {cite.doi} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </span>
                    <span className="text-slate-300 font-mono">Ref {String(idx + 1).padStart(2, '0')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Downloads */}
          <div className="lg:col-span-5 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
                <Download className="text-amber-500 h-5 w-5" /> Project Downloads
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">OPEN_SOURCE_ASSETS_DISTRIBUTION</p>
            </div>

            <div className="space-y-3">
              {downloads.map(dl => (
                <div key={dl.key}
                  className={`p-5 bg-white border border-slate-200 ${dl.border} rounded-2xl flex items-center justify-between group transition duration-300 shadow-sm`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${dl.iconBg} group-hover:opacity-90 transition`}>
                      {dl.icon}
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">{dl.title}</h3>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-normal">{dl.desc}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(dl.key, dl.filename, dl.content, dl.mime)}
                    disabled={downloading === dl.key}
                    className="px-3.5 py-2 bg-white border border-slate-200 hover:border-current text-[10px] font-black uppercase tracking-wider text-slate-700 rounded-xl flex items-center gap-1.5 transition shadow-sm hover:bg-slate-50 cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {downloadSuccess === dl.key ? (
                      <><CheckCircle className="h-3 w-3 text-emerald-500" /> Done</>
                    ) : downloading === dl.key ? (
                      <><span className="h-3 w-3 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" /> Exporting…</>
                    ) : (
                      <><Download className="h-3 w-3" /> {dl.btnLabel}</>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Info box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-blue-600">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider mb-1">Open Source Notice</p>
                <p className="text-[10px] text-blue-500 leading-relaxed">
                  All hardware designs and firmware are released under MIT License.
                  Contributions welcome on GitHub.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
