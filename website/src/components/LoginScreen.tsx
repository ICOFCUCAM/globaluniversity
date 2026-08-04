import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UNIVERSITY, IMAGES } from '@/lib/constants';
import type { UserRole } from '@/lib/types';
import {
  Shield, Users, GraduationCap, BookOpen, Award,
  Monitor, BarChart3, FileText, Lock, Mail, User,
  Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, ArrowRight
} from 'lucide-react';

export default function LoginScreen() {
  const { login, signup, demoLogin, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await signup(email, password, fullName, selectedRole);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Account created successfully! You are now signed in.');
    }
  }

  function handleDemoLogin(role: UserRole) {
    setError('');
    demoLogin(role);
  }

  const features = [
    { icon: <Users size={20} />, title: 'Student Management', desc: 'Complete lifecycle from admission to graduation' },
    { icon: <GraduationCap size={20} />, title: 'Lecturer Portal', desc: 'Course management and result processing' },
    { icon: <BookOpen size={20} />, title: 'Course Catalog', desc: '340+ courses across 6 departments' },
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={IMAGES.hero} alt="Campus" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f1a3c]/95 via-[#422e59]/90 to-[#422e59]/80" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
          {/* Nav */}
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <img src={IMAGES.logo} alt="Logo" className="w-12 h-12 rounded-full object-cover border-2 border-amber-400" />
              <div>
                <h1 className="text-white font-bold text-lg">{UNIVERSITY.shortName}</h1>
                <p className="text-blue-200 text-[10px]">University Management System</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm text-blue-200">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#about" className="hover:text-white transition-colors">About</a>
              <a href="#contact" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>

          {/* Hero Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pb-16">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 rounded-full text-amber-300 text-xs font-medium mb-4">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                Next-Generation Academic Platform
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
                Transforming <span className="text-amber-400">University</span> Administration
              </h2>
              <p className="text-blue-200 mt-4 text-lg leading-relaxed">
                A comprehensive digital ecosystem managing the entire academic lifecycle — from student admission to graduation, with automated GPA calculations, professional transcript generation, and integrated online learning.
              </p>
              <div className="flex flex-wrap gap-4 mt-8">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">2,847</p>
                  <p className="text-xs text-blue-300">Active Students</p>
                </div>
                <div className="w-px bg-blue-400/30" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">186</p>
                  <p className="text-xs text-blue-300">Lecturers</p>
                </div>
                <div className="w-px bg-blue-400/30" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">342</p>
                  <p className="text-xs text-blue-300">Courses</p>
                </div>
                <div className="w-px bg-blue-400/30" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">4,521</p>
                  <p className="text-xs text-blue-300">Graduated</p>
                </div>
              </div>
            </div>

            {/* Auth Card */}
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-auto w-full">
              {/* Tab Toggle */}
              <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    mode === 'login' ? 'bg-[#422e59] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    mode === 'signup' ? 'bg-[#422e59] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Sign Up
                </button>
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
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30 focus:border-blue-400 transition-all"
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
                        className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30 focus:border-blue-400 transition-all"
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
              {mode === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30 focus:border-blue-400 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@uni.edu"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30 focus:border-blue-400 transition-all"
                      />
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Account Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {roleOptions.map((opt) => (
                        <button
                          key={opt.role}
                          type="button"
                          onClick={() => setSelectedRole(opt.role)}
                          className={`p-2.5 rounded-xl text-center transition-all duration-200 border-2 ${
                            selectedRole === opt.role
                              ? `bg-gradient-to-br ${opt.color} text-white border-transparent shadow-lg`
                              : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex justify-center mb-1">{opt.icon}</div>
                          <p className="text-xs font-semibold">{opt.label}</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      {roleOptions.find(r => r.role === selectedRole)?.desc}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30 focus:border-blue-400 transition-all"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                            password.length >= i * 3
                              ? password.length >= 12 ? 'bg-emerald-500' : password.length >= 8 ? 'bg-blue-500' : 'bg-amber-500'
                              : 'bg-gray-200'
                          }`} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className={`w-full pl-10 pr-10 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30 transition-all ${
                          confirmPassword && confirmPassword !== password ? 'border-red-300 bg-red-50/50' : 'border-gray-200'
                        }`}
                      />
                      {confirmPassword && confirmPassword === password && (
                        <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || isLoading}
                    className="w-full py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-semibold hover:bg-[#322244] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <><Loader2 size={16} className="animate-spin" /> Creating account...</> : <>Create Account <ArrowRight size={14} /></>}
                  </button>
                </form>
              )}

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">or try demo access</span></div>
              </div>

              {/* Demo Quick Login */}
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
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h3 className="text-2xl font-bold text-gray-800">Enterprise-Grade Features</h3>
          <p className="text-gray-500 mt-2">Everything you need to manage a modern university</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#422e59] to-[#3949ab] text-white flex items-center justify-center">
                {feature.icon}
              </div>
              <h4 className="text-sm font-bold text-gray-800 mt-3">{feature.title}</h4>
              <p className="text-xs text-gray-500 mt-1">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#0f1a3c] text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src={IMAGES.logo} alt="" className="w-8 h-8 rounded-full object-cover" />
                <span className="font-bold">{UNIVERSITY.shortName}</span>
              </div>
              <p className="text-sm text-blue-200">{UNIVERSITY.motto}</p>
              <p className="text-xs text-blue-300 mt-2">{UNIVERSITY.address}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Quick Links</h4>
              <div className="space-y-2 text-sm text-blue-200">
                <p className="hover:text-white cursor-pointer transition-colors">Student Portal</p>
                <p className="hover:text-white cursor-pointer transition-colors">Lecturer Portal</p>
                <p className="hover:text-white cursor-pointer transition-colors">Course Catalog</p>
                <p className="hover:text-white cursor-pointer transition-colors">Library</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Resources</h4>
              <div className="space-y-2 text-sm text-blue-200">
                <p className="hover:text-white cursor-pointer transition-colors">Academic Calendar</p>
                <p className="hover:text-white cursor-pointer transition-colors">Exam Timetable</p>
                <p className="hover:text-white cursor-pointer transition-colors">Transcripts</p>
                <p className="hover:text-white cursor-pointer transition-colors">Help Center</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Contact</h4>
              <div className="space-y-2 text-sm text-blue-200">
                <p>{UNIVERSITY.email}</p>
                <p>{UNIVERSITY.phone}</p>
                <p>{UNIVERSITY.website}</p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-blue-300">
            <p>&copy; {new Date().getFullYear()} {UNIVERSITY.name}. All rights reserved. Powered by UMS v2.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
