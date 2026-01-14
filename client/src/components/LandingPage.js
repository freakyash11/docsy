import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DocsyLanding = () => {
  const navigate = useNavigate();
  const logoSrc = '/logo.png'; 

  useEffect(() => {
    const handleScroll = (e) => {
      const href = e.currentTarget.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const element = document.querySelector(href);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => link.addEventListener('click', handleScroll));
    return () => links.forEach(link => link.removeEventListener('click', handleScroll));
  }, []);

  const handleTryDemo = () => navigate('/demo');

  return (
    <div className="font-sans bg-white text-[#2D2D2D] selection:bg-[#3A86FF]/20">
      
      {/* 1. Hero Section */}
      <section className="pt-32 pb-20 px-6 bg-[#f8f9fa]">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#3A86FF]/10 rounded-full text-sm font-semibold text-[#3A86FF]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3A86FF] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3A86FF]"></span>
                </span>
                ✨ Simple. Fast. Collaborative.
              </div>
              <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
                Create.<br />
                Collaborate.<br />
                <span className="text-[#3A86FF]">Share.</span>
              </h1>
              <p className="text-xl text-[#6C757D] max-w-lg leading-relaxed">
                Docsy is a lightweight, real-time collaborative word processor designed for seamless teamwork. **Docs without the bulk.**
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <a href="/auth" className="px-10 py-4 bg-[#3A86FF] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20 active:scale-95">
                  Start Writing
                </a>
                <button 
                  onClick={handleTryDemo}
                  className="px-10 py-4 bg-white border-2 border-[#D6D6D6] text-[#2D2D2D] rounded-xl font-bold hover:border-[#2D2D2D] transition-all active:scale-95"
                >
                  Try Demo
                </button>
              </div>
            </div>

            {/* Hero UI Mockup */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#3A86FF] to-[#6EEB83] rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative bg-white rounded-2xl shadow-2xl p-2 border border-[#D6D6D6]">
                <div className="bg-[#f8f9fa] rounded-t-xl px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#FF595E]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#FFBE0B]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#6EEB83]"></div>
                  </div>
                  <div className="flex -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-[#3A86FF] border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">JD</div>
                    <div className="w-7 h-7 rounded-full bg-[#6EEB83] border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">AS</div>
                  </div>
                </div>
                <div className="p-8 space-y-4">
                  <div className="h-8 w-48 bg-gray-100 rounded-md mb-8 flex items-center px-2">
                    <img src={logoSrc} className="h-5 mix-blend-multiply opacity-50" alt="logo" />
                  </div>
                  <div className="h-4 bg-gray-900 rounded-full w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded-full w-full"></div>
                  <div className="h-3 bg-gray-200 rounded-full w-5/6"></div>
                  <div className="py-4">
                    <div className="h-24 bg-[#3A86FF]/5 border-l-4 border-[#3A86FF] rounded-r-md p-4">
                      <div className="h-2 w-20 bg-[#3A86FF]/40 rounded mb-2"></div>
                      <div className="h-2 w-full bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full w-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Features Section */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-4xl md:text-5xl font-black">Everything you need.<br /><span className="text-gray-400">Nothing you don't.</span></h2>
            <p className="text-lg text-[#6C757D]">Built for productivity. Designed for speed.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<CollaborationIcon />} 
              title="Real-time Collaboration" 
              desc="See changes as they happen. Edit together with your team in perfect sync."
              color="blue"
            />
            <FeatureCard 
              icon={<FastIcon />} 
              title="Lightning Fast" 
              desc="Open documents in milliseconds. Optimized for instant load times and zero lag."
              color="green"
            />
            <FeatureCard 
              icon={<CloudIcon />} 
              title="Autosave & Cloud Sync" 
              desc="Never lose your work. Everything saves automatically and syncs across all devices."
              color="yellow"
            />
          </div>
        </div>
      </section>

      {/* 3. Collaboration Showcase */}
      <section className="py-24 bg-[#2D2D2D] text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Built for teamwork</h2>
            <p className="text-[#ADB5BD] text-lg mb-8">
              Watch your ideas come to life together. User cursors, smart comments, and live status bubbles keep everyone aligned without the friction.
            </p>
            <ul className="space-y-4">
              {['Live Cursors', 'Threaded Comments', 'Version History'].map(item => (
                <li key={item} className="flex items-center gap-3">
                  <div className="bg-[#6EEB83] rounded-full p-1"><svg className="w-3 h-3 text-[#2D2D2D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"/></svg></div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="bg-white rounded-xl shadow-2xl p-6 text-[#2D2D2D]">
               <div className="flex items-center gap-2 mb-4 border-b pb-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">EDITING</span>
                  <span className="text-sm font-medium">Q1 Strategy.docx</span>
               </div>
               <p className="text-sm leading-relaxed mb-4">The new roadmap focuses on <span className="bg-[#3A86FF] text-white px-1">scalability</span> and user experience...</p>
               <div className="flex items-center gap-2">
                 <div className="w-8 h-8 rounded-full bg-[#6EEB83] flex items-center justify-center text-xs font-bold">AK</div>
                 <div className="px-3 py-2 bg-gray-100 rounded-lg text-[10px]">Adding the metrics now!</div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Pricing Section */}
      <section id="pricing" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">Simple Pricing</h2>
            <p className="text-gray-500">Pick a plan that fits your workflow.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <PriceCard plan="Free" price="0" features={['Unlimited Docs', 'Basic Sharing', 'Cloud Sync']} />
            <PriceCard plan="Pro" price="12" features={['Advanced Collab', 'Version History', 'Custom Branding']} highlight />
            <PriceCard plan="Team" price="30" features={['Shared Workspaces', 'Admin Analytics', 'Priority Support']} />
          </div>
        </div>
      </section>

      {/* 5. CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#3A86FF] to-[#6EEB83] text-white text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-4xl md:text-5xl font-black">Ready to write better together?</h2>
          <p className="text-xl opacity-90">Join thousands of students and teams using Docsy to simplify their workflow.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/auth" className="px-12 py-5 bg-white text-[#3A86FF] rounded-xl font-black shadow-2xl hover:bg-gray-50 transition active:scale-95 no-underline">
              Get Started Free
            </a>
          </div>
          <p className="text-sm opacity-70">No credit card required • Cancel anytime</p>
        </div>
      </section>
    </div>
  );
};

// Sub-components
const FeatureCard = ({ icon, title, desc, color }) => {
  const colors = {
    blue: "bg-[#3A86FF]/10 text-[#3A86FF]",
    green: "bg-[#6EEB83]/10 text-[#6EEB83]",
    yellow: "bg-[#FFBE0B]/10 text-[#FFBE0B]"
  };
  return (
    <div className="p-8 rounded-2xl border border-gray-100 bg-white hover:border-[#3A86FF] hover:shadow-xl transition-all duration-300 group">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${colors[color]}`}>{icon}</div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-[#6C757D] leading-relaxed">{desc}</p>
    </div>
  );
};

const PriceCard = ({ plan, price, features, highlight }) => (
  <div className={`p-10 rounded-3xl border ${highlight ? 'border-[#3A86FF] shadow-2xl scale-105 relative bg-white' : 'border-gray-100 bg-white'}`}>
    {highlight && <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#3A86FF] text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">Most Popular</span>}
    <h3 className="text-xl font-bold mb-2">{plan}</h3>
    <div className="flex items-baseline gap-1 mb-8">
      <span className="text-5xl font-black">${price}</span>
      <span className="text-gray-400">/mo</span>
    </div>
    <ul className="space-y-4 mb-10">
      {features.map(f => (
        <li key={f} className="flex items-center gap-3 text-sm font-medium">
          <svg className="w-5 h-5 text-[#6EEB83]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
          {f}
        </li>
      ))}
    </ul>
    <button className={`w-full py-4 rounded-xl font-bold transition-all ${highlight ? 'bg-[#3A86FF] text-white hover:bg-blue-600' : 'bg-gray-100 text-[#2D2D2D] hover:bg-gray-200'}`}>
      Choose {plan}
    </button>
  </div>
);

// Icons
const CollaborationIcon = () => <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const FastIcon = () => <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const CloudIcon = () => <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>;

export default DocsyLanding;