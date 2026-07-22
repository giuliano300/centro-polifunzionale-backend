export enum PaymentMethod {
  Cash = 'cash',
  Stripe = 'stripe',
  Paypal = 'paypal',
  Nexi = 'nexi',
}

export const PAYMENT_METHOD_VALUES = Object.values(PaymentMethod);
export const DEFAULT_PAYMENT_METHODS = [
  PaymentMethod.Cash,
  PaymentMethod.Stripe,
  PaymentMethod.Paypal,
  PaymentMethod.Nexi,
];
