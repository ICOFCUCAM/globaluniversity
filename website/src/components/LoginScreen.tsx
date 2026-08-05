import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UNIVERSITY, IMAGES } from '@/lib/constants';
import { Aurora, Grain, LightShaft, Seam } from './Atmosphere';
import type { UserRole } from '@/lib/types';
import {
  Shield, Users, GraduationCap, BookOpen, Award,
  Monitor, BarChart3, FileText, Lock, Mail, User,
  Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, ArrowRight
} from 'lucide-react';

// Demo quick-login is a development affordance, not a feature of the live portal.
const DEMO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true';

export default function LoginScreen() {
  const { login, demoLogin, isLoading } = useAuth();
  // Sign-up is not reachable from the portal — see the note by the auth card.
  // `mode` is retained as a constant so the existing conditional blocks below
  // continue to read naturally, and so that reinstating a sign-up route later
  // is a deliberate change rather than a one-character edit.
  const mode: 'login' | 'signup' = 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    }
  }

  // handleSignup removed. The portal has no sign-up route: a student account is
  // created by the Office of the Registrar on approving an application, and the
  // credentials are emailed from the server. See src/lib/admissions.ts.

  function handleDemoLogin(role: UserRole) {
    setError('');
    demoLogin(role);
  }

  const features = [
    { icon: <Users size={20} />, title: 'Student Management', desc: 'Complete lifecycle from admission to graduation' },
    { icon: <GraduationCap size={20} />, title: 'Lecturer Portal', desc: 'Course management and result processing' },
    { icon: <BookOpen size={20} />, title: 'Course Catalog', desc: 'Courses across four faculties, on campus and online' },
    { icon: <FileText size={20} />, title: 'Transcript Generation', desc: 'Pixel-perfect official transcripts with QR codes' },
    { icon: <Award size={20} />, title: 'Certificate Issuance', desc: 'Automated degree certificate generation' },
    { icon: <Monitor size={20} />, title: 'Online Learning', desc: 'LMS with materials, live classes, and CBT exams' },
    { icon: <BarChart3 size={20} />, title: 'Analytics', desc: 'Comprehensive academic performance insights' },
    { icon: <Shield size={20} />, title: 'Security', desc: 'Role-based access with audit logging' },
  ];

  const roleOptions: { role: UserRole; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
    { role: 'student', label: 'Student', icon: <Users size={18} />, color: 'from-purple-500 to-purple-600', desc: 'Access courses, results & transcripts' },
    { role: 'lecturer', label: 'Lecturer', icon: <GraduationCap size={18} />, color: 'from-emerald-500 to-emerald-600', desc: 'Manage courses & enter grades' },
    { role: 'admin', label: 'Admin', icon: <Shield size={18} />, color: 'from-blue-500 to-blue-600', desc: 'Full system administration' },
  ];

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={IMAGES.hero} alt="" className="h-full w-full object-cover" />
          <Aurora tone="dual" intensity={0.5} fields={2} />
          <LightShaft />
          <div className="absolute inset-0 bg-gradient-to-br from-[#241a30]/95 via-[#422e59]/88 to-[#57549a]/70" />
          <Grain />
          <Seam flip />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          {/* Nav */}
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <img src={IMAGES.logo} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-brand-gold" />
              <div>
                <h1 className="text-white font-bold text-lg">{UNIVERSITY.shortName}</h1>
                <p className="text-[10px] tracking-wide text-brand-gold/80">University Management System</p>
              </div>
            </div>
            <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="/about" className="hover:text-white transition-colors">About</a>
              <a href="/contact" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>

          {/* Hero Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pb-16">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
                The ICOF Global University portal
              </div>
              <h2 className="font-heading text-4xl font-bold leading-tight text-transparent lg:text-5xl [background-image:linear-gradient(175deg,#ffffff_38%,#f7e6b4_80%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text]">
                ICOF Global <span className="text-brand-gold">University</span> Portal
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-white/85">
                One portal for the whole academic journey — admission to graduation — with automated GPA calculation, verified transcript generation and integrated online learning, serving students on campus in Cameroon and online worldwide.
              </p>
              <div className="flex flex-wrap gap-4 mt-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">7,228</p>
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Success Stories</p>
                </div>
                <div className="w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">213</p>
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Courses</p>
                </div>
                <div className="w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">1,742</p>
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Happy Students</p>
                </div>
                <div className="w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">15+</p>
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Years of Excellence</p>
                </div>
              </div>
            </div>

            {/* Auth Card */}
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-auto w-full">
              {/* No sign-up tab. A student account exists only because the
                  Office of the Registrar approved an application, and an
                  account created here would bypass both the application fee
                  and the Registrar's examination — the two controls the
                  admissions process exists to apply.

                  The panel that used to explain all of that has gone. A sign-in
                  screen that opens by explaining what it is not reads as an
                  apology; the university's own systems do not need to justify
                  themselves to the person signing in. The route for applicants
                  is a single line beneath the form, where a misdirected visitor
                  will look for it and nobody else has to read it. */}

              <div className="mb-6">
                <h3 className="font-heading text-lg font-bold text-[#422e59]">Sign in</h3>
                <p className="mt-0.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">Students, faculty and staff</p>
              </div>

              {/* Error / Success Messages */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-emerald-700">{success}</p>
                </div>
              )}

              {/* LOGIN FORM */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@uni.edu"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35 focus:border-blue-400 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35 focus:border-blue-400 transition-all"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-gray-500 cursor-pointer">
                      <input type="checkbox" className="rounded border-gray-300 text-[#422e59] focus:ring-blue-500" />
                      Remember me
                    </label>
                    <a href="#" className="text-blue-600 hover:underline">Forgot password?</a>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || isLoading}
                    className="w-full py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-semibold hover:bg-[#322244] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : <>Sign In <ArrowRight size={14} /></>}
                  </button>
                </form>
              )}

              {/* SIGNUP FORM */}
              {/* The sign-up form is gone, not hidden. It is reinstated only by
                  deciding that applicants may create their own accounts, which
                  would bypass the fee gate and the Registrar's examination. */}

              {/* Demo quick-login — one click into an administrator console, so it is
                  compiled out unless NEXT_PUBLIC_ENABLE_DEMO is explicitly set. Never
                  enable it on the production deployment. */}
              {DEMO_ENABLED && (
                <>
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                    <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-[#a49bb0] dark:text-[#7b7289]">or try demo access</span></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {roleOptions.map((opt) => (
                      <button
                        key={opt.role}
                        onClick={() => handleDemoLogin(opt.role)}
                        disabled={isLoading}
                        className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-center transition-all duration-200 border border-gray-100 hover:border-gray-200 group"
                      >
                        <div className="flex justify-center mb-0.5 text-gray-400 group-hover:text-gray-600">{opt.icon}</div>
                        <p className="text-[10px] font-semibold text-gray-500 group-hover:text-gray-700">Demo {opt.label}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-gray-400 text-center mt-2">
                    Demo mode uses sample data — no account required
                  </p>
                </>
              )}

              <div className="mt-5 space-y-1.5 border-t border-gray-100 pt-4 text-center text-[11px] text-gray-400">
                <p>
                  Applying to study?{' '}
                  <a href="/admissions-portal" className="font-medium text-[#422e59] hover:underline">
                    Admissions Portal <ArrowRight size={11} className="inline" />
                  </a>
                </p>
                <p>
                  Trouble signing in? Contact the Registrar&apos;s office at{' '}
                  <a href="mailto:registrar@iguc.net" className="underline hover:text-gray-600">registrar@iguc.net</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h3 className="text-2xl font-bold text-[#33234a] dark:text-[#e4dcf0]">What the portal does</h3>
          <p className="text-gray-500 mt-2">One system, from application through to graduation and credential verification</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#422e59] to-[#3949ab] text-white flex items-center justify-center">
                {feature.icon}
              </div>
              <h4 className="text-sm font-bold text-[#33234a] dark:text-[#e4dcf0] mt-3">{feature.title}</h4>
              <p className="text-xs text-[#6b6076] dark:text-[#9c93ad] mt-1">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
