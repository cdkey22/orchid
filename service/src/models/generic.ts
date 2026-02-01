// Typage spécifique métier utiliser dans le concept du BDD
export type Brand<K, T> = K & { __brand: T };
