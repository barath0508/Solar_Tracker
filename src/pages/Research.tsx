// src/pages/Research.tsx
import { useState } from 'react';
import { BookOpen, FileText, Download, User, Calendar, ExternalLink, Award, FileSpreadsheet } from 'lucide-react';


export default function Research() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (filename: string) => {
    setDownloading(filename);
    setTimeout(() => {
      setDownloading(null);
      // Simulate file download
      alert(`📥 Mock Download Completed: ${filename}`);
    }, 1200);
  };

  const citations = [
    {
      title: "Design and Implementation of an Intelligent Solar Tracking System based on ESP32",
      authors: "Ledmaoui, A., & Issa, M. G.",
      journal: "Journal of Renewable Energy Research",
      year: "2023",
      doi: "10.1016/j.jrere.2023.05.012",
      summary: "Demonstrates 22% yield gain in dry/dusty climates using customized servo tracking and dynamic LDR sensors configurations."
    },
    {
      title: "Optimizing Photovoltaic Micro-Grids via Microcontroller Edge Computing and CNNs",
      authors: "Kumar, R., Sharma, V., & Patel, N.",
      journal: "IEEE Transactions on Industrial Informatics",
      year: "2024",
      doi: "10.1109/TII.2024.3218556",
      summary: "Evaluates quantization of 1D CNN models to run within 200KB SRAM bounds on embedded hardware for fault diagnostic loops."
    },
    {
      title: "Hotspot Identification and Automated Safeguards in Distributed Solar Arrays",
      authors: "Babu, S., & Ramakrishnan, G.",
      journal: "Solar Energy Materials and Solar Cells",
      year: "2025",
      doi: "10.1016/j.solmat.2025.112450",
      summary: "Analyzes high-side current measurements to identify localized hot-spot resistance spikes and triggers preventative stow angles."
    }
  ];

  return (
    <div className="relative min-h-screen bg-slate-55 py-16 px-6">
      <div className="absolute top-1/4 left-1/4 h-[350px] w-[350px] bg-amber-500/10 rounded-full blur-3xl -z-10" />
      
      <div className="max-w-6xl mx-auto space-y-16">
        
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter">Academic Research & Downloads</h1>
          <p className="text-cyan-605 font-mono text-[10px] tracking-widest uppercase">SYS_ACADEMIC_RESOURCES</p>
        </div>

        {/* 📚 Citations Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 text-left">
          
          <div className="lg:col-span-7 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
                <BookOpen className="text-amber-550 h-5.5 w-5.5" /> Literature Citing
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">PEER_REVIEWED_THEORY_INTEGRATION</p>
            </div>

            <div className="space-y-6">
              {citations.map((cite, idx) => (
                <div key={idx} className="glass-card p-6 rounded-2xl border border-slate-200 bg-white hover:border-cyan-300 transition space-y-3 shadow-sm">
                  <h3 className="text-sm font-black text-slate-850 leading-snug font-sans uppercase tracking-wide">{cite.title}</h3>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1 font-bold"><User className="h-3.5 w-3.5 text-cyan-600" /> {cite.authors}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-cyan-600" /> {cite.year}</span>
                    <span className="text-amber-600 font-extrabold">{cite.journal}</span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{cite.summary}</p>
                  
                  <span className="text-[10px] text-slate-450 block font-mono border-t border-slate-100 pt-2.5">
                    DOI: <a href={`https://doi.org/${cite.doi}`} target="_blank" rel="noreferrer" className="text-cyan-605 hover:text-cyan-700 underline inline-flex items-center gap-0.5">{cite.doi} <ExternalLink className="h-2.5 w-2.5" /></a>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 📥 Downloads Module */}
          <div className="lg:col-span-5 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
                <Download className="text-amber-550 h-5.5 w-5.5" /> Project Downloads
              </h2>
              <p className="text-xs text-slate-450 font-mono mt-0.5">OPEN_SOURCE_ASSETS_DISTRIBUTION</p>
            </div>

            <div className="space-y-4">
              
              {/* BOM Download Card */}
              <div className="p-5 bg-white border border-slate-200 hover:border-emerald-350 rounded-2xl flex items-center justify-between group transition duration-300 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100/50 transition duration-300">
                    <FileSpreadsheet className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Bill of Materials (BOM)</h3>
                    <p className="text-[10px] text-slate-550 mt-1 max-w-[200px] leading-normal">Pricing, components database, and target cost listings.</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDownload('aadhavanai_bom_v1.0.xlsx')}
                  className="px-4 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-[10px] font-black uppercase tracking-wider text-slate-700 rounded-xl flex items-center gap-1 transition shadow-sm hover:bg-slate-50 cursor-pointer"
                >
                  {downloading === 'aadhavanai_bom_v1.0.xlsx' ? 'ING...' : <><Download className="h-3 w-3" /> XLS</>}
                </button>
              </div>

              {/* Datasheet Download Card */}
              <div className="p-5 bg-white border border-slate-200 hover:border-cyan-350 rounded-2xl flex items-center justify-between group transition duration-300 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-55 text-cyan-605 rounded-xl group-hover:bg-cyan-100/50 transition duration-300">
                    <FileText className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Schematics & Manual</h3>
                    <p className="text-[10px] text-slate-550 mt-1 max-w-[200px] leading-normal">PDF detailing ESP32 pin configuration and loads calculations.</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDownload('aadhavanai_datasheets.pdf')}
                  className="px-4 py-2 bg-white border border-slate-200 hover:border-cyan-300 text-[10px] font-black uppercase tracking-wider text-slate-700 rounded-xl flex items-center gap-1 transition shadow-sm hover:bg-slate-50 cursor-pointer"
                >
                  {downloading === 'aadhavanai_datasheets.pdf' ? 'ING...' : <><Download className="h-3 w-3" /> PDF</>}
                </button>
              </div>

              {/* Presentation Download Card */}
              <div className="p-5 bg-white border border-slate-200 hover:border-purple-350 rounded-2xl flex items-center justify-between group transition duration-300 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-55 text-purple-655 rounded-xl group-hover:bg-purple-100/50 transition duration-300">
                    <Award className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Investor Pitch Slides</h3>
                    <p className="text-[10px] text-slate-550 mt-1 max-w-[200px] leading-normal">Market projections, efficiency math, and ROI charts deck.</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDownload('aadhavanai_investor_deck.pptx')}
                  className="px-4 py-2 bg-white border border-slate-200 hover:border-purple-350 text-[10px] font-black uppercase tracking-wider text-slate-700 rounded-xl flex items-center gap-1 transition shadow-sm hover:bg-slate-50 cursor-pointer"
                >
                  {downloading === 'aadhavanai_investor_deck.pptx' ? 'ING...' : <><Download className="h-3 w-3" /> PPTX</>}
                </button>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
