import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { roleLabels } from '@/lib/roles';
import { GRADING_SCALE } from '@/lib/grading';
import { UNIVERSITY } from '@/lib/constants';
import {
  User, Shield, Bell, Palette, Database, Save, CheckCircle2
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);

  // No invented defaults. The phone read "+234 801 234 5678" and the department
  // "Computer Science" — a Nigerian number and a subject this university does
  // not teach, both inherited from the template. A field pre-filled with
  // somebody else's data is worse than an empty one: it gets saved.
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [saving, setSaving] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);

  /**
   * Change the signed-in user's password.
   *
   * Supabase re-checks the session rather than the old password, so there is no
   * "current password" field: asking for one and not verifying it would be
   * theatre. The session itself is the proof of identity.
   */
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);
    if (pw1 !== pw2) {
      setPwMessage({ ok: false, text: 'The two passwords do not match.' });
      return;
    }
    if (pw1.length < 10) {
      setPwMessage({ ok: false, text: 'Use at least 10 characters.' });
      return;
    }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setPwBusy(false);
    if (error) {
      setPwMessage({ ok: false, text: error.message });
      return;
    }
    setPw1(''); setPw2('');
    setPwMessage({ ok: true, text: 'Password updated. Use it the next time you sign in.' });
  }
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setProfile({ name: user?.name || '', email: user?.email || '' });
  }, [user?.name, user?.email]);

  /**
   * Save, rather than say "Saved!".
   *
   * This function used to set a flag, show a tick for two seconds and write
   * nothing anywhere. The user then reloaded and found their change gone —
   * which is the worst version of this bug, because they had been told it
   * worked and had no reason to check.
   *
   * Only full_name is written. Email is the sign-in identifier and changing it
   * belongs to the Superadministrator, not to a profile form; column privileges
   * in migration 002 mean an attempt from here would be refused by the database
   * anyway, so the field is shown read-only rather than accepting an edit that
   * cannot land.
   */
  async function handleSave() {
    if (!user?.id) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: profile.name.trim() })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'grading', label: 'Grading Scale', icon: <Database size={16} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { id: 'security', label: 'Security', icon: <Shield size={16} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Settings</h2>
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Manage your account and system preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-3 h-fit">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeTab === tab.id ? 'bg-[#422e59] text-white font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3 rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-6">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">Profile Settings</h3>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <img src={user?.avatar} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-[#ece7f4]" />
                <div>
                  <p className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">{user?.name}</p>
                  <p className="text-sm text-[#6b6076] dark:text-[#9c93ad] capitalize">{user?.role}</p>

                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                  <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input value={profile.email} readOnly
                    className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm bg-gray-50 text-gray-500" />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Your sign-in address. Only the Superadministrator can change it.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                  <input value={roleLabels[user?.role ?? 'student'] ?? ''} readOnly
                    className="w-full px-3 py-2 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm bg-gray-50 text-gray-500" />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Assigned by the Superadministrator and recorded in the audit log.
                  </p>
                </div>
              </div>
              {saveError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Not saved: {saveError}
                </p>
              )}
              <button onClick={handleSave} disabled={saving || !profile.name.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors disabled:opacity-40">
                {saving ? <><Save size={14} className="animate-pulse" /> Saving…</>
                  : saved ? <><CheckCircle2 size={14} /> Saved</>
                  : <><Save size={14} /> Save changes</>}
              </button>
            </div>
          )}

          {activeTab === 'grading' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">Grading Scale Configuration</h3>
              <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Current grading scale used for all result processing</p>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#ece7de] bg-[#faf8f4] dark:border-[#2e2637] dark:bg-[#241f2c]">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Score Range</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500">Grade</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500">Grade Point</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
                  {GRADING_SCALE.map((g) => (
                    <tr key={g.grade} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{g.minScore} - {g.maxScore}</td>
                      <td className="px-4 py-2 text-sm text-center font-bold">{g.grade}</td>
                      <td className="px-4 py-2 text-sm text-center">{g.gradePoint}</td>
                      <td className="px-4 py-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">{g.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-sm text-blue-700 font-medium">GPA Formula</p>
                <p className="text-xs text-blue-600 mt-1 font-mono">GPA = Σ(Grade Point × Credit Unit) / Σ(Credit Units)</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl">
                <p className="text-sm text-amber-700 font-medium">Degree Classification</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-amber-600">
                  <p>4.50 - 5.00: First Class Honours</p>
                  <p>3.50 - 4.49: Second Class Upper</p>
                  <p>2.40 - 3.49: Second Class Lower</p>
                  <p>1.50 - 2.39: Third Class</p>
                  <p>1.00 - 1.49: Pass</p>
                  <p>Below 1.00: Fail</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">Notification Preferences</h3>
              {[
                { label: 'Result Notifications', desc: 'Get notified when results are submitted or approved' },
                { label: 'Exam Reminders', desc: 'Receive reminders before scheduled exams' },
                { label: 'Course Updates', desc: 'New materials and announcements' },
                { label: 'System Alerts', desc: 'Important system maintenance notices' },
                { label: 'Email Notifications', desc: 'Receive notifications via email' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{item.label}</p>
                    <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={i < 3} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#422e59]"></div>
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">Security</h3>

              {/* This form previously had three password fields and a button
                  with no handler. Somebody following the university's own
                  instruction to change their temporary password would have
                  typed a new one, pressed the button, seen nothing happen, and
                  carried on using the password that was emailed to them in
                  plain text. */}
              <form onSubmit={changePassword} className="space-y-3 rounded-xl bg-[#faf8f4] p-4 dark:bg-[#241f2c]">
                <div>
                  <label htmlFor="new-password" className="mb-1 block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">
                    New password
                  </label>
                  <input
                    id="new-password" type="password" autoComplete="new-password" required minLength={10}
                    value={pw1} onChange={(e) => setPw1(e.target.value)}
                    className="w-full max-w-md rounded-lg border border-[#ded6c8] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35 dark:border-[#3d3349] dark:bg-[#1f1a27]"
                  />
                  <p className="mt-1 text-[11px] text-[#a49bb0]">
                    At least 10 characters. Length is what makes a password hard to guess; a short
                    one with a symbol in it is not.
                  </p>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-1 block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">
                    Confirm new password
                  </label>
                  <input
                    id="confirm-password" type="password" autoComplete="new-password" required
                    value={pw2} onChange={(e) => setPw2(e.target.value)}
                    className="w-full max-w-md rounded-lg border border-[#ded6c8] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35 dark:border-[#3d3349] dark:bg-[#1f1a27]"
                  />
                </div>
                {pwMessage && (
                  <p className={`max-w-md rounded-lg px-3 py-2 text-sm ${
                    pwMessage.ok
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border border-red-200 bg-red-50 text-red-700'
                  }`}>
                    {pwMessage.text}
                  </p>
                )}
                <button
                  type="submit" disabled={pwBusy || !pw1 || !pw2}
                  className="rounded-lg bg-[#422e59] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#322244] disabled:opacity-40"
                >
                  {pwBusy ? 'Updating…' : 'Update password'}
                </button>
              </form>

              {/* Two-factor authentication is not implemented. The button that
                  offered it was styled in confident green and did nothing, so
                  anyone who pressed it had every reason to believe their
                  account was now protected by a second factor. Claiming a
                  security control you do not have is worse than not having it:
                  it changes how carefully people treat the first one. */}
              <div className="rounded-xl border border-[#ece7de] bg-[#faf8f4] p-4 dark:border-[#2e2637] dark:bg-[#241f2c]">
                <h4 className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">Two-factor authentication</h4>
                <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                  Not yet available on this portal. When it is, it will be required for the
                  Superadministrator and the two admissions desks before anyone else.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
