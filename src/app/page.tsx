'use client';

import { useSupabaseSession } from '@/providers/SupabaseProvider';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { 
  ShieldCheck, 
  Zap, 
  Globe, 
  MapPin, 
  ArrowDown, 
  Smartphone, 
  Lightbulb,  
  Tv,         
  GraduationCap, 
  ArrowRight  
} from 'lucide-react';

export default function Home() {
  const { session } = useSupabaseSession();

  return (
    <div className="bg-white selection:bg-brand-mint selection:text-brand-carbon">
      <Navbar />

      {/* --- HERO SECTION --- */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-20 overflow-hidden bg-brand-primary">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #53E6D4 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <h1 className="text-[12vw] md:text-[8vw] font-black text-white leading-[0.8] tracking-tighter mb-8">
            DASH<span className="text-brand-mint italic">SUB</span>
          </h1>
          <p className="text-brand-gray/60 text-lg md:text-xl max-w-xl mx-auto font-medium mb-12 uppercase tracking-[0.2em]">
            Precision. Speed. Reliability.
          </p>
          <a href="#about" className="inline-flex flex-col items-center gap-4 text-brand-mint font-bold animate-bounce">
            <span className="text-[10px] uppercase tracking-[0.5em]">Scroll to Discover</span>
            <ArrowDown size={20} />
          </a>
        </div>
      </section>

      {/* --- CREATIVE ABOUT US SECTION --- */}
      <section id="about" className="relative py-32 md:py-48 overflow-hidden">
        {/* Large Decorative Text Background */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 text-[25vw] font-black text-gray-50 pointer-events-none select-none z-0">
          KWARA
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row gap-16 lg:gap-8 items-start">
            
            {/* The Creative Image/Feature Stack */}
            <div className="w-full lg:w-1/2 relative">
              <div className="relative aspect-[4/5] md:aspect-square w-full max-w-md mx-auto lg:mx-0">
                {/* Main Dark Block */}
                <div className="absolute inset-0 bg-brand-carbon rounded-[3rem] shadow-2xl rotate-3" />
                
                {/* Inset Content */}
                <div className="absolute inset-0 bg-brand-primary rounded-[3rem] -rotate-3 p-10 flex flex-col justify-end border border-white/5 shadow-inner">
                  <div className="space-y-6">
                    <div className="w-16 h-16 bg-brand-mint rounded-2xl flex items-center justify-center -rotate-12 shadow-xl shadow-brand-mint/20">
                      <ShieldCheck className="text-brand-carbon" size={32} />
                    </div>
                    <h4 className="text-3xl md:text-4xl font-black text-white leading-tight">
                      Rooted in <br /> <span className="text-brand-mint italic">Excellence.</span>
                    </h4>
                    <div className="flex items-center gap-3 text-brand-gray/40">
                      <MapPin size={16} className="text-brand-mint" />
                      <span className="text-xs font-bold uppercase tracking-widest">Kwara State, Nigeria</span>
                    </div>
                  </div>
                </div>

                {/* Floating "Success" Badge */}
                <div className="absolute -top-10 -right-6 md:-right-12 bg-white p-6 rounded-3xl shadow-xl border border-gray-100 hidden sm:block">
                  <div className="text-center">
                    <p className="text-brand-primary text-4xl font-black leading-none">99.9%</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-1">Uptime Rate</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Creative Text Layout */}
            <div className="w-full lg:w-1/2 lg:pt-12">
              <div className="space-y-12">
                <div className="relative">
                  <h2 className="text-brand-primary font-black text-sm uppercase tracking-[0.5em] mb-6 block">Our DNA</h2>
                  <h3 className="text-5xl md:text-7xl font-black text-brand-carbon tracking-tighter leading-[0.9] mb-8">
                    We redefined the <br /> 
                    <span className="text-gray-300">speed of digital.</span>
                  </h3>
                  <div className="w-24 h-2 bg-brand-mint rounded-full mb-8" />
                  <p className="text-gray-500 text-xl leading-relaxed font-medium italic">
                    "DashSub isn't just a platform; it's a commitment to ensuring no Nigerian is left disconnected."
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-12 border-t border-gray-100 pt-12">
                  <div className="space-y-4">
                    <h5 className="text-brand-carbon font-black text-lg flex items-center gap-2">
                      <Zap size={20} className="text-brand-mint" /> The Mission
                    </h5>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      To bridge the gap between complex telecom infrastructure and your everyday needs with one-click automation.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h5 className="text-brand-carbon font-black text-lg flex items-center gap-2">
                      <Globe size={20} className="text-brand-mint" /> The Vision
                    </h5>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Becoming the backbone of digital utility payments across Africa, starting from the heart of Kwara.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- OUR EXCLUSIVE SERVICES SECTION --- */}
      <section id="services" className="py-24 bg-[#FCFCFC] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16">
            <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em] mb-3">Service Suite</p>
            <h3 className="text-2xl font-bold text-brand-carbon tracking-tight">Our Exclusive Offerings</h3>
            <div className="h-0.5 w-6 bg-brand-mint mt-4" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {[
              { title: 'Data', desc: 'SME and Gifting data bundles across all major Nigerian networks.', icon: <Zap size={16} /> },
              { title: 'Airtime', desc: 'High-speed VTU top-up with instant percentage-based discounts.', icon: <Smartphone size={16} /> },
              { title: 'Utility Payments', desc: 'Seamless settlement for prepaid and postpaid electricity meters.', icon: <Lightbulb size={16} /> },
              { title: 'Cable Television', desc: 'Instant renewal services for DStv, GOtv, and StarTimes.', icon: <Tv size={16} /> },
              { title: 'Academic PINs', desc: 'Immediate generation of WAEC and NECO result checker pins.', icon: <GraduationCap size={16} /> },
            ].map((s, i) => (
              <div key={i} className="bg-white p-8 hover:bg-gray-50 transition-colors group">
                <div className="text-brand-primary mb-5 group-hover:translate-y-[-2px] transition-transform duration-300">
                  {s.icon}
                </div>
                <h4 className="text-[12px] font-black text-brand-carbon mb-2 uppercase tracking-wider">
                  {s.title}
                </h4>
                <p className="text-[11px] text-gray-500 leading-relaxed mb-6 font-medium max-w-[220px]">
                  {s.desc}
                </p>
                <Link href="/auth" className="inline-flex items-center gap-2 text-[10px] font-black text-brand-primary uppercase tracking-widest border-b border-transparent hover:border-brand-primary transition-all">
                  Proceed <ArrowRight size={10} />
                </Link>
              </div>
            ))}
            <div className="bg-brand-primary/5 p-8 flex flex-col justify-center items-center text-center">
              <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest opacity-60">System Active</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- REFINED DATA PLANS & PRICES --- */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em] mb-3">Live Rates</p>
            <h3 className="text-2xl font-bold text-brand-carbon tracking-tight">Data Plans & Prices</h3>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { net: 'MTN', color: '#FACC15', rates: [['1GB', '575'], ['2GB', '1,305'], ['5GB', '2,921']] },
              { net: 'GLO', color: '#22C55E', rates: [['1GB', '325'], ['2GB', '578'], ['5GB', '1,622']] },
              { net: 'AIRTEL', color: '#EF4444', rates: [['1GB', '690'], ['2GB', '863'], ['5GB', '1,725']] },
            ].map((item) => (
              <div key={item.net} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
                  <span className="text-[11px] font-black tracking-[0.2em] text-brand-carbon">{item.net}</span>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                </div>
                <div className="p-2">
                  {item.rates.map(([size, price], idx) => (
                    <div key={idx} className="flex justify-between items-center px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors group">
                      <span className="text-[12px] font-bold text-brand-carbon">{size}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-black text-brand-primary">₦{price}</span>
                        <Link href="/signup" className="opacity-0 group-hover:opacity-100 text-[9px] font-black uppercase text-brand-mint transition-opacity">Buy</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <p className="text-[10px] text-gray-400 font-medium italic">* All plans are valid for 30 days.</p>
          </div>
        </div>
      </section>


      <Footer />
    </div>
  );
}