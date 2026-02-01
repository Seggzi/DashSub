'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSupabaseSession } from '@/providers/SupabaseProvider';
import { Menu, X, ArrowUpRight } from 'lucide-react';

const NAV_LINKS = [
  { name: 'Home', href: '/' },
  { name: 'Services', href: '#services' },
  { name: 'Pricing', href: '#pricing' },
  { name: 'About', href: '#about' },
  { name: 'Contact', href: '#footer' },
];

export default function Navbar() {
  const { session } = useSupabaseSession();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed w-full top-0 z-[100] p-4 md:p-6">
      <nav 
        className={`max-w-7xl mx-auto transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          scrolled 
            ? 'bg-brand-carbon/90 backdrop-blur-xl py-3 px-6 rounded-full border border-white/10 shadow-2xl' 
            : 'bg-brand-primary py-5 px-10 rounded-[2.5rem] border border-white/5'
        }`}
      >
        <div className="flex justify-between items-center">
          
          {/* Logo Section */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-brand-mint p-1.5 rounded-lg rotate-[-6deg] group-hover:rotate-0 transition-transform duration-300">
               <div className="bg-brand-carbon text-brand-mint font-black px-2 py-0.5 rounded-sm text-lg">DS</div>
            </div>
            <span className="text-2xl font-black text-white tracking-tighter">
              DASH<span className="text-brand-mint">SUB</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link 
                key={link.name} 
                href={link.href} 
                className="px-5 py-2 text-sm font-bold text-brand-gray/80 hover:text-brand-mint transition-all relative group"
              >
                {link.name}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 bg-brand-mint rounded-full transition-all group-hover:w-4" />
              </Link>
            ))}
          </div>

          {/* Desktop CTAs (Visible on md and up) */}
          <div className="hidden md:flex items-center gap-6">
            {!session ? (
              <>
                <Link href="/auth" className="text-sm font-bold text-white/80 hover:text-white transition-colors">
                  Login
                </Link>
                <Link 
                  href="/auth" 
                  className="bg-brand-mint text-brand-carbon px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest hover:bg-white hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
                >
                  Join Now
                  <ArrowUpRight size={14} />
                </Link>
              </>
            ) : (
              <Link 
                href="/dashboard" 
                className="bg-white/10 border border-white/10 text-white px-7 py-3 rounded-full font-bold text-sm hover:bg-brand-mint hover:text-brand-carbon transition-all"
              >
                Dashboard
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="lg:hidden text-white p-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            {isOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        <div className={`lg:hidden absolute top-[115%] left-0 right-0 transition-all duration-500 origin-top ${
          isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-5 pointer-events-none'
        }`}>
          <div className="bg-brand-carbon border border-white/10 p-8 rounded-[3rem] shadow-3xl mx-4">
            <div className="flex flex-col gap-5">
              {NAV_LINKS.map((link) => (
                <Link 
                  key={link.name} 
                  href={link.href} 
                  onClick={() => setIsOpen(false)}
                  className="text-2xl font-bold text-brand-gray flex justify-between items-center group"
                >
                  {link.name}
                  <ArrowUpRight size={20} className="text-brand-mint opacity-50 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
              
              <div className="h-px bg-white/5 my-2" />
              
              {/* Mobile CTA Logic */}
              {!session ? (
                <div className="flex flex-col gap-4">
                  <Link 
                    href="/auth" 
                    onClick={() => setIsOpen(false)}
                    className="text-center text-white/70 py-2 font-bold hover:text-white"
                  >
                    Login
                  </Link>
                  <Link 
                    href="/auth" 
                    onClick={() => setIsOpen(false)}
                    className="w-full bg-brand-mint text-brand-carbon py-5 rounded-2xl font-black text-center text-lg shadow-lg hover:bg-white transition-colors"
                  >
                    Join Us Now
                  </Link>
                </div>
              ) : (
                <Link 
                  href="/auth" 
                  onClick={() => setIsOpen(false)}
                  className="w-full bg-brand-mint text-brand-carbon py-5 rounded-2xl font-black text-center text-lg"
                >
                  Go to Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}