export type PaymentMethod = 'cash_envelope' | 'paypal' | 'cash_app' | 'venmo';

export type PaymentMethodDefinition = {
  id: PaymentMethod;
  label: string;
  helper: string;
  urlEnv?: string;
};

export const PAYMENT_METHODS: PaymentMethodDefinition[] = [
  {
    id: 'cash_envelope',
    label: 'Cash envelope',
    helper: 'Cash in the venue envelope',
  },
  {
    id: 'paypal',
    label: 'PayPal',
    helper: 'Pay through the league PayPal link',
    urlEnv: 'VITE_PAYPAL_URL',
  },
  {
    id: 'cash_app',
    label: 'Cash App',
    helper: 'Pay through the league Cash App link',
    urlEnv: 'VITE_CASH_APP_URL',
  },
  {
    id: 'venmo',
    label: 'Venmo',
    helper: 'Pay through the league Venmo link',
    urlEnv: 'VITE_VENMO_URL',
  },
];

const PAYMENT_METHOD_BY_ID = new Map(PAYMENT_METHODS.map((m) => [m.id, m]));

export function getPaymentMethod(id: PaymentMethod): PaymentMethodDefinition {
  const method = PAYMENT_METHOD_BY_ID.get(id);
  if (!method) throw new Error(`Unknown payment method: ${id}`);
  return method;
}

export function paymentMethodLabel(id: PaymentMethod | null | undefined): string {
  if (!id) return '—';
  return PAYMENT_METHOD_BY_ID.get(id)?.label ?? id;
}

export function paymentMethodUrl(id: PaymentMethod): string | undefined {
  const envKey = getPaymentMethod(id).urlEnv;
  if (!envKey) return undefined;
  const value = import.meta.env[envKey];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function isDigitalPaymentMethod(id: PaymentMethod): boolean {
  return id !== 'cash_envelope';
}
