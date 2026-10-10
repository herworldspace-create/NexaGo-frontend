const DEFAULT_API_BASE_URL = "https://nexago-backend.onrender.com/api/v1";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

const TOKEN_KEY = "nexago_access_token";
const REFRESH_TOKEN_KEY = "nexago_refresh_token";
const SESSION_KEY = "nexago_session";

export const SESSION_EXPIRED_EVENT = "nexago:session-expired";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Keep the access token in browser storage so sessions persist across refreshes. */
export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

function persistSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  if (session.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ userId: session.userId, role: session.role }),
  );
}

/** Restore a previously signed-in session after a page reload. */
export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const accessToken = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(SESSION_KEY);
  if (!accessToken || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId?: string; role?: AuthSession["role"] };
    if (!parsed.userId) return null;
    return {
      accessToken,
      refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) ?? "",
      userId: parsed.userId,
      role: parsed.role ?? "PASSENGER",
      isNewAccount: false,
    };
  } catch {
    return null;
  }
}

export interface OtpRequestResponse {
  message?: string;
  expiresInSeconds?: number;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  role: "PASSENGER" | "DRIVER";
  isNewAccount: boolean;
}

export interface CurrentUser {
  id?: string;
  email?: string | null;
  phone?: string | null;
  role?: string;
  status?: string;
  createdAt?: string;
  passengerProfile?: {
    fullName?: string | null;
    verificationStatus?: string | null;
  } | null;
}

export interface RideLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface RideDetails {
  operatingAreaId: string;
  vehicleCategoryId: string;
  distanceKm: number;
  durationMinutes: number;
}

export interface FareEstimate {
  currency?: string;
  estimatedFare?: number;
  fare?: number;
  [key: string]: unknown;
}

export interface VehicleCategory {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type?: string;
  isActive?: boolean;
}

export interface OperatingArea {
  id: string;
  name: string;
  state?: string;
  isActive?: boolean;
}

export interface RoutePreview {
  distanceKm: number;
  durationMinutes: number;
  path?: RideLocation[];
  /** True when the server routing service was unavailable and a local estimate was used. */
  estimated?: boolean;
}

const ROAD_DISTANCE_FACTOR = 1.3;
const AVERAGE_CITY_SPEED_KMH = 24;

function estimateRouteLocally(origin: RideLocation, destination: RideLocation): RoutePreview {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(destination.latitude - origin.latitude);
  const dLng = toRadians(destination.longitude - origin.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(origin.latitude)) *
      Math.cos(toRadians(destination.latitude)) *
      Math.sin(dLng / 2) ** 2;
  const straightLineKm = 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
  const distanceKm = Math.max(0.5, Number((straightLineKm * ROAD_DISTANCE_FACTOR).toFixed(2)));
  const durationMinutes = Math.max(3, Math.round((distanceKm / AVERAGE_CITY_SPEED_KMH) * 60));
  return { distanceKm, durationMinutes, path: [origin, destination], estimated: true };
}

function collectionFrom<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    for (const key of ["items", "data", "results"]) {
      if (Array.isArray(record[key])) {
        return record[key] as T[];
      }
    }
  }

  return [];
}

/** Load passenger ride categories from the backend catalog. */
export async function getVehicleCategories(): Promise<VehicleCategory[]> {
  const payload = await request<unknown>("fares/categories");
  return collectionFrom<VehicleCategory>(payload);
}

/** Load operating areas from the backend catalog. */
export async function getOperatingAreas(): Promise<OperatingArea[]> {
  const payload = await request<unknown>("fares/areas");
  return collectionFrom<OperatingArea>(payload);
}

/**
 * Ask the backend routing provider for road distance and duration, falling back
 * to a conservative local estimate when the routing service is unavailable.
 */
export async function previewRoute(
  origin: RideLocation,
  destination: RideLocation,
): Promise<RoutePreview> {
  try {
    const result = await request<RoutePreview>("routes/preview", {
      method: "POST",
      body: {
        originLat: origin.latitude,
        originLng: origin.longitude,
        destinationLat: destination.latitude,
        destinationLng: destination.longitude,
      },
    });
    if (
      Number.isFinite(result?.distanceKm) &&
      Number.isFinite(result?.durationMinutes) &&
      result.distanceKm > 0 &&
      result.durationMinutes > 0
    ) {
      return result;
    }
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 400)) throw error;
  }
  return estimateRouteLocally(origin, destination);
}

/** Realtime gateway uses the API host without the REST /api/v1 prefix. */
export function getRealtimeUrl(): string {
  return new URL(API_BASE_URL).origin;
}

export interface Ride {
  id: string;
  status?: string;
  [key: string]: unknown;
}

export interface UserNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  data?: Record<string, string> | null;
}

export interface RideRating {
  id: string;
  score: number;
  comment?: string | null;
}

export interface WalletTransaction {
  id: string;
  type?: string;
  direction?: string;
  amountKobo: number;
  description?: string | null;
  createdAt: string;
  [key: string]: unknown;
}

export interface WalletBalance {
  balanceKobo: number;
  currency?: string;
  hasPinSet?: boolean;
  recentTransactions?: WalletTransaction[];
  [key: string]: unknown;
}

export interface WalletTransfer {
  id: string;
  status?: string;
  [key: string]: unknown;
}

export type VtuType = "AIRTIME" | "DATA";
export type VtuNetwork = "MTN" | "AIRTEL" | "GLO" | "NINE_MOBILE";

export interface VtuPurchase {
  id: string;
  status?: string;
  [key: string]: unknown;
}

export interface VtuDataBundle {
  code: string;
  name: string;
  priceKobo: number;
  [key: string]: unknown;
}

export interface BankOption {
  name: string;
  code: string;
}

export interface BankAccountResolution {
  accountName: string;
  accountLast4: string;
  bankCode: string;
  bankName: string;
}

export interface BankTransferQuote {
  amountKobo: number;
  feeKobo: number;
  totalKobo: number;
}

export interface BankTransferResult {
  id: string;
  amountKobo: number;
  feeKobo: number;
  totalKobo: number;
  bankName: string;
  accountName: string;
  accountLast4: string;
  reference: string;
  status:
    | "PENDING"
    | "OTP_REQUIRED"
    | "SUCCESSFUL"
    | "FAILED"
    | "REVERSED";
  failureReason?: string | null;
}

export interface RemitaBillService {
  id: string;
  name: string;
  category: string;
  customerReferenceLabel: string;
}

export interface BillCustomerValidation {
  verified: boolean;
  verificationMode: "provider" | "purchase";
  customerName?: string;
}

export interface BillPaymentResult {
  id: string;
  serviceId: string;
  serviceName: string;
  category: string;
  customerReferenceLast4: string;
  amountKobo: number;
  reference: string;
  providerReference?: string | null;
  token?: string | null;
  status: "PENDING" | "SUCCESSFUL" | "FAILED";
  failureReason?: string | null;
}

export async function getDataBundles(
  network: VtuNetwork,
): Promise<VtuDataBundle[]> {
  const payload = await request<unknown>(
    `vtu/data-bundles/${encodeURIComponent(network)}`,
  );

  return collectionFrom<VtuDataBundle>(payload);
}

let refreshInFlight: Promise<boolean> | null = null;

/** Exchange the stored refresh token for a new session. Concurrent callers share one request. */
function refreshSession(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return Promise.resolve(false);

  refreshInFlight ??= fetch(`${API_BASE_URL}/auth/token/refresh`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (response) => {
      if (!response.ok) return false;
      const data = (await response.json().catch(() => null)) as
        | { accessToken?: string; refreshToken?: string }
        | null;
      if (!data?.accessToken) return false;
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    skipRefresh?: boolean;
  } = {},
): Promise<T> {
  const token = getAccessToken();

  const headers = new Headers({
    Accept: "application/json",
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/${path.replace(/^\/+/, "")}`,
      {
        method: options.method ?? "GET",
        headers,
        body:
          options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
      },
    );
  } catch (error) {
    throw new ApiError(
      "Unable to reach NexaGo. Check your connection and try again.",
      0,
      error,
    );
  }

  if (response.status === 401 && token && !options.skipRefresh) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, { ...options, skipRefresh: true });
    clearAccessToken();
    if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  const text = response.status === 204 ? "" : await response.text().catch(() => "");
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const body = data as
      | {
          message?: string | string[];
          error?: string;
        }
      | null;

    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message ??
        body?.error ??
        `API request failed (${response.status}).`;

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

function toKobo(amountNaira: number): number {
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) {
    throw new TypeError(
      "Amount must be a positive number in naira.",
    );
  }

  return Math.round(amountNaira * 100);
}

/** Request a one-time verification code for a Nigerian phone number. */
export function sendOtp(phone: string): Promise<OtpRequestResponse> {
  return request<OtpRequestResponse>("auth/otp/request", {
    method: "POST",
    body: { phone },
  });
}

/** Verify OTP and save the access token. */
export async function verifyOtp(
  phone: string,
  code: string,
  intendedRole: AuthSession["role"] = "PASSENGER",
): Promise<AuthSession> {
  const session = await request<AuthSession>("auth/otp/verify", {
    method: "POST",
    body: {
      phone,
      code,
      intendedRole,
    },
  });

  persistSession(session);

  return session;
}

/** Register with email and password. */
export async function registerWithEmail(
  email: string,
  pass: string,
  intendedRole: "PASSENGER" | "DRIVER" = "PASSENGER",
): Promise<AuthSession> {
  const session = await request<AuthSession>("auth/register/email", {
    method: "POST",
    body: {
      email,
      pass,
      intendedRole,
    },
  });

  persistSession(session);

  return session;
}

/** Login with email and password. */
export async function loginWithEmail(
  email: string,
  pass: string,
): Promise<AuthSession> {
  const session = await request<AuthSession>("auth/login/email", {
    method: "POST",
    body: {
      email,
      pass,
    },
  });

  persistSession(session);

  return session;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await request<CurrentUser>("users/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearAccessToken();
      return null;
    }

    throw error;
  }
}

/** Estimate a fare using routing data supplied by the caller. */
export function getFareEstimate(
  pickup: RideLocation,
  dropoff: RideLocation,
  ride: RideDetails,
): Promise<FareEstimate> {
  void pickup;
  void dropoff;

  return request<FareEstimate>("fares/estimate", {
    method: "POST",
    body: {
      operatingAreaId: ride.operatingAreaId,
      vehicleCategoryId: ride.vehicleCategoryId,
      distanceKm: ride.distanceKm,
      durationMinutes: ride.durationMinutes,
    },
  });
}

/** Get a ride by ID. */
export function getRide(rideId: string): Promise<Ride> {
  return request<Ride>(
    `rides/${encodeURIComponent(rideId)}`,
  );
}

export function listNotifications(): Promise<UserNotification[]> {
  return request<unknown>("notifications").then((payload) =>
    collectionFrom<UserNotification>(payload),
  );
}

export function markNotificationRead(
  notificationId: string,
): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>(
    `notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "PATCH",
    },
  );
}

export function submitRideRating(
  rideId: string,
  score: number,
  comment?: string,
): Promise<RideRating> {
  return request<RideRating>(
    `rides/${encodeURIComponent(rideId)}/rating`,
    {
      method: "POST",
      body: {
        score,
        ...(comment?.trim()
          ? { comment: comment.trim() }
          : {}),
      },
    },
  );
}

export function registerDeviceToken(
  token: string,
  platform: "IOS" | "ANDROID" | "WEB",
): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>("notifications/device-tokens", {
    method: "POST",
    body: {
      token,
      platform,
    },
  });
}

export function unregisterDeviceToken(
  token: string,
): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>("notifications/device-tokens", {
    method: "DELETE",
    body: { token },
  });
}

const rideOfferPath = (
  rideId: string,
  offerId: string,
  action: "accept" | "counter" | "decline",
) =>
  `rides/${encodeURIComponent(
    rideId,
  )}/offers/${encodeURIComponent(offerId)}/${action}`;

/** Accept a driver's live offer. */
export function acceptDriverOffer(
  rideId: string,
  offerId: string,
): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>(
    rideOfferPath(rideId, offerId, "accept"),
    {
      method: "POST",
      body: {},
    },
  );
}

/** Send a rider counter-offer. */
export function counterDriverOffer(
  rideId: string,
  offerId: string,
  amountNaira: number,
): Promise<{ success?: boolean }> {
  const amountKobo = toKobo(amountNaira);

  if (
    !Number.isInteger(amountKobo) ||
    amountKobo % 5000 !== 0
  ) {
    throw new TypeError(
      "Counter-offers must be in increments of ₦50.",
    );
  }

  return request<{ success?: boolean }>(
    rideOfferPath(rideId, offerId, "counter"),
    {
      method: "POST",
      body: {
        amountKobo,
      },
    },
  );
}

/** Decline a driver's live offer. */
export function declineDriverOffer(
  rideId: string,
  offerId: string,
): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>(
    rideOfferPath(rideId, offerId, "decline"),
    {
      method: "POST",
      body: {},
    },
  );
}

/** Request a ride. */
export function requestRide(
  vehicleType: string,
  pickup: RideLocation,
  dropoff: RideLocation,
  ride: Omit<RideDetails, "vehicleCategoryId">,
): Promise<Ride> {
  return request<Ride>("rides", {
    method: "POST",
    body: {
      operatingAreaId: ride.operatingAreaId,
      vehicleCategoryId: vehicleType,

      pickupLat: pickup.latitude,
      pickupLng: pickup.longitude,
      pickupAddress: pickup.address,

      destinationLat: dropoff.latitude,
      destinationLng: dropoff.longitude,
      destinationAddress: dropoff.address,

      estimatedDistanceKm: ride.distanceKm,
      estimatedDurationMinutes: ride.durationMinutes,
    },
  });
}

export function getWalletBalance(): Promise<WalletBalance> {
  return request<WalletBalance>("wallet");
}

/** Create or change the 4–6 digit transaction PIN required for wallet payments. */
export function setTransactionPin(newPin: string, currentPin?: string): Promise<{ updated: boolean }> {
  return request<{ updated: boolean }>("wallet/pin", {
    method: "POST",
    body: { newPin, ...(currentPin ? { currentPin } : {}) },
  });
}

export type FundingMethod = "card" | "bank_transfer";

/**
 * Start a Paystack checkout to top up the wallet. When a method is given, the
 * checkout opens on that Paystack channel; if the server rejects the channel
 * hint, it retries with the default checkout so funding still works.
 */
export async function fundWallet(
  amountNaira: number,
  email: string,
  method?: FundingMethod,
): Promise<{ authorizationUrl: string | null }> {
  const body = { amountKobo: toKobo(amountNaira), email };
  if (!method) return request<{ authorizationUrl: string | null }>("wallet/fund", { method: "POST", body });
  try {
    return await request<{ authorizationUrl: string | null }>("wallet/fund", {
      method: "POST",
      body: { ...body, channels: [method] },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      return request<{ authorizationUrl: string | null }>("wallet/fund", { method: "POST", body });
    }
    throw error;
  }
}

/** Revoke the current session on the server. Local tokens are always cleared. */
export async function logout(): Promise<void> {
  try {
    if (getAccessToken()) await request("auth/logout", { method: "POST", skipRefresh: true });
  } catch {
    // Server-side revocation is best effort; the local session is cleared regardless.
  } finally {
    clearAccessToken();
  }
}

/** The passenger's active ride, or null when there is none. */
export function getCurrentRide(): Promise<Ride | null> {
  return request<Ride | null>("rides/current").then((ride) => (ride && ride.id ? ride : null));
}

/**
 * Transfer funds using a Nigerian phone number.
 * Amount is supplied in naira.
 */
export function transferFunds(
  recipientTag: string,
  amount: number,
  pin: string,
): Promise<WalletTransfer> {
  return request<WalletTransfer>("wallet/transfer", {
    method: "POST",
    body: {
      recipientPhone: recipientTag,
      amountKobo: toKobo(amount),
      pin,
    },
  });
}

/** Purchase airtime or data. */
export function purchaseVtu(
  type: VtuType,
  network: VtuNetwork,
  phone: string,
  planId: string,
  amount: number,
  pin: string,
): Promise<VtuPurchase> {
  if (type === "DATA") {
    return request<VtuPurchase>("vtu/data", {
      method: "POST",
      body: {
        network,
        phoneNumber: phone,
        bundleCode: planId,
        pin,
      },
    });
  }

  return request<VtuPurchase>("vtu/airtime", {
    method: "POST",
    body: {
      network,
      phoneNumber: phone,
      amountKobo: toKobo(amount),
      pin,
    },
  });
}

export function getBanks(): Promise<BankOption[]> {
  return request<unknown>("wallet/banks").then((payload) =>
    collectionFrom<BankOption>(payload),
  );
}

export function getBankTransferQuote(
  amountKobo: number,
): Promise<BankTransferQuote> {
  return request<BankTransferQuote>(
    `wallet/bank-transfers/quote?amountKobo=${encodeURIComponent(
      amountKobo,
    )}`,
  );
}

export function resolveBankAccount(
  accountNumber: string,
  bankCode: string,
): Promise<BankAccountResolution> {
  return request<BankAccountResolution>(
    "wallet/bank-transfers/resolve",
    {
      method: "POST",
      body: {
        accountNumber,
        bankCode,
      },
    },
  );
}

export function sendBankTransfer(params: {
  accountNumber: string;
  bankCode: string;
  amountKobo: number;
  pin: string;
  idempotencyKey: string;
}): Promise<BankTransferResult> {
  return request<BankTransferResult>(
    "wallet/bank-transfers",
    {
      method: "POST",
      body: params,
    },
  );
}

export function verifyBankTransfer(
  transferId: string,
): Promise<BankTransferResult> {
  return request<BankTransferResult>(
    `wallet/bank-transfers/${encodeURIComponent(
      transferId,
    )}/verify`,
    {
      method: "POST",
      body: {},
    },
  );
}

export function getRemitaBillServices(): Promise<
  RemitaBillService[]
> {
  return request<unknown>("bill-payments/services").then(
    (payload) => collectionFrom<RemitaBillService>(payload),
  );
}

export function validateBillCustomer(params: {
  serviceId: string;
  customerReference: string;
  phoneNumber?: string;
}): Promise<BillCustomerValidation> {
  return request<BillCustomerValidation>(
    "bill-payments/validate",
    {
      method: "POST",
      body: params,
    },
  );
}

export function submitBillPayment(params: {
  serviceId: string;
  customerReference: string;
  phoneNumber?: string;
  amountKobo: number;
  pin: string;
  idempotencyKey: string;
}): Promise<BillPaymentResult> {
  return request<BillPaymentResult>("bill-payments", {
    method: "POST",
    body: params,
  });
}

export function verifyBillPayment(
  paymentId: string,
): Promise<BillPaymentResult> {
  return request<BillPaymentResult>(
    `bill-payments/${encodeURIComponent(paymentId)}/verify`,
    {
      method: "POST",
      body: {},
    },
  );
}

const rideSegment = (rideId: string) => `rides/${encodeURIComponent(rideId)}`;

/** Surge multipliers arrive in basis points (10000 = 1.00x). */
export function surgeMultiplierFrom(estimate: FareEstimate | null | undefined): number {
  const basisPoints = Number(estimate?.surgeMultiplierBasisPoints);
  if (!Number.isFinite(basisPoints) || basisPoints <= 10_000) return 1;
  return Math.round((basisPoints / 10_000) * 100) / 100;
}

export interface IdentityVerificationStatus {
  status?: string | null;
  verifiedAt?: string | null;
  [key: string]: unknown;
}

export function getIdentityVerificationStatus(): Promise<IdentityVerificationStatus> {
  return request<IdentityVerificationStatus>("identity-verification/status");
}

export function submitNinVerification(params: {
  nin: string;
  fullName: string;
  dateOfBirth: string;
}): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>("identity-verification", {
    method: "POST",
    body: { ...params, consentGiven: true },
  });
}

export type PackageCategory = "DOCUMENT" | "PARCEL" | "FRAGILE" | "FOOD" | "ELECTRONICS" | "OTHER";
export type PackageWeightTier = "LIGHT" | "MEDIUM" | "HEAVY";

export interface Delivery {
  id: string;
  status?: string;
  proofPhotoUrl?: string | null;
  signatureUrl?: string | null;
  [key: string]: unknown;
}

export function createDelivery(params: {
  operatingAreaId: string;
  vehicleCategoryId: string;
  pickup: RideLocation;
  dropoff: RideLocation;
  distanceKm: number;
  durationMinutes: number;
  package: {
    category: PackageCategory;
    weightTier: PackageWeightTier;
    recipientName: string;
    recipientPhone: string;
    deliveryNotes?: string;
  };
}): Promise<Delivery> {
  return request<Delivery>("deliveries", {
    method: "POST",
    body: {
      operatingAreaId: params.operatingAreaId,
      vehicleCategoryId: params.vehicleCategoryId,
      pickupLat: params.pickup.latitude,
      pickupLng: params.pickup.longitude,
      pickupAddress: params.pickup.address,
      dropoffLat: params.dropoff.latitude,
      dropoffLng: params.dropoff.longitude,
      dropoffAddress: params.dropoff.address,
      estimatedDistanceKm: params.distanceKm,
      estimatedDurationMinutes: params.durationMinutes,
      package: params.package,
    },
  });
}

export function getCurrentDelivery(): Promise<Delivery | null> {
  return request<Delivery | null>("deliveries/current");
}

export function getDelivery(deliveryId: string): Promise<Delivery> {
  return request<Delivery>(`deliveries/${encodeURIComponent(deliveryId)}`);
}

export function cancelDelivery(deliveryId: string, reason?: string): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>(`deliveries/${encodeURIComponent(deliveryId)}/cancel`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export function submitDeliveryProof(
  deliveryId: string,
  params: { recipientName: string; signatureDataUrl: string; photoDataUrl?: string },
): Promise<Delivery> {
  return request<Delivery>(`deliveries/${encodeURIComponent(deliveryId)}/proof`, {
    method: "POST",
    body: params,
  });
}

export interface TripMessage {
  id: string;
  rideId: string;
  senderUserId: string;
  body: string;
  createdAt: string;
}

export function listTripMessages(rideId: string): Promise<TripMessage[]> {
  return request<unknown>(`${rideSegment(rideId)}/messages`).then((payload) =>
    collectionFrom<TripMessage>(payload),
  );
}

export function sendTripMessage(rideId: string, body: string): Promise<TripMessage> {
  return request<TripMessage>(`${rideSegment(rideId)}/messages`, {
    method: "POST",
    body: { body },
  });
}

export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
}

export function listTrustedContacts(): Promise<TrustedContact[]> {
  return request<unknown>("safety/trusted-contacts").then((payload) =>
    collectionFrom<TrustedContact>(payload),
  );
}

export function addTrustedContact(contact: { name: string; phone: string }): Promise<TrustedContact> {
  return request<TrustedContact>("safety/trusted-contacts", { method: "POST", body: contact });
}

export function removeTrustedContact(contactId: string): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>(`safety/trusted-contacts/${encodeURIComponent(contactId)}`, {
    method: "DELETE",
  });
}

export interface RidePinSettings {
  enabled: boolean;
  /** Only returned to the rider so they can read it to the driver at pickup. */
  pin?: string | null;
}

export function getRidePinSettings(): Promise<RidePinSettings> {
  return request<RidePinSettings>("safety/ride-pin");
}

export function updateRidePinSettings(enabled: boolean): Promise<RidePinSettings> {
  return request<RidePinSettings>("safety/ride-pin", { method: "PATCH", body: { enabled } });
}

export function triggerSos(
  rideId: string,
  location?: { latitude: number; longitude: number } | null,
): Promise<{ id: string; status?: string }> {
  return request<{ id: string; status?: string }>(`${rideSegment(rideId)}/sos`, {
    method: "POST",
    body: location ? { latitude: location.latitude, longitude: location.longitude } : {},
  });
}

export function createTripShareLink(rideId: string): Promise<{ url: string; expiresAt?: string }> {
  return request<{ url: string; expiresAt?: string }>(`${rideSegment(rideId)}/share`, { method: "POST", body: {} });
}

export interface SplitFareParticipant {
  phone: string;
  amountKobo?: number;
  status?: string;
}

export interface SplitFare {
  id: string;
  shareUrl?: string | null;
  participants: SplitFareParticipant[];
}

export function createSplitFare(rideId: string, phones: string[]): Promise<SplitFare> {
  return request<SplitFare>(`${rideSegment(rideId)}/split`, {
    method: "POST",
    body: { mode: "EQUAL", participants: phones.map((phone) => ({ phone })) },
  });
}

export interface BusinessProfile {
  id: string;
  name: string;
}

export function listBusinessProfiles(): Promise<BusinessProfile[]> {
  return request<unknown>("users/me/business-profiles").then((payload) =>
    collectionFrom<BusinessProfile>(payload),
  );
}

export function scheduleRide(params: {
  operatingAreaId: string;
  vehicleCategoryId: string;
  pickup: RideLocation;
  dropoff: RideLocation;
  stops: RideLocation[];
  distanceKm: number;
  durationMinutes: number;
  scheduledFor: string;
  businessProfileId?: string;
}): Promise<Ride> {
  return request<Ride>("rides/scheduled", {
    method: "POST",
    body: {
      operatingAreaId: params.operatingAreaId,
      vehicleCategoryId: params.vehicleCategoryId,
      pickupLat: params.pickup.latitude,
      pickupLng: params.pickup.longitude,
      pickupAddress: params.pickup.address,
      destinationLat: params.dropoff.latitude,
      destinationLng: params.dropoff.longitude,
      destinationAddress: params.dropoff.address,
      stops: params.stops.map((stop) => ({ lat: stop.latitude, lng: stop.longitude, address: stop.address })),
      estimatedDistanceKm: params.distanceKm,
      estimatedDurationMinutes: params.durationMinutes,
      scheduledFor: params.scheduledFor,
      businessProfileId: params.businessProfileId,
    },
  });
}

export function addRideStops(rideId: string, stops: RideLocation[]): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>(`${rideSegment(rideId)}/stops`, {
    method: "POST",
    body: { stops: stops.map((stop) => ({ lat: stop.latitude, lng: stop.longitude, address: stop.address })) },
  });
}

export function assignRideToBusiness(rideId: string, businessProfileId: string): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>(`${rideSegment(rideId)}/business-profile`, {
    method: "POST",
    body: { businessProfileId },
  });
}

export interface RewardsSummary {
  points: number;
  tier?: string | null;
  nextTierPoints?: number | null;
  tripsCount?: number | null;
  averageRating?: number | null;
  savingsKobo?: number | null;
  pointsPerNaira?: number | null;
}

export function getRewardsSummary(): Promise<RewardsSummary> {
  return request<RewardsSummary>("rewards/summary");
}

export function redeemRewardPoints(points: number): Promise<{ voucherCode: string; valueKobo: number }> {
  return request<{ voucherCode: string; valueKobo: number }>("rewards/redeem", { method: "POST", body: { points } });
}

export type SavedPlaceLabel = "HOME" | "WORK";

export interface SavedPlace {
  id: string;
  label: SavedPlaceLabel;
  address: string;
  latitude: number;
  longitude: number;
}

export function listSavedPlaces(): Promise<SavedPlace[]> {
  return request<unknown>("users/me/saved-places").then((payload) =>
    collectionFrom<SavedPlace>(payload),
  );
}

export function saveSavedPlace(place: Omit<SavedPlace, "id">): Promise<SavedPlace> {
  return request<SavedPlace>("users/me/saved-places", { method: "POST", body: place });
}

export function removeSavedPlace(placeId: string): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>(`users/me/saved-places/${encodeURIComponent(placeId)}`, { method: "DELETE" });
}

export function updateCurrentUser(changes: {
  fullName?: string;
  email?: string;
  phone?: string;
}): Promise<CurrentUser> {
  return request<CurrentUser>("users/me", { method: "PATCH", body: changes });
}

export function tipDriver(rideId: string, amountNaira: number): Promise<{ id?: string; status?: string }> {
  return request<{ id?: string; status?: string }>(`${rideSegment(rideId)}/tip`, {
    method: "POST",
    body: { amountKobo: toKobo(amountNaira) },
  });
}

export type DriverRideAction = "accept" | "arrived" | "start" | "complete" | "cancel";

export interface DriverRide extends Ride {
  pickupLat?: number;
  pickupLng?: number;
  pickupAddress?: string | null;
  destinationLat?: number;
  destinationLng?: number;
  destinationAddress?: string | null;
  estimatedDistanceKm?: number;
  estimatedDurationMinutes?: number;
  estimatedFareKobo?: number;
  finalFareKobo?: number | null;
  requestedAt?: string;
}

const driverRideSegment = (rideId: string) => `drivers/rides/${encodeURIComponent(rideId)}`;

export function listAvailableDriverRides(): Promise<DriverRide[]> {
  return request<unknown>("drivers/rides/available").then((payload) =>
    collectionFrom<DriverRide>(payload),
  );
}

export function getCurrentDriverRide(): Promise<DriverRide | null> {
  return request<DriverRide | null>("drivers/rides/current").then((ride) =>
    ride && typeof ride === "object" && "id" in ride ? ride : null,
  );
}

export function runDriverRideAction(
  rideId: string,
  action: DriverRideAction,
  reason?: string,
): Promise<DriverRide> {
  return request<DriverRide>(`${driverRideSegment(rideId)}/${action}`, {
    method: "POST",
    body: action === "cancel" ? { reason } : {},
  });
}

export function updateDriverLocation(params: {
  latitude: number;
  longitude: number;
  isOnline: boolean;
  heading?: number;
}): Promise<{ success?: boolean }> {
  return request<{ success?: boolean }>("drivers/location", { method: "POST", body: params });
}

export function getDriverWallet(): Promise<WalletBalance> {
  return request<WalletBalance>("drivers/wallet");
}

export function listRideHistory(limit = 3): Promise<Ride[]> {
  return request<unknown>(`rides/history?limit=${limit}`).then((payload) =>
    collectionFrom<Ride>(payload),
  );
}
