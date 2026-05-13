import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { LogOut, User, Volume2, VolumeX, Shield, Bell, BellOff, FileText, Camera, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useRankings } from '../hooks/useRankings';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Avatar } from '../components/Avatar';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';

const DISCIPLINES = ['8 Ball', '9 Ball', '10 Ball'] as const;

const PRESET_ICONS = ['🎱','🔵','🟡','🦁','🐺','🦅','🐉','⚡','🔥','🎯','💀','🌙'];

export default function SettingsPage() {
  const navigate  = useNavigate();
  const { profile, player, setPlayer, reset } = useAuthStore();
  const { soundEnabled, setSoundEnabled } = useUIStore();
  const { supported: pushSupported, subscribed: pushSubscribed, permission: pushPermission, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications();
  const { data: rankings = [] } = useRankings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName,   setDisplayName]   = useState(profile?.display_name ?? '');
  const [bio,           setBio]           = useState('');
  const [preferredDisc, setPreferredDisc] = useState<typeof DISCIPLINES[number] | ''>('');
  const [saving,        setSaving]        = useState(false);
  const [signingOut,    setSigningOut]    = useState(false);
  const [avatarSaving,  setAvatarSaving]  = useState(false);
  const [avatarError,   setAvatarError]   = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const myRanking = rankings.find((r) => r.player.id === player?.id);
  const playerId = player?.id;

  useEffect(() => {
    if (!playerId) return;
    supabase.from('players').select('bio, preferred_discipline').eq('id', playerId).single()
      .then(({ data }) => {
        if (data) {
          setBio(data.bio ?? '');
          setPreferredDisc((data.preferred_discipline as typeof DISCIPLINES[number] | null) ?? '');
        }
      });
  }, [playerId]);

  const handleSaveName = async () => {
    if (!profile || !displayName.trim()) return;
    setSaving(true);
    await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', profile.id);
    setSaving(false);
  };

  const handleSaveProfile = async () => {
    if (!player) return;
    setSaving(true);
    await supabase.from('players').update({
      bio: bio.trim() || null,
      preferred_discipline: preferredDisc || null,
    }).eq('id', player.id);
    setSaving(false);
  };

  const handleSelectIcon = async (icon: string) => {
    if (!player) return;
    setAvatarSaving(true);
    setAvatarError('');
    await supabase.from('players').update({ avatar_url: icon }).eq('id', player.id);
    // Refresh player in store
    const { data } = await supabase.from('players').select('*').eq('id', player.id).single();
    if (data) setPlayer(data);
    setAvatarSaving(false);
    setShowIconPicker(false);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!player || !profile) return;
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Photo must be under 5 MB.'); return; }
    setAvatarSaving(true);
    setAvatarError('');
    const ext  = file.name.split('.').pop() ?? 'jpg';
    const path = `${profile.id}/avatar.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadErr) { setAvatarError(uploadErr.message); setAvatarSaving(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('players').update({ avatar_url: publicUrl }).eq('id', player.id);
    const { data } = await supabase.from('players').select('*').eq('id', player.id).single();
    if (data) setPlayer(data);
    setAvatarSaving(false);
    setShowIconPicker(false);
  };

  const handleRemoveAvatar = async () => {
    if (!player) return;
    setAvatarSaving(true);
    await supabase.from('players').update({ avatar_url: null }).eq('id', player.id);
    const { data } = await supabase.from('players').select('*').eq('id', player.id).single();
    if (data) setPlayer(data);
    setAvatarSaving(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    reset();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen px-4 pt-8 pb-4 space-y-4">
      <h1 className="font-[Bebas_Neue] text-5xl tracking-wide text-[#E8E2D6] mb-2">Settings</h1>

      {/* Profile card */}
      {player && myRanking && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-5">

            {/* Avatar section */}
            <div className="flex items-center gap-4 mb-5">
              <div className="relative">
                <Avatar player={player} size={64} />
                <button
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#C62828] flex items-center justify-center border-2 border-[#0D0D0D]"
                >
                  <Camera size={11} className="text-white" />
                </button>
              </div>
              <div>
                <div className="font-[Bebas_Neue] text-2xl text-[#E8E2D6]">{player.full_name}</div>
                <div className="text-[#9CA3AF] text-sm font-[Barlow]">{profile?.email}</div>
                <div className="text-[#C62828] font-[Azeret_Mono] text-sm">
                  Rank #{myRanking.ranking.position}
                </div>
              </div>
            </div>

            {/* Avatar picker */}
            {showIconPicker && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 bg-[#1A1A1A] rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[#9CA3AF] text-sm font-[Barlow]">Choose an icon or upload a photo</span>
                  <button onClick={() => setShowIconPicker(false)} className="text-[#6B7280]"><X size={16} /></button>
                </div>

                {/* Preset icons */}
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {PRESET_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => handleSelectIcon(icon)}
                      disabled={avatarSaving}
                      className={`aspect-square rounded-xl flex items-center justify-center text-2xl transition-all active:scale-95 ${
                        player.avatar_url === icon
                          ? 'bg-[#C62828]/30 border border-[#C62828]/60'
                          : 'bg-[#252525] border border-[#333] hover:border-[#555]'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>

                {/* Upload button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    loading={avatarSaving}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={14} /> Upload Photo
                  </Button>
                  {player.avatar_url && (
                    <Button variant="ghost" size="sm" loading={avatarSaving} onClick={handleRemoveAvatar}>
                      Remove
                    </Button>
                  )}
                </div>
                {avatarError && <p className="text-[#EF4444] text-xs font-[Barlow] mt-2">{avatarError}</p>}
              </motion.div>
            )}

            {/* Display name */}
            <div className="mb-4">
              <label className="block text-[#9CA3AF] text-sm font-[Barlow] mb-2 flex items-center gap-1">
                <User size={14} /> Display Name
              </label>
              <div className="flex gap-2">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={player.full_name}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[#C62828] transition-colors"
                />
                <Button variant="secondary" size="sm" loading={saving} onClick={handleSaveName}>
                  Save
                </Button>
              </div>
            </div>

            {/* Bio */}
            <div className="mb-4">
              <label className="block text-[#9CA3AF] text-sm font-[Barlow] mb-2 flex items-center gap-1">
                <FileText size={14} /> Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder="A few words about your game…"
                className="w-full px-3 py-2.5 rounded-lg bg-[#252525] border border-[#333] text-[#E8E2D6] font-[Barlow] text-sm focus:outline-none focus:border-[#C62828] transition-colors resize-none"
              />
              <div className="text-right text-xs text-[#6B7280] font-[Barlow] mt-1">
                {bio.length}/200
              </div>
            </div>

            {/* Preferred discipline */}
            <div className="mb-5">
              <label className="block text-[#9CA3AF] text-sm font-[Barlow] mb-2">
                Preferred Discipline
              </label>
              <div className="flex gap-2">
                {DISCIPLINES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setPreferredDisc(preferredDisc === d ? '' : d)}
                    className={[
                      'flex-1 py-2 rounded-lg text-xs font-[Barlow] font-medium border transition-all',
                      preferredDisc === d
                        ? 'bg-[#C62828] border-[#C62828] text-white'
                        : 'border-[#333] text-[#9CA3AF]',
                    ].join(' ')}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <Button variant="primary" fullWidth loading={saving} onClick={handleSaveProfile}>
              Save Profile
            </Button>

            <div className="text-xs text-[#6B7280] font-[Barlow] mt-3">
              Email (read-only): {profile?.email}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Preferences */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <GlassCard className="p-5">
          <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-4">Preferences</h2>

          <div className="flex items-center justify-between py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              {soundEnabled ? <Volume2 size={18} className="text-[#9CA3AF]" /> : <VolumeX size={18} className="text-[#9CA3AF]" />}
              <div>
                <div className="font-[Barlow] font-medium text-[#E8E2D6] text-sm">Sound Effects</div>
                <div className="text-[#6B7280] text-xs font-[Barlow]">UI sounds and celebrations</div>
              </div>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${soundEnabled ? 'bg-[#C62828]' : 'bg-[#333]'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {pushSupported && (
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {pushSubscribed ? <Bell size={18} className="text-[#9CA3AF]" /> : <BellOff size={18} className="text-[#9CA3AF]" />}
                <div>
                  <div className="font-[Barlow] font-medium text-[#E8E2D6] text-sm">Push Notifications</div>
                  <div className="text-[#6B7280] text-xs font-[Barlow]">
                    {pushPermission === 'denied'
                      ? 'Blocked in browser settings'
                      : pushSubscribed
                      ? 'Challenges, results & more'
                      : 'Get notified when action is needed'}
                  </div>
                </div>
              </div>
              <button
                onClick={pushSubscribed ? pushUnsubscribe : pushSubscribe}
                disabled={pushLoading || pushPermission === 'denied'}
                className={`w-12 h-6 rounded-full transition-colors relative disabled:opacity-40 ${pushSubscribed ? 'bg-[#C62828]' : 'bg-[#333]'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${pushSubscribed ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Admin link */}
      {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <GlassCard className="p-5" hover onClick={() => navigate('/admin')}>
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-[#C62828]" />
              <div>
                <div className="font-[Barlow] font-semibold text-[#E8E2D6]">Admin Dashboard</div>
                <div className="text-[#9CA3AF] text-xs font-[Barlow]">Disputes, treasury, player management</div>
              </div>
              <div className="ml-auto text-[#6B7280]">→</div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* App info */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <GlassCard className="p-5">
          <h2 className="font-[Bebas_Neue] text-xl text-[#E8E2D6] mb-3">About</h2>
          <div className="space-y-1 text-[#9CA3AF] text-sm font-[Barlow]">
            <div>Top of the Capital — Helena Pool League</div>
            <div className="text-[#6B7280] text-xs">Version 1.0.0 · Built with ❤️ in Helena, MT</div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Sign out */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Button
          variant="danger"
          fullWidth
          size="lg"
          loading={signingOut}
          onClick={handleSignOut}
        >
          <LogOut size={18} /> Sign Out
        </Button>
      </motion.div>
    </div>
  );
}
