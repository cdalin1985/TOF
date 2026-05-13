import webpush from 'npm:web-push';

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => Promise<{ data: { subscription?: webpush.PushSubscription } | null }>;
      };
    };
  };
};

export async function sendPush(
  supabase: SupabaseLike,
  playerId: string,
  title: string,
  body: string,
  url: string,
): Promise<void> {
  try {
    const { data: row } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('player_id', playerId)
      .single();

    if (!row?.subscription) return;

    webpush.setVapidDetails(
      `mailto:${Deno.env.get('VAPID_SUBJECT')}`,
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    );

    await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url }));
  } catch {
    // Never let a push failure break the main operation
  }
}
