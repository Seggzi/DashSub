import Link from 'next/link';
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin, ArrowRight } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="footer" className="bg-brand-carbon text-brand-gray pt-20 pb-10 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          
          {/* Brand Column */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="bg-brand-mint p-1 rounded-lg">
                <div className="bg-brand-carbon text-brand-mint font-black px-2 py-0.5 rounded-sm text-sm">DS</div>
              </div>
              <span className="text-2xl font-black text-white tracking-tighter">
                DASH<span className="text-brand-mint">SUB</span>
              </span>
            </Link>
            <p className="text-brand-gray/60 leading-relaxed text-sm">
              Empowering Nigerians with the fastest and most affordable automated telecom services. Data, airtime, and utility bills simplified.
            </p>
            <div className="flex gap-4">
              {[Facebook, Twitter, Instagram].map((Icon, i) => (
                <Link key={i} href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-brand-mint hover:text-brand-carbon transition-all">
                  <Icon size={18} />
                </Link>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-xs">Quick Links</h4>
            <ul className="space-y-4 text-sm text-brand-gray/60">
              {['Home', 'Services', 'Pricing', 'About Us', 'Contact'].map((item) => (
                <li key={item}>
                  <Link href={`#${item.toLowerCase()}`} className="hover:text-brand-mint transition-colors flex items-center gap-2 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-mint scale-0 group-hover:scale-100 transition-transform" />
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-xs">Services</h4>
            <ul className="space-y-4 text-sm text-brand-gray/60">
              {['Buy Cheap Data', 'Airtime Topup', 'Electricity Bills', 'Cable TV Sub', 'Print Result Checker'].map((item) => (
                <li key={item}>
                  <Link href="#" className="hover:text-brand-mint transition-colors">{item}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-widest text-xs">Support</h4>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3 text-brand-gray/60">
                <Mail size={18} className="text-brand-mint shrink-0" />
                <span>dashsub.ng@gmail.com</span>
              </div>
              <div className="flex items-start gap-3 text-brand-gray/60">
                <Phone size={18} className="text-brand-mint shrink-0" />
                <span>+234 8059873173</span>
              </div>
              <div className="flex items-start gap-3 text-brand-gray/60">
                <MapPin size={18} className="text-brand-mint shrink-0" />
                <span>Kwara, Nigeria.</span>
              </div>
              
              {/* Newsletter Small */}
              <div className="pt-4">
                <div className="relative group">
                  <input 
                    type="email" 
                    placeholder="Email Updates" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-brand-mint transition-all"
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-mint p-1">
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-xs text-brand-gray/40">
            &copy; {currentYear} DashSub Technologies. All rights reserved.
          </p>
          <div className="flex gap-8 text-xs text-brand-gray/40">
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-white transition-colors">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}