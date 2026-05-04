import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const VAPID_PUBLIC_KEY: string | undefined = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0))).buffer;
}

export function usePushNotifications() {
  const { player } = useAuthStore();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported('serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY);
    if ('Notification' in window) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!supported || !player) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(!!existing);
    });
  }, [supported, player]);

  const subscribe = async () => {
    if (!player || !supported || !VAPID_PUBLIC_KEY) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await supabase.from('push_subscriptions').upsert(
        { player_id: player.id, subscription: sub.toJSON() },
        { onConflict: 'player_id' }
      );
      setSubscribed(true);
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!player) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('player_id', player.id);
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  };

  return { supported, subscribed, permission, loading, subscribe, unsubscribe };
}
