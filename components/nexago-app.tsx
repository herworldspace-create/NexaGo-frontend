'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import useSWR from 'swr'
import {
  ArrowDownUp,
  Bell,
  CalendarDays,
  ArrowLeft,
  ArrowRight,
  Bike,
  Car,
  Check,
  Siren,
  ChevronDown,
  CreditCard,
  KeyRound,
  MapPin,
  Landmark,
  Receipt,
  Minus,
  Navigation,
  Plane,
  Plus,
  ShieldCheck,
  Smartphone,
  Star,
  User,
  Wallet,
  Wifi,
  X,
} from 'lucide-react'
import {
  acceptDriverOffer,
  ApiError,
  clearAccessToken,
  counterDriverOffer,
  declineDriverOffer,
  getAccessToken,
  getCurrentUser,
  getDataBundles,
  getFareEstimate,
  getOperatingAreas,
  getRealtimeUrl,
  getRide,
  getVehicleCategories,
  getWalletBalance,
  listNotifications,
  markNotificationRead,
  previewRoute,
  purchaseVtu,
  requestRide,
  sendOtp,
  setAccessToken,
  transferFunds,
  submitRideRating,
  verifyOtp,
  registerWithEmail,
  loginWithEmail,
  getStoredSession,
  logout,
  setTransactionPin,
  fundWallet,
  getCurrentRide,
  scheduleRide,
  addRideStops,
  assignRideToBusiness,
  surgeMultiplierFrom,
  SESSION_EXPIRED_EVENT,
  type WalletTransaction,
  type AuthSession,
  type OperatingArea,
  type RideLocation,
  type RoutePreview,
  type UserNotification,
  type VehicleCategory,
  type VtuDataBundle,
  type VtuNetwork,
  type VtuType,
} from '../lib/api'
import { DriverMode } from './driver/driver-mode'
import { FlightsScreen } from './flights/flights-screen'
import { PostTripSheet } from './trip/post-trip-sheet'
import { SosSheet } from './trip/sos-sheet'
import { NexaPayBankTransferForm } from './nexapay-bank-transfer-form'
import { NexaPayBillPaymentForm } from './nexapay-bill-payment-form'
import Profile from './Profile'
import { BrandLogo } from './brand/brand-logo'
import { SplashScreen } from './brand/splash-screen'
import { TransactionHistory } from './nexapay/transaction-history'
import { LiveTripPanel, type LiveConnection } from './trip/live-trip-panel'
import { RideTierSelector } from './trip/ride-tier-selector'
import { TripOptions, MAX_STOPS, type TripMode } from './trip/trip-options'
import { rideTiers, tierKeyForCategory } from '../lib/ride-tiers'

const NexaGoMap = dynamic(() => import('../app/nexago-map').then((module) => module.NexaGoMap), {
  ssr: false,
  loading: () => <div className="h-full min-h-[210px] animate-pulse rounded-2xl bg-emerald-50" />,
})

type Screen = 'rides' | 'wallet' | 'flights' | 'driver'
type WalletModal = 'airtime' | 'data' | 'send' | 'bank' | 'bills' | null
type Vehicle = { id: string; label: string; description: string; categoryId: string; icon: typeof Bike }
type DriverOffer = { id: string; amount: number; driverName: string; driverRating?: number }
type ApiRoute = {
  pickupLat: string
  pickupLng: string
  dropoffLat: string
  dropoffLng: string
  distanceKm: string
  durationMinutes: string
}

function vehicleOption(category: VehicleCategory): Vehicle {
  const value = `${category.code} ${category.name}`.toLowerCase()
  const icon = /bike|okada|motor/.test(value) ? Bike : /keke|tricycle/.test(value) ? Navigation : CreditCard
  return { id: category.id, label: category.name, description: category.description || 'Passenger ride', categoryId: category.id, icon }
}

const networks: { label: string; value: VtuNetwork }[] = [
  { label: 'MTN', value: 'MTN' },
  { label: 'Airtel', value: 'AIRTEL' },
  { label: 'Glo', value: 'GLO' },
  { label: '9mobile', value: 'NINE_MOBILE' },
]

const initialRoute: ApiRoute = {
  pickupLat: '',
  pickupLng: '',
  dropoffLat: '',
  dropoffLng: '',
  distanceKm: '',
  durationMinutes: '',
}

const fieldClass = 'h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10'
const labelClass = 'grid gap-1.5 text-xs font-semibold text-slate-700'

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Sign in to continue with your NexaGo account.'
    if (error.status === 0) return 'Network connection failed. Check your connection and try again.'
    if (error.status >= 500) return 'NexaGo is having trouble right now. Please try again in a moment.'
    const message = error.message.toLowerCase()
    if (message.includes('no active fare configuration')) return 'Fares for this ride type haven’t been set up in your area yet. Try another ride type.'
    if (message.includes('insufficient') || message.includes('wallet balance')) return 'Insufficient wallet balance. Add funds and try again.'
    if (message.includes('pin') || message.includes('transaction pin')) return 'Your transaction PIN could not be verified. Check it and try again.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)
}

function numberFromFare(data: Record<string, unknown>): number | null {
  const kobo = data.totalKobo ?? data.totalFareKobo ?? data.estimatedFareKobo ?? data.finalFareKobo
  if (typeof kobo === 'number' && Number.isFinite(kobo)) return Math.round(kobo / 100)
  const naira = data.totalFare ?? data.estimatedFare ?? data.fare
  return typeof naira === 'number' && Number.isFinite(naira) ? Math.round(naira) : null
}

function getRouteNumber(value: string, label: string): number {
  if (!value.trim()) throw new Error(`Enter a valid ${label}.`)
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`Enter a valid ${label}.`)
  return parsed
}

export function NexaGoApp() {
  const [screen, setScreen] = useState<Screen>('rides')
  const [tripMode, setTripMode] = useState<TripMode>('now')
  const [scheduledFor, setScheduledFor] = useState('')
  const [businessProfileId, setBusinessProfileId] = useState('')
  const [stops, setStops] = useState<RideLocation[]>([])
  const [addingStop, setAddingStop] = useState(false)
  const [liveSocket, setLiveSocket] = useState<Socket | null>(null)
  const [liveConnection, setLiveConnection] = useState<LiveConnection>('connecting')
  const [fareSurge, setFareSurge] = useState(1)
  const [categories, setCategories] = useState<VehicleCategory[]>([])
  const [areas, setAreas] = useState<OperatingArea[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId)
  const selectedVehicle = selectedCategory ? vehicleOption(selectedCategory) : null
  const selectedArea = areas.find((area) => area.id === selectedAreaId)
  const [pickup, setPickup] = useState('Use my current location')
  const [dropoff, setDropoff] = useState('')
  const [route, setRoute] = useState<ApiRoute>(initialRoute)
  const [routePath, setRoutePath] = useState<RideLocation[]>([])
  const [driverLocation, setDriverLocation] = useState<RideLocation | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState('')
  const [dataBundles, setDataBundles] = useState<VtuDataBundle[]>([])
  const [bundleLoading, setBundleLoading] = useState(false)
  const [routeDetailsOpen, setRouteDetailsOpen] = useState(false)
  const [fareOpen, setFareOpen] = useState(false)
  const [fareLoading, setFareLoading] = useState(false)
  const [fareAmount, setFareAmount] = useState<number | null>(null)
  const [offerAmount, setOfferAmount] = useState('')
  const [fareError, setFareError] = useState('')
  const [rideError, setRideError] = useState('')
  const [rideLoading, setRideLoading] = useState(false)
  const [rideId, setRideId] = useState('')
  const [driverOffer, setDriverOffer] = useState<DriverOffer | null>(null)
  const [counterAmount, setCounterAmount] = useState('')
  const [offerActionLoading, setOfferActionLoading] = useState(false)
  const [rideStatus, setRideStatus] = useState<'idle' | 'searching' | 'accepted' | 'declined' | 'completed'>('idle')
  const [walletModal, setWalletModal] = useState<WalletModal>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [network, setNetwork] = useState<VtuNetwork>('MTN')
  const [phone, setPhone] = useState('')
  const [planId, setPlanId] = useState('')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [pin, setPin] = useState('')
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletError, setWalletError] = useState('')
  const [walletSuccess, setWalletSuccess] = useState('')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'phone' | 'email'>('email')
  const [authStep, setAuthStep] = useState<'phone' | 'otp'>('phone')
  const [emailMode, setEmailMode] = useState<'login' | 'register'>('login')
  const [authPhone, setAuthPhone] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [toast, setToast] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationUpdating, setNotificationUpdating] = useState('')
  const [ratingRideId, setRatingRideId] = useState('')
  const [ratingOpen, setRatingOpen] = useState(false)
  const [ratingScore, setRatingScore] = useState<number>(5)
  const [ratingComment, setRatingComment] = useState<string>('')
  const [ratingError, setRatingError] = useState<string | null>(null)
  const [ratingLoading, setRatingLoading] = useState<boolean>(false)
  const [authRole, setAuthRole] = useState<AuthSession['role']>('PASSENGER')
  const [sosOpen, setSosOpen] = useState(false)

  const handleSubmitRating = async (event?: FormEvent) => {
    if (event) event.preventDefault()
    if (!ratingRideId) return
    try {
      setRatingLoading(true)
      setRatingError(null)
      await submitRideRating(ratingRideId, ratingScore, ratingComment)
      setRatingOpen(false)
      setRatingRideId('')
      showToast('Thank you! Your rating has been submitted.')
    } catch (error) {
      setRatingError(getErrorMessage(error))
    } finally {
      setRatingLoading(false)
    }
  }

  const { data: notifications = [], error: notificationsError, isLoading: notificationsLoading, mutate: refreshNotifications } = useSWR(
    session ? ['nexago-notifications', session.userId] : null,
    () => listNotifications(),
  )
  const unreadNotificationCount = notifications.filter((notification) => !notification.readAt).length
  const { data: currentUser, mutate: mutateCurrentUser } = useSWR(
    session ? ['nexago-profile', session.userId] : null,
    () => getCurrentUser(),
  )
  const firstName = currentUser?.passengerProfile?.fullName?.trim().split(/\s+/)[0]
  const [hasPinSet, setHasPinSet] = useState<boolean | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [pinSetupOpen, setPinSetupOpen] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [currentPinValue, setCurrentPinValue] = useState('')
  const [pinSetupLoading, setPinSetupLoading] = useState(false)
  const [pinSetupError, setPinSetupError] = useState('')
  const [fundOpen, setFundOpen] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [fundLoading, setFundLoading] = useState(false)
  const [fundError, setFundError] = useState('')
  const [fundMethod, setFundMethod] = useState<'card' | 'bank_transfer'>('card')
  const [routeEstimated, setRouteEstimated] = useState(false)

  useEffect(() => {
    const stored = getStoredSession()
    if (stored) setSession(stored)
    const handleExpired = () => {
      setSession(null)
      setWalletBalance(null)
      setHasPinSet(null)
      setTransactions([])
      setToast('Your session expired. Please sign in again.')
      window.setTimeout(() => setToast(''), 3200)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired)
  }, [])

  useEffect(() => {
    if (!session?.userId) {
      setCatalogLoading(false)
      setCatalogError("")
      return
    }
    let active = true
    setCatalogLoading(true)
    Promise.allSettled([getVehicleCategories(), getOperatingAreas()]).then(([categoryResult, areaResult]) => {
      if (!active) return
      const failures = [categoryResult, areaResult].filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      if (categoryResult.status === 'fulfilled') {
        const available = categoryResult.value.filter((category) => category.isActive !== false && ['PASSENGER', 'DELIVERY'].includes(category.type ?? 'PASSENGER'))
        setCategories(available)
        setSelectedCategoryId((current) => current || available[0]?.id || '')
      }
      if (areaResult.status === 'fulfilled') {
        const available = areaResult.value.filter((area) => area.isActive !== false)
        setAreas(available)
        setSelectedAreaId((current) => current || available[0]?.id || '')
      }
      const forbidden = failures.some(({ reason }) => reason instanceof ApiError && reason.status === 403)
      setCatalogError(
        failures.length === 0 ? '' :
        forbidden ? 'Ride types for your area haven’t been published to rider accounts yet. Booking will open as soon as they’re live.' :
        getErrorMessage(failures[0].reason),
      )
      setCatalogLoading(false)
    })
    void getCurrentRide().then((ride) => {
      if (!active || !ride) return
      setRideId(ride.id)
      setRideStatus(ride.status === 'ACCEPTED' || ride.status === 'DRIVER_ARRIVED' || ride.status === 'IN_PROGRESS' ? 'accepted' : 'searching')
    }).catch(() => undefined)
    return () => { active = false }
  }, [session?.userId])

  useEffect(() => {
    if (walletModal !== 'data') return
    let active = true
    setBundleLoading(true)
    getDataBundles(network).then((bundles) => {
      if (!active) return
      const available = bundles.filter((bundle) => bundle.code && Number.isFinite(bundle.priceKobo) && bundle.priceKobo > 0)
      setDataBundles(available)
      setPlanId((current) => available.some((bundle) => bundle.code === current) ? current : available[0]?.code || '')
    }).catch((error: unknown) => {
      if (active) {
        setDataBundles([])
        setWalletError(getErrorMessage(error))
      }
    }).finally(() => { if (active) setBundleLoading(false) })
    return () => { active = false }
  }, [network, walletModal])

  useEffect(() => {
    if (!rideId || !session?.accessToken) return
    let active = true
    void getRide(rideId).then((ride) => {
      if (!active) return
      if (ride.status === 'ACCEPTED' || ride.status === 'DRIVER_ARRIVED' || ride.status === 'IN_PROGRESS') setRideStatus('accepted')
      else if (ride.status === 'COMPLETED') {
        setRideStatus('completed')
        setRatingRideId(rideId)
        setRatingOpen(true)
      } else if (ride.status?.startsWith('CANCELLED') || ride.status === 'EXPIRED' || ride.status === 'NO_DRIVERS_AVAILABLE') {
        setRideStatus('declined')
        setRideError('This ride request ended. You can request another driver.')
      }
    }).catch((error: unknown) => {
      if (active) setRideError(getErrorMessage(error))
    })
    let socket: ReturnType<typeof io>
    try {
      socket = io(getRealtimeUrl(), {
        auth: { token: getAccessToken() ?? session.accessToken },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 6,
      })
    } catch (error) {
      setRideError(getErrorMessage(error))
      return () => { active = false }
    }
    setLiveSocket(socket)
    setLiveConnection('connecting')
    socket.on('connect', () => {
      setLiveConnection('live')
      socket.emit('ride:subscribe', { rideId })
    })
    socket.on('disconnect', () => setLiveConnection('polling'))
    socket.on('ride:status', (event: { rideId?: string; status?: string; reason?: string }) => {
      if (event.rideId !== rideId) return
      if (event.status === 'ACCEPTED') {
        setRideStatus('accepted')
        setDriverOffer(null)
        setToast('A driver accepted your ride request.')
        window.setTimeout(() => setToast(''), 3200)
      } else if (event.status === 'COMPLETED') {
        setRideStatus('completed')
        setRatingRideId(rideId)
        setRatingOpen(true)
        setDriverOffer(null)
        showToast('Your trip is complete. Share a quick rating for your driver.')
      } else if (event.status?.startsWith('CANCELLED') || event.status === 'EXPIRED' || event.status === 'NO_DRIVERS_AVAILABLE') {
        setRideStatus('declined')
        setDriverOffer(null)
        setRideError(event.reason || 'This ride request ended. You can request another driver.')
      }
    })
    socket.on('ride:driver_location', (event: RideLocation & { rideId?: string }) => {
      if (event.rideId === rideId) setDriverLocation({ latitude: event.latitude, longitude: event.longitude })
    })
    socket.on('ride:driver_offer', (event: unknown) => {
      if (!event || typeof event !== 'object') return
      const data = event as Record<string, unknown>
      if (typeof data.rideId === 'string' && data.rideId !== rideId) return
      const rawAmount = typeof data.amountKobo === 'number' ? data.amountKobo / 100 : data.amount
      if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount) || rawAmount <= 0) return
      setDriverOffer({
        id: typeof data.offerId === 'string' ? data.offerId : typeof data.id === 'string' ? data.id : '',
        amount: rawAmount,
        driverName: typeof data.driverName === 'string' ? data.driverName : 'Your driver',
        driverRating: typeof data.driverRating === 'number' ? data.driverRating : undefined,
      })
      setCounterAmount(String(Math.round(rawAmount / 50) * 50))
    })
    socket.on('connect_error', () => {
      setLiveConnection('polling')
      setRideError('Live ride updates are temporarily unavailable. Ride status will refresh when the connection returns.')
    })
    return () => {
      active = false
      socket.emit('ride:unsubscribe', { rideId })
      socket.disconnect()
      setLiveSocket(null)
    }
  }, [rideId, session?.accessToken])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }, [])

  const openAuthAs = (role: AuthSession['role']) => {
    setAuthRole(role)
    setAuthOpen(true)
    setAuthMode('email')
    setAuthStep('phone')
    setAuthError('')
  }
  const openAuth = () => openAuthAs('PASSENGER')
  const openDriverAuth = () => {
    if (session) signOut({ silent: true })
    openAuthAs('DRIVER')
  }

  const loadWalletBalance = async () => {
    if (!getAccessToken()) {
      setWalletError('Sign in to view your NexaPay balance.')
      return
    }
    setBalanceLoading(true)
    setWalletError('')
    try {
      const result = await getWalletBalance()
      setWalletBalance(result.balanceKobo / 100)
      setHasPinSet(result.hasPinSet ?? null)
      setTransactions(Array.isArray(result.recentTransactions) ? result.recentTransactions : [])
    } catch (error) {
      setWalletError(getErrorMessage(error))
    } finally {
      setBalanceLoading(false)
    }
  }

  const changeScreen = (next: Screen) => {
    setScreen(next)
    if (next === 'wallet') void loadWalletBalance()
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('screen')
    if (requested === 'flights') setScreen('flights')
  }, [])

  const openNotifications = () => {
    if (!session) {
      openAuth()
      return
    }
    setNotificationsOpen(true)
  }

  const handleMarkNotificationRead = async (notification: UserNotification) => {
    if (!notification.id || notificationUpdating) return
    setNotificationUpdating(notification.id)
    try {
      await markNotificationRead(notification.id)
      await refreshNotifications()
    } catch (error) {
      showToast(getErrorMessage(error))
    } finally {
      setNotificationUpdating('')
    }
  }

  const finishPostTrip = (message: string) => {
    setRatingOpen(false)
    setRatingRideId('')
    showToast(message)
  }

  const openWalletModal = (next: Exclude<WalletModal, null>) => {
    setWalletModal(next)
    setPhone('')
    setPlanId('')
    setDataBundles([])
    setAmount('')
    setRecipient('')
    setPin('')
    setWalletError('')
    setWalletSuccess('')
  }

  const closeWalletModal = () => {
    if (walletLoading) return
    setWalletModal(null)
    setWalletError('')
    setWalletSuccess('')
  }

  const previewAndUpdateRoute = async (origin: RideLocation, destination: RideLocation): Promise<RoutePreview> => {
    setRouteLoading(true)
    setRouteError('')
    try {
      const result = await previewRoute(origin, destination)
      if (!Number.isFinite(result.distanceKm) || !Number.isFinite(result.durationMinutes) || result.distanceKm <= 0 || result.durationMinutes <= 0) {
        throw new Error('The routing service returned an invalid distance or duration.')
      }
      setRoute((current) => ({
        ...current,
        pickupLat: String(origin.latitude), pickupLng: String(origin.longitude),
        dropoffLat: String(destination.latitude), dropoffLng: String(destination.longitude),
        distanceKm: String(result.distanceKm), durationMinutes: String(result.durationMinutes),
      }))
      setRoutePath(result.path ?? [origin, destination])
      setRouteEstimated(Boolean(result.estimated))
      return result
    } catch (error) {
      setRouteError(getErrorMessage(error))
      throw error
    } finally {
      setRouteLoading(false)
    }
  }

  const locatePickup = () => {
    if (!navigator.geolocation) {
      setRouteError('Location is unavailable in this browser. Choose a pickup from the map instead.')
      return
    }
    setGpsLoading(true)
    setRouteError('')
    navigator.geolocation.getCurrentPosition((position) => {
      const origin = { latitude: position.coords.latitude, longitude: position.coords.longitude, address: 'Current location' }
      setPickup('Current location')
      setRoute((current) => ({ ...current, pickupLat: String(origin.latitude), pickupLng: String(origin.longitude) }))
      setGpsLoading(false)
      const destinationLat = Number(route.dropoffLat)
      const destinationLng = Number(route.dropoffLng)
      if (Number.isFinite(destinationLat) && Number.isFinite(destinationLng) && route.dropoffLat && route.dropoffLng) {
        void previewAndUpdateRoute(origin, { latitude: destinationLat, longitude: destinationLng, address: dropoff }).catch(() => undefined)
      }
    }, (error) => {
      setGpsLoading(false)
      setRouteError(error.code === error.PERMISSION_DENIED ? 'Location permission was denied. Enable location access or choose a pickup manually.' : 'Could not determine your location. Try again or choose a pickup manually.')
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 })
  }

  const chooseDropoff = (coordinate: RideLocation) => {
    if (addingStop) {
      setStops((current) => current.length >= MAX_STOPS ? current : [...current, { ...coordinate, address: `Stop (${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)})` }])
      setAddingStop(false)
      return
    }
    const address = `Pinned destination (${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)})`
    setDropoff(address)
    setRoute((current) => ({ ...current, dropoffLat: String(coordinate.latitude), dropoffLng: String(coordinate.longitude) }))
    const pickupLat = Number(route.pickupLat)
    const pickupLng = Number(route.pickupLng)
    if (route.pickupLat && route.pickupLng && Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
      void previewAndUpdateRoute({ latitude: pickupLat, longitude: pickupLng, address: pickup }, { ...coordinate, address }).catch(() => undefined)
    }
  }

  const openFare = async (vehicle: Vehicle) => {
    setSelectedCategoryId(vehicle.id)
    setFareOpen(true)
    setFareLoading(true)
    setFareAmount(null)
    setFareError('')
    setOfferAmount('')
    if (!selectedAreaId) {
      setFareError(catalogLoading ? 'Loading operating areas…' : 'No active operating area is available from the backend.')
      setFareLoading(false)
      return
    }
    if (!pickup.trim() || !dropoff.trim()) {
      setFareError('Set your pickup and drop-off locations before requesting a fare.')
      setFareLoading(false)
      return
    }

    try {
      const origin = { latitude: getRouteNumber(route.pickupLat, 'pickup latitude'), longitude: getRouteNumber(route.pickupLng, 'pickup longitude'), address: pickup }
      const destination = { latitude: getRouteNumber(route.dropoffLat, 'drop-off latitude'), longitude: getRouteNumber(route.dropoffLng, 'drop-off longitude'), address: dropoff }
      let tripDistance = Number(route.distanceKm)
      let tripDuration = Number(route.durationMinutes)
      if (!Number.isFinite(tripDistance) || tripDistance <= 0 || !Number.isFinite(tripDuration) || tripDuration <= 0) {
        const preview = await previewAndUpdateRoute(origin, destination)
        tripDistance = preview.distanceKm
        tripDuration = preview.durationMinutes
      }
      const estimate = await getFareEstimate(origin, destination, {
        operatingAreaId: selectedAreaId,
        vehicleCategoryId: vehicle.categoryId,
        distanceKm: tripDistance,
        durationMinutes: tripDuration,
      })
      const quote = numberFromFare(estimate as Record<string, unknown>)
      setFareAmount(quote)
      setFareSurge(surgeMultiplierFrom(estimate))
      if (quote !== null) setOfferAmount(String(quote))
      else setFareError('The fare service returned no price for this route and vehicle.')
    } catch (error) {
      setFareError(getErrorMessage(error))
    } finally {
      setFareLoading(false)
    }
  }

  const handleFindDriver = async () => {
    setRideError('')
    if (!dropoff.trim()) {
      setRideError('Choose a drop-off on the map before requesting a driver.')
      return
    }
    if (!selectedAreaId || !selectedVehicle) {
      setRideError(catalogLoading ? 'Loading ride options…' : 'No active ride category or operating area is available.')
      return
    }

    try {
      const ride = {
        operatingAreaId: selectedAreaId,
        vehicleCategoryId: selectedVehicle.categoryId,
        distanceKm: getRouteNumber(route.distanceKm, 'route distance'),
        durationMinutes: getRouteNumber(route.durationMinutes, 'route duration'),
      }
      if (ride.distanceKm <= 0 || ride.durationMinutes <= 0) throw new Error('Route distance and duration must be greater than zero.')
      const pickupLocation: RideLocation = { latitude: getRouteNumber(route.pickupLat, 'pickup latitude'), longitude: getRouteNumber(route.pickupLng, 'pickup longitude'), address: pickup }
      const dropoffLocation: RideLocation = { latitude: getRouteNumber(route.dropoffLat, 'drop-off latitude'), longitude: getRouteNumber(route.dropoffLng, 'drop-off longitude'), address: dropoff }
      if ([pickupLocation.latitude, dropoffLocation.latitude].some((value) => value < -90 || value > 90)) throw new Error('Latitude must be between -90 and 90 degrees.')
      if ([pickupLocation.longitude, dropoffLocation.longitude].some((value) => value < -180 || value > 180)) throw new Error('Longitude must be between -180 and 180 degrees.')
      if (tripMode === 'scheduled') {
        const when = new Date(scheduledFor)
        if (!scheduledFor || Number.isNaN(when.getTime())) throw new Error('Choose a pickup date and time for your scheduled ride.')
        if (when.getTime() < Date.now() + 14 * 60_000) throw new Error('Scheduled rides must be booked at least 15 minutes ahead.')
        setRideLoading(true)
        await scheduleRide({
          operatingAreaId: selectedAreaId,
          vehicleCategoryId: selectedVehicle.categoryId,
          pickup: pickupLocation,
          dropoff: dropoffLocation,
          stops,
          distanceKm: ride.distanceKm,
          durationMinutes: ride.durationMinutes,
          scheduledFor: when.toISOString(),
          businessProfileId: businessProfileId || undefined,
        })
        setFareOpen(false)
        setStops([])
        showToast(`Ride scheduled for ${when.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}.`)
        return
      }
      setRideLoading(true)
      const result = await requestRide(selectedVehicle.categoryId, pickupLocation, dropoffLocation, ride)
      if (stops.length > 0) await addRideStops(result.id, stops).catch(() => showToast('Your ride was requested, but the extra stops could not be added.'))
      if (businessProfileId) await assignRideToBusiness(result.id, businessProfileId).catch(() => showToast('Your ride was requested, but it could not be billed to your business profile.'))
      setRideId(result.id)
      setRideStatus('searching')
      setDriverLocation(null)
      setDriverOffer(null)
      setFareOpen(false)
      showToast(`Ride request ${result.id} sent. Waiting for live driver updates.`)
    } catch (error) {
      setRideError(getErrorMessage(error))
    } finally {
      setRideLoading(false)
    }
  }

  const handleWalletSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session) {
      setWalletError('Sign in to continue with your NexaGo account.')
      return
    }
    if (hasPinSet === false) {
      setWalletError('Create your transaction PIN first, then try again.')
      return
    }
    setWalletLoading(true)
    setWalletError('')
    setWalletSuccess('')

    try {
      if (walletModal === 'send') {
        await transferFunds(recipient.trim(), Number(amount), pin)
        setWalletSuccess('Transfer submitted successfully.')
      } else if (walletModal === 'airtime') {
        await purchaseVtu('AIRTIME', network, phone.trim(), '', Number(amount), pin)
        setWalletSuccess('Airtime purchase submitted successfully.')
      } else if (walletModal === 'data') {
        const selectedBundle = dataBundles.find((bundle) => bundle.code === planId)
        if (!selectedBundle) throw new Error('Choose an available data plan before continuing.')
        await purchaseVtu('DATA', network, phone.trim(), selectedBundle.code, selectedBundle.priceKobo / 100, pin)
        setWalletSuccess('Data purchase submitted successfully.')
      }
      await loadWalletBalance()
    } catch (error) {
      setWalletError(getErrorMessage(error))
      void getWalletBalance().then((result) => setWalletBalance(result.balanceKobo / 100)).catch(() => undefined)
    } finally {
      setWalletLoading(false)
    }
  }

  const handleSendOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      await sendOtp(authPhone.trim())
      setAuthStep('otp')
    } catch (error) {
      setAuthError(getErrorMessage(error))
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      const verified = await verifyOtp(authPhone.trim(), otp.trim(), authRole)
      setAccessToken(verified.accessToken)
      setSession(verified)
      setAuthOpen(false)
      setOtp('')
      showToast('You’re signed in securely.')
      if (screen === 'wallet') void loadWalletBalance()
    } catch (error) {
      setAuthError(getErrorMessage(error))
    } finally {
      setAuthLoading(false)
    }
  }

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      let verified: AuthSession
      if (emailMode === 'login') {
        verified = await loginWithEmail(authEmail.trim(), authPassword)
      } else {
        verified = await registerWithEmail(authEmail.trim(), authPassword, authRole)
      }
      setAccessToken(verified.accessToken)
      setSession(verified)
      setAuthOpen(false)
      setAuthPassword('')
      showToast('You’re signed in securely.')
      if (screen === 'wallet') void loadWalletBalance()
    } catch (error) {
      setAuthError(getErrorMessage(error))
    } finally {
      setAuthLoading(false)
    }
  }

  function signOut({ silent = false }: { silent?: boolean } = {}) {
    void logout()
    clearAccessToken()
    setSession(null)
    setWalletBalance(null)
    setHasPinSet(null)
    setTransactions([])
    setCategories([])
    setAreas([])
    setRideId('')
    setRideStatus('idle')
    if (!silent) showToast('Signed out.')
  }

  const openPinSetup = () => {
    if (!session) {
      openAuth()
      return
    }
    setNewPin('')
    setConfirmPin('')
    setCurrentPinValue('')
    setPinSetupError('')
    setPinSetupOpen(true)
  }

  const handlePinSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinSetupError('Your PIN must be 4 to 6 digits.')
      return
    }
    if (newPin !== confirmPin) {
      setPinSetupError('The PINs don’t match. Re-enter them to confirm.')
      return
    }
    if (hasPinSet && !currentPinValue) {
      setPinSetupError('Enter your current PIN to change it.')
      return
    }
    setPinSetupLoading(true)
    setPinSetupError('')
    try {
      await setTransactionPin(newPin, hasPinSet ? currentPinValue : undefined)
      setHasPinSet(true)
      setPinSetupOpen(false)
      showToast(hasPinSet ? 'Your transaction PIN was changed.' : 'Your transaction PIN is set. You’re ready to pay.')
    } catch (error) {
      setPinSetupError(getErrorMessage(error))
    } finally {
      setPinSetupLoading(false)
    }
  }

  const openFund = () => {
    if (!session) {
      openAuth()
      return
    }
    setFundAmount('')
    setFundError('')
    setFundOpen(true)
  }

  const handleFund = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Number(fundAmount)
    if (!Number.isFinite(value) || value < 100) {
      setFundError('Enter at least ₦100 to add to your wallet.')
      return
    }
    const email = currentUser?.email
    if (!email) {
      setFundError('Wallet top-ups need an email on your account. Add one from your profile, then try again.')
      return
    }
    setFundLoading(true)
    setFundError('')
    try {
      const result = await fundWallet(value, email, fundMethod)
      if (!result.authorizationUrl) throw new Error('The payment page could not be opened. Please try again.')
      if (window.self !== window.top) window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer')
      else window.location.assign(result.authorizationUrl)
      setFundOpen(false)
    } catch (error) {
      setFundError(error instanceof ApiError && error.status === 400 ? 'Wallet top-ups are temporarily unavailable. Please try again later.' : getErrorMessage(error))
    } finally {
      setFundLoading(false)
    }
  }

  const runOfferAction = async (action: 'accept' | 'counter' | 'decline') => {
    if (!rideId || !driverOffer?.id || offerActionLoading) {
      setRideError(!driverOffer?.id ? 'This driver offer is missing its backend offer ID, so it cannot be changed.' : 'An offer action is already in progress.')
      return
    }
    setRideError('')
    setOfferActionLoading(true)
    try {
      if (action === 'accept') {
        await acceptDriverOffer(rideId, driverOffer.id)
        setRideStatus('accepted')
        setDriverOffer(null)
        showToast('Driver offer accepted.')
      } else if (action === 'counter') {
        const value = Number(counterAmount)
        if (!Number.isFinite(value) || value <= 0 || value % 50 !== 0) throw new Error('Enter a positive counter in increments of ₦50.')
        await counterDriverOffer(rideId, driverOffer.id, value)
        setDriverOffer(null)
        setCounterAmount('')
        setRideStatus('searching')
        showToast('Counter-offer sent. Waiting for the driver response.')
      } else {
        await declineDriverOffer(rideId, driverOffer.id)
        setDriverOffer(null)
        setCounterAmount('')
        setRideStatus('searching')
        showToast('Offer declined. Waiting for another driver.')
      }
    } catch (error) {
      setRideError(getErrorMessage(error))
    } finally {
      setOfferActionLoading(false)
    }
  }

  const acceptOffer = () => { void runOfferAction('accept') }
  const sendCounterOffer = () => { void runOfferAction('counter') }
  const skipDriver = () => { void runOfferAction('decline') }

  const updateRoute = (key: keyof ApiRoute, value: string) => setRoute((current) => ({ ...current, [key]: value }))

  return (
    <main className="min-h-[100dvh] overscroll-y-contain bg-[#f6f8f7] pb-[calc(6rem+env(safe-area-inset-bottom))] text-slate-900 md:pb-8">
      <SplashScreen />
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => changeScreen('rides')} className="flex items-center gap-2.5" aria-label="NexaGo home">
            <BrandLogo />
          </button>
          <nav className="hidden items-center gap-1 rounded-xl bg-slate-100 p-1 md:flex" aria-label="Main navigation">
            {([['rides', 'Rides', Navigation], ['flights', 'Flights', Plane], ['wallet', 'NexaPay', Wallet], ['driver', 'Drive', Car]] as const).map(([key, label, Icon]) => (
              <button key={key} type="button" onClick={() => changeScreen(key)} aria-current={screen === key ? 'page' : undefined} className={`flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition ${screen === key ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Icon size={15} aria-hidden="true" />{label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={openNotifications} className="relative grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-teal-300 hover:bg-teal-50" aria-label={session ? `Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}` : 'Sign in to view notifications'}>
              <Bell size={18} />
              {unreadNotificationCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-5 text-white">{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</span>}
            </button>
            {session ? (
              <button type="button" onClick={() => setProfileOpen(true)} className="grid size-10 place-items-center rounded-full bg-teal-100 text-sm font-bold text-teal-800 transition hover:bg-teal-200" aria-label="Open profile">{(currentUser?.passengerProfile?.fullName || currentUser?.email || 'N').charAt(0).toUpperCase()}</button>
            ) : (
              <button type="button" onClick={openAuth} className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700">Sign in</button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        {screen === 'rides' ? (
          <>
            <section className="mb-5 flex items-end justify-between gap-4 sm:mb-7">
              <div><p className="mb-2 text-[10px] font-bold tracking-[.18em] text-teal-800">NEXAGO RIDER</p><h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-3xl">{getTimeGreeting()}{firstName ? `, ${firstName}` : ''}</h1><p className="mt-1.5 text-sm text-slate-500">Where are we going today? A smoother ride starts right here.</p></div>
              <button type="button" onClick={() => setSosOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-full border border-rose-100 bg-white px-3 py-2 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50"><Siren size={15} aria-hidden="true" /> SOS<span className="hidden font-medium text-slate-500 sm:inline">· Safety centre</span></button>
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(340px,440px)_minmax(0,1fr)] lg:items-stretch">
              <div className="flex flex-col">
              {session && rideId && (rideStatus === 'searching' || rideStatus === 'accepted') && (
                <LiveTripPanel
                  rideId={rideId}
                  status={rideStatus}
                  connection={liveConnection}
                  socket={liveSocket}
                  currentUserId={session.userId}
                  fareAmount={fareAmount}
                  tierLabel={selectedCategory ? rideTiers[tierKeyForCategory(selectedCategory)].label : undefined}
                  pickupLabel={pickup}
                  dropoffLabel={dropoff}
                  hasDriverLocation={Boolean(driverLocation)}
                  onToast={showToast}
                />
              )}
              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-label="Ride booking">
                <div className="mb-5 flex items-center justify-between">
                  <div><h2 className="text-lg font-bold tracking-tight">Plan your ride</h2><p className="mt-1 text-xs text-slate-500">Choose your route and ride type.</p></div>
                  <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Navigation size={19} /></span>
                </div>

                {areas.length > 1 && <label className={`${labelClass} mb-3`}>Service area<select value={selectedAreaId} onChange={(event) => setSelectedAreaId(event.target.value)} className={`${fieldClass} h-10`}><option value="">Choose an area</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}{area.state ? `, ${area.state}` : ''}</option>)}</select></label>}
                <div className="relative grid gap-0 rounded-2xl border border-slate-200 px-3.5">
                  <span className="absolute bottom-[27px] left-[25px] top-[27px] border-l border-dashed border-slate-300" aria-hidden="true" />
                  <div className="relative flex min-h-[65px] items-center gap-3 border-b border-slate-100 pl-1 pr-9">
                    <span className="z-10 grid size-3 shrink-0 place-items-center rounded-full border-[3px] border-teal-700 bg-white" />
                    <label className="min-w-0 flex-1"><span className="block text-[9px] font-bold tracking-[.12em] text-slate-400">PICKUP</span><input aria-label="Pickup location" value={pickup} onChange={(event) => setPickup(event.target.value)} className="mt-1 w-full bg-transparent text-sm font-medium text-slate-800 outline-none" /></label>
                    <button type="button" onClick={locatePickup} disabled={gpsLoading} aria-label="Use my current location" className="grid size-9 shrink-0 place-items-center rounded-lg text-teal-800 hover:bg-teal-50 disabled:opacity-50"><MapPin size={17} /></button>
                  </div>
                  <div className="relative flex min-h-[65px] items-center gap-3 pl-1">
                    <span className="z-10 size-3 shrink-0 rounded-[3px] bg-orange-500" />
                    <label className="min-w-0 flex-1"><span className="block text-[9px] font-bold tracking-[.12em] text-slate-400">DROP-OFF</span><input aria-label="Drop-off location" readOnly value={dropoff} placeholder="Tap the map to choose" className="mt-1 w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400" /></label>
                  </div>
                  <button type="button" aria-label="Swap pickup and drop-off" onClick={() => { setPickup(dropoff); setDropoff(pickup); setRoute((current) => ({ ...current, pickupLat: current.dropoffLat, pickupLng: current.dropoffLng, dropoffLat: current.pickupLat, dropoffLng: current.pickupLng, distanceKm: '', durationMinutes: '' })); setRoutePath([]) }} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-teal-300"><ArrowDownUp size={15} /></button>
                </div>
                {gpsLoading && <p role="status" className="mt-2 text-[11px] text-teal-800">Finding your location…</p>}
                {routeLoading && <p role="status" className="mt-2 text-[11px] text-slate-500">Calculating route…</p>}
                {routeError && <p role="alert" className="mt-2 text-[11px] leading-4 text-rose-700">{routeError}</p>}
                {!routeLoading && route.distanceKm && route.durationMinutes && <p className="mt-2 text-[11px] text-slate-600"><strong className="font-semibold text-slate-800">{Number(route.distanceKm).toFixed(1)} km</strong> · about {Math.round(Number(route.durationMinutes))} min{routeEstimated && <span className="text-slate-400"> · estimated</span>}</p>}

                <TripOptions
                  signedIn={Boolean(session)}
                  mode={tripMode}
                  onModeChange={setTripMode}
                  scheduledFor={scheduledFor}
                  onScheduledForChange={setScheduledFor}
                  businessProfileId={businessProfileId}
                  onBusinessProfileChange={setBusinessProfileId}
                  stops={stops}
                  addingStop={addingStop}
                  onAddStop={() => setAddingStop((current) => !current)}
                  onRemoveStop={(index) => setStops((current) => current.filter((_, position) => position !== index))}
                />

                <details open={routeDetailsOpen} onToggle={(event) => setRouteDetailsOpen(event.currentTarget.open)} className="mt-3 rounded-xl bg-slate-50 px-3.5 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700">Advanced trip details <ChevronDown size={15} className="text-slate-400" /></summary>
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">Use the location button for pickup and tap the map to pin your destination. Distance and travel time fill in automatically.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {([['pickupLat', 'Pickup latitude'], ['pickupLng', 'Pickup longitude'], ['dropoffLat', 'Drop-off latitude'], ['dropoffLng', 'Drop-off longitude'], ['distanceKm', 'Distance (km)'], ['durationMinutes', 'Duration (min)']] as const).map(([key, label]) => <label key={key} className={labelClass}>{label}<input inputMode="decimal" value={route[key]} onChange={(event) => updateRoute(key, event.target.value)} placeholder="Awaiting route" className={`${fieldClass} h-10 px-2.5 text-xs`} /></label>)}
                  </div>
                  {catalogLoading && <p role="status" className="mt-3 text-[11px] text-slate-500">Loading vehicle and service-area catalogs…</p>}
                </details>

                <div className="mb-2 mt-5 flex items-center justify-between"><h3 className="text-xs font-bold text-slate-800">Choose your ride</h3><span className="text-[10px] text-slate-400">Tap for fare</span></div>
                {session && !catalogLoading && categories.length > 0 && (
                  <RideTierSelector
                    categories={categories}
                    selectedCategoryId={selectedCategoryId}
                    onSelect={(category) => setSelectedCategoryId(category.id)}
                    estimate={selectedCategoryId ? { categoryId: selectedCategoryId, amount: fareAmount, surge: fareSurge } : null}
                    estimating={fareLoading}
                  />
                )}
                {!session && <>
                  <RideTierSelector categories={[]} selectedCategoryId="" onSelect={() => undefined} estimate={null} estimating={false} preview onPreviewSelect={openAuth} />
                  <div className="mt-3 rounded-2xl border border-dashed border-teal-200 bg-teal-50/60 p-4 text-center"><p className="text-sm font-semibold text-slate-800">Sign in for live fares near you</p><p className="mt-1 text-xs leading-5 text-slate-500">Pick a ride type above to see what&apos;s available in your area.</p><button type="button" onClick={openAuth} className="mt-3 h-10 rounded-xl bg-teal-800 px-4 text-xs font-bold text-white hover:bg-teal-900">Sign in or create account</button></div>
                </>}
                {session && catalogLoading && <div className="grid grid-cols-2 gap-2.5" aria-hidden="true">{[0, 1].map((item) => <div key={item} className="h-[78px] animate-pulse rounded-2xl bg-slate-100" />)}</div>}
                {session && !catalogLoading && categories.length === 0 && !catalogError && <p className="mt-3 text-xs text-slate-500">No ride types are available in your area right now.</p>}
                {catalogError && <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">{catalogError}</p>}
                {rideError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{rideError}</p>}
                <button type="button" onClick={() => selectedVehicle && void openFare(selectedVehicle)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 disabled:opacity-60" disabled={rideLoading || catalogLoading || !selectedVehicle}>
                  {rideLoading ? 'Requesting ride…' : 'See fare & find driver'} <ArrowRight size={17} />
                </button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-400"><ShieldCheck size={13} className="text-teal-700" /> No charge until your trip is complete</p>
              </section>
              </div>

              <section className="relative isolate min-h-[230px] touch-pan-y overflow-hidden rounded-3xl border border-slate-200 bg-[#e9eeea] shadow-sm lg:min-h-[570px]" aria-label="Interactive ride map">
                <NexaGoMap
                  pickup={route.pickupLat && route.pickupLng ? { latitude: Number(route.pickupLat), longitude: Number(route.pickupLng) } : null}
                  dropoff={route.dropoffLat && route.dropoffLng ? { latitude: Number(route.dropoffLat), longitude: Number(route.dropoffLng) } : null}
                  stops={stops}
                  routePath={routePath}
                  driverLocation={driverLocation}
                  followDriver={rideStatus === 'accepted' && Boolean(driverLocation)}
                  onChooseDropoff={chooseDropoff}
                />
                <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-[10px] font-bold tracking-wide text-slate-700 shadow-sm sm:left-5 sm:top-5"><span className="size-2 rounded-full bg-emerald-500" /> {selectedArea ? `${selectedArea.name.toUpperCase()}${selectedArea.state ? ` · ${selectedArea.state.toUpperCase()}` : ''}` : 'SERVICE AREA'}</div>
                <div className="absolute bottom-3 left-3 z-[500] flex items-center gap-3 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-lg sm:bottom-5 sm:left-5 sm:p-4"><span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Bike size={19} /></span><span><strong className="block text-xs text-slate-800">{addingStop ? `Place stop ${stops.length + 1}` : 'Choose a pickup and destination'}</strong><span className="mt-1 block text-[10px] text-slate-500">{addingStop ? 'Tap the map to add this stop' : 'Tap map to pin your drop-off'}</span></span></div>
                <button type="button" onClick={locatePickup} disabled={gpsLoading} className="absolute right-3 top-3 z-[500] flex min-h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/95 px-3 text-xs font-semibold text-teal-800 shadow-sm disabled:opacity-60 sm:right-5 sm:top-5"><MapPin size={16} />{gpsLoading ? 'Locating…' : 'My location'}</button>
              </section>
            </div>
          </>
        ) : screen === 'driver' ? (
          <section className="mx-auto max-w-3xl">
            <button type="button" onClick={() => changeScreen('rides')} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-teal-800"><ArrowLeft size={15} /> Back to rides</button>
            <DriverMode isDriver={session?.role === 'DRIVER'} signedIn={Boolean(session)} onSignInAsDriver={openDriverAuth} onToast={showToast} />
          </section>
        ) : screen === 'flights' ? (
          <FlightsScreen onBack={() => changeScreen('rides')} onBookAirportRide={() => { changeScreen('rides'); showToast('Tap the airport on the map to set it as your drop-off.') }} />
        ) : (
          <section className="mx-auto max-w-4xl">
            <button type="button" onClick={() => changeScreen('rides')} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-teal-800"><ArrowLeft size={15} /> Back to rides</button>
            <div className="mb-5"><p className="text-[10px] font-bold tracking-[.18em] text-teal-800">NEXAPAY</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Your money, moving easy.</h1><p className="mt-2 text-sm text-slate-500">Move money, pay bills and manage your everyday balance.</p></div>
            <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#123d42] via-[#17696a] to-[#1d8580] p-5 text-white shadow-lg sm:p-7" aria-label="NexaPay balance">
              <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-teal-100/75">AVAILABLE BALANCE</p><p className="mt-2 text-sm text-white/75">NexaPay wallet</p></div><span className="grid size-11 place-items-center rounded-xl border border-white/15 bg-white/10"><Wallet size={20} /></span></div>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><strong className="text-3xl font-bold tracking-tight sm:text-4xl">{balanceLoading ? 'Loading…' : walletBalance === null ? '—' : formatNaira(walletBalance)}</strong><div className="flex gap-2"><button type="button" onClick={() => void loadWalletBalance()} disabled={balanceLoading} className="h-10 rounded-lg border border-white/25 px-3 text-xs font-semibold hover:bg-white/10 disabled:opacity-60">Refresh</button><button type="button" onClick={openFund} className="flex h-10 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-bold text-teal-900 hover:bg-teal-50"><Plus size={15} aria-hidden="true" />Add money</button></div></div>
              {walletError && <p role="alert" className="mt-4 rounded-xl bg-white/10 p-3 text-xs leading-5 text-white">{walletError}{!session && <button type="button" onClick={openAuth} className="ml-2 font-bold underline underline-offset-2">Sign in</button>}</p>}
            </section>
            {session && hasPinSet === false && <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700"><KeyRound size={18} aria-hidden="true" /></span><div><p className="text-sm font-bold text-slate-900">Create your transaction PIN</p><p className="mt-0.5 text-xs leading-5 text-slate-600">You need a PIN to buy airtime, data, or send money.</p></div></div><button type="button" onClick={openPinSetup} className="h-10 shrink-0 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-700">Create PIN</button></div>}
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <WalletActionCard icon={Smartphone} title="Buy airtime" detail="Top up any number" onClick={() => openWalletModal('airtime')} />
              <WalletActionCard icon={Wifi} title="Buy data" detail="Choose a data plan" onClick={() => openWalletModal('data')} />
              <WalletActionCard icon={ArrowDownUp} title="Send money" detail="Pay a NexaGo user" onClick={() => openWalletModal('send')} />
              <WalletActionCard icon={Landmark} title="Send to bank" detail="Transfer to a Nigerian bank" onClick={() => openWalletModal('bank')} />
              <WalletActionCard icon={Receipt} title="Pay a bill" detail="Utilities and billers" onClick={() => openWalletModal('bills')} />
            </div>
            {session && <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="recent-activity-title">
              <div className="flex items-center justify-between"><h2 id="recent-activity-title" className="text-sm font-bold text-slate-900">Recent activity</h2>{hasPinSet && <button type="button" onClick={openPinSetup} className="text-xs font-semibold text-teal-800 hover:underline">Change PIN</button>}</div>
              <TransactionHistory transactions={transactions} loading={balanceLoading} />
            </section>}
          </section>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur md:hidden" aria-label="Main navigation">
        <button type="button" onClick={() => changeScreen('rides')} aria-current={screen === 'rides' ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${screen === 'rides' ? 'text-teal-800' : 'text-slate-400'}`}><Navigation size={18} />Rides</button>
        <button type="button" onClick={() => changeScreen('flights')} aria-current={screen === 'flights' ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${screen === 'flights' ? 'text-teal-800' : 'text-slate-400'}`}><Plane size={18} />Flights</button>
        <button type="button" onClick={() => changeScreen('wallet')} aria-current={screen === 'wallet' ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${screen === 'wallet' ? 'text-teal-800' : 'text-slate-400'}`}><Wallet size={18} />NexaPay</button>
        <button type="button" onClick={() => changeScreen('driver')} aria-current={screen === 'driver' ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${screen === 'driver' ? 'text-teal-800' : 'text-slate-400'}`}><Car size={18} />Drive</button>
      </nav>

      {fareOpen && selectedVehicle && <Sheet title="Your ride fare" onClose={() => setFareOpen(false)}>
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3.5"><span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white text-teal-800 shadow-sm">{(() => { const Icon = selectedVehicle.icon; return <Icon size={19} /> })()}</span><span><strong className="block text-sm">{selectedVehicle.label}</strong><span className="mt-1 block text-[11px] text-slate-500">{pickup} → {dropoff || 'Add a drop-off'}</span></span></span><button type="button" onClick={() => setFareOpen(false)} aria-label="Close fare sheet" className="grid size-8 place-items-center rounded-full text-slate-500 hover:bg-white"><X size={17} /></button></div>
        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold tracking-[.14em] text-slate-400">BASE FARE</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{fareLoading ? '…' : fareAmount === null ? '—' : formatNaira(fareAmount)}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-800">Sauki Rate</span></div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">{fareLoading ? 'Checking current fare configuration…' : fareAmount === null ? 'A fare quote will appear after your route is pinned on the map.' : 'Live fare quote calculated from your route, service area, and selected vehicle.'}</p>
        </div>
        <div className="mt-4"><label htmlFor="offer-price" className="text-xs font-bold text-slate-700">Your offer</label><div className="mt-2 flex h-12 items-center rounded-xl border border-slate-200"><button type="button" onClick={() => setOfferAmount(String(Math.max(50, Number(offerAmount || fareAmount || 50) - 50)))} aria-label="Decrease fare by 50 naira" className="grid h-full w-12 place-items-center text-slate-600 hover:text-teal-800"><Minus size={16} /></button><span className="text-sm font-semibold text-slate-400">₦</span><input id="offer-price" type="number" min="50" step="50" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} className="h-full min-w-0 flex-1 px-2 text-center text-lg font-bold outline-none" /><button type="button" onClick={() => setOfferAmount(String(Number(offerAmount || fareAmount || 50) + 50))} aria-label="Increase fare by 50 naira" className="grid h-full w-12 place-items-center text-slate-600 hover:text-teal-800"><Plus size={16} /></button></div><p className="mt-2 text-[10px] text-slate-500">Drivers see the quoted fare. Price offers are coming soon.</p></div>
        {fareError && <div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">{fareError}{fareError.includes('Sign in') && <button type="button" onClick={openAuth} className="ml-1 font-bold underline">Sign in</button>}</div>}
        {rideError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{rideError}</p>}
        <button type="button" onClick={() => void handleFindDriver()} disabled={rideLoading || fareLoading} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">{rideLoading ? (tripMode === 'scheduled' ? 'Scheduling ride…' : 'Requesting ride…') : tripMode === 'scheduled' ? 'Schedule ride' : 'Find Driver'}<ArrowRight size={17} /></button>
        <p className="mt-3 text-center text-[10px] text-slate-400">You won&apos;t be charged until your trip is complete.</p>
      </Sheet>}

      {(walletModal === 'airtime' || walletModal === 'data' || walletModal === 'send') && <Sheet title={walletModal === 'airtime' ? 'Buy airtime' : walletModal === 'data' ? 'Buy data' : 'Send money'} onClose={closeWalletModal}>
        {walletSuccess ? <div className="py-5 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check size={24} /></span><h3 className="mt-4 text-lg font-bold text-slate-900">Request complete</h3><p className="mt-2 text-sm text-slate-500">{walletSuccess}</p>{walletError && <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-left text-xs leading-5 text-amber-900">Your transaction was submitted, but the wallet balance could not refresh. Return to NexaPay and refresh again.</p>}<button type="button" onClick={closeWalletModal} className="mt-5 h-11 w-full rounded-xl bg-slate-900 text-sm font-bold text-white">Done</button></div> : <form className="mt-4 grid gap-3.5" onSubmit={(event) => void handleWalletSubmit(event)}>
          {walletModal === 'send' ? <>
            <label className={labelClass}>Recipient phone number or tag<input required autoFocus value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="0801 234 5678" className={fieldClass} /></label>
            <label className={labelClass}>Amount in naira<input required type="number" min="50" step="1" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="₦ 0" className={fieldClass} /></label>
            <p className="-mt-1 text-[10px] leading-4 text-slate-500">The current wallet-transfer API expects a Nigerian phone number and transaction PIN; NexaGo tags are not accepted by the server yet.</p>
          </> : <>
            <label className={labelClass}>Network<select value={network} onChange={(event) => setNetwork(event.target.value as VtuNetwork)} className={fieldClass}>{networks.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className={labelClass}>Phone number<input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0801 234 5678" className={fieldClass} /></label>
            {walletModal === 'data' ? <label className={labelClass}>Data plan<select required value={planId} onChange={(event) => setPlanId(event.target.value)} className={fieldClass} disabled={bundleLoading || dataBundles.length === 0}><option value="">{bundleLoading ? 'Loading plans…' : 'Choose a data plan'}</option>{dataBundles.map((bundle) => <option key={bundle.code} value={bundle.code}>{bundle.name} · {formatNaira(bundle.priceKobo / 100)}</option>)}</select></label> : <label className={labelClass}>Amount in naira<input required type="number" min="50" step="50" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="₦ 500" className={fieldClass} /></label>}
          </>}
          <label className={labelClass}>Transaction PIN<input required type="password" inputMode="numeric" autoComplete="one-time-code" minLength={4} maxLength={6} pattern="[0-9]{4,6}" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="4–6 digit PIN" className={fieldClass} /></label>
          {walletError && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{walletError}{walletError.includes('Sign in') && <button type="button" onClick={openAuth} className="ml-1 font-bold underline">Sign in</button>}</p>}
          <button type="submit" disabled={walletLoading} className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60">{walletLoading ? 'Processing securely…' : walletModal === 'send' ? 'Review & send' : 'Confirm purchase'}<ArrowRight size={16} /></button>
          <p className="text-center text-[10px] leading-4 text-slate-400">Transactions are sent securely to NexaGo. Never share your PIN with another person.</p>
        </form>}
      </Sheet>}

      {walletModal === 'bank' && <Sheet title="Send to a bank account" onClose={closeWalletModal}>
        <NexaPayBankTransferForm onSignIn={openAuth} onComplete={() => void loadWalletBalance()} />
      </Sheet>}

      {walletModal === 'bills' && <Sheet title="Pay a bill" onClose={closeWalletModal}>
        <NexaPayBillPaymentForm onSignIn={openAuth} onComplete={() => void loadWalletBalance()} />
      </Sheet>}

      {profileOpen && (
        <Sheet title="Your profile" onClose={() => setProfileOpen(false)}>
          <Profile
            signedIn={Boolean(session)}
            user={currentUser}
            loading={!currentUser}
            onOpenWallet={() => {
              setProfileOpen(false)
              changeScreen('wallet')
            }}
            onOpenSafety={() => {
              setProfileOpen(false)
              setSosOpen(true)
            }}
            onOpenDriver={() => {
              setProfileOpen(false)
              changeScreen('driver')
            }}
            onUserUpdated={(updated) => {
              void mutateCurrentUser(updated, { revalidate: true })
              showToast('Profile updated.')
            }}
            onSignIn={() => {
              setProfileOpen(false)
              openAuth()
            }}
            onLogout={() => {
              setProfileOpen(false)
              signOut()
            }}
          />
        </Sheet>
      )}

      {pinSetupOpen && <Sheet title={hasPinSet ? 'Change transaction PIN' : 'Create transaction PIN'} onClose={() => { if (!pinSetupLoading) setPinSetupOpen(false) }}>
        <p className="mt-1 text-sm leading-6 text-slate-500">Your PIN authorizes every NexaPay payment. Choose 4 to 6 digits that are hard to guess.</p>
        <form onSubmit={(event) => void handlePinSetup(event)} className="mt-4 grid gap-3.5">
          {hasPinSet && <label className={labelClass}>Current PIN<input required type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={currentPinValue} onChange={(event) => setCurrentPinValue(event.target.value.replace(/\D/g, '').slice(0, 6))} className={fieldClass} /></label>}
          <label className={labelClass}>New PIN<input required autoFocus type="password" inputMode="numeric" autoComplete="off" minLength={4} maxLength={6} value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="4–6 digits" className={fieldClass} /></label>
          <label className={labelClass}>Confirm new PIN<input required type="password" inputMode="numeric" autoComplete="off" minLength={4} maxLength={6} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className={fieldClass} /></label>
          {pinSetupError && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{pinSetupError}</p>}
          <button type="submit" disabled={pinSetupLoading} className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white transition hover:bg-teal-900 disabled:opacity-60">{pinSetupLoading ? 'Saving securely…' : hasPinSet ? 'Change PIN' : 'Create PIN'}</button>
        </form>
      </Sheet>}

      {fundOpen && <Sheet title="Add money" onClose={() => { if (!fundLoading) setFundOpen(false) }}>
        <p className="mt-1 text-sm leading-6 text-slate-500">Top up your NexaPay wallet securely with Paystack.</p>
        <form onSubmit={(event) => void handleFund(event)} className="mt-4 grid gap-3.5">
          <fieldset>
            <legend className="text-xs font-semibold text-slate-700">Payment method</legend>
            <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
              {([['card', 'Debit card', CreditCard, 'Visa, Mastercard, Verve'], ['bank_transfer', 'Bank transfer', Landmark, 'Pay from any bank app']] as const).map(([key, label, Icon, detail]) => (
                <button key={key} type="button" role="radio" aria-checked={fundMethod === key} onClick={() => setFundMethod(key)} className="flex flex-col items-start gap-1.5 rounded-2xl border border-slate-200 p-3 text-left transition hover:border-teal-300 aria-checked:border-teal-700 aria-checked:bg-teal-50 aria-checked:ring-2 aria-checked:ring-teal-700/15">
                  <Icon size={18} className="text-teal-800" aria-hidden="true" />
                  <span className="text-sm font-bold text-slate-900">{label}</span>
                  <span className="text-[11px] text-slate-500">{detail}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className={labelClass}>Amount in naira<input required autoFocus type="number" min="100" step="50" inputMode="decimal" value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} placeholder="₦ 5,000" className={fieldClass} /></label>
          <div className="flex flex-wrap gap-2">{[1000, 2000, 5000, 10000].map((preset) => <button key={preset} type="button" onClick={() => setFundAmount(String(preset))} aria-pressed={Number(fundAmount) === preset} className={`h-9 rounded-full border px-3.5 text-xs font-semibold transition ${Number(fundAmount) === preset ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:border-teal-300'}`}>{formatNaira(preset)}</button>)}</div>
          {fundError && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{fundError}</p>}
          <button type="submit" disabled={fundLoading} className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white transition hover:bg-teal-900 disabled:opacity-60">{fundLoading ? 'Opening secure checkout…' : fundMethod === 'bank_transfer' ? 'Get transfer details' : 'Continue to card payment'}</button>
          <p className="text-center text-[10px] leading-4 text-slate-400">{fundMethod === 'bank_transfer' ? 'Paystack shows a one-time account number. Your balance updates once the transfer lands.' : 'Your balance updates as soon as Paystack confirms the payment.'}</p>
        </form>
      </Sheet>}

      {notificationsOpen && <Sheet title="Notifications" onClose={() => setNotificationsOpen(false)}>
        <p className="mt-1 text-sm text-slate-500">Ride and account updates sent to your NexaGo account.</p>
        {notificationsLoading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading notifications…</p> : notificationsError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{getErrorMessage(notificationsError)}{notificationsError instanceof ApiError && notificationsError.status === 401 && <button type="button" onClick={openAuth} className="ml-1 font-bold underline">Sign in</button>}</p> : notifications.length === 0 ? <div className="my-5 rounded-2xl bg-slate-50 px-4 py-8 text-center"><span className="mx-auto grid size-11 place-items-center rounded-full bg-white text-slate-500"><Bell size={18} /></span><p className="mt-3 text-sm font-semibold text-slate-800">You&apos;re all caught up</p><p className="mt-1 text-xs text-slate-500">New ride updates will appear here.</p></div> : <div className="mt-4 grid gap-2">{notifications.map((notification) => <article key={notification.id} className={`rounded-2xl border p-4 ${notification.readAt ? 'border-slate-200 bg-white' : 'border-teal-100 bg-teal-50/60'}`}><div className="flex items-start gap-3"><span className={`mt-1 size-2 shrink-0 rounded-full ${notification.readAt ? 'bg-slate-300' : 'bg-teal-600'}`} /><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-slate-900">{notification.title}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{notification.body}</p><p className="mt-2 text-[10px] text-slate-400">{Number.isNaN(Date.parse(notification.createdAt)) ? '' : new Date(notification.createdAt).toLocaleString()}</p></div>{!notification.readAt && <button type="button" onClick={() => void handleMarkNotificationRead(notification)} disabled={notificationUpdating === notification.id} className="shrink-0 text-[10px] font-bold text-teal-800 disabled:opacity-50">{notificationUpdating === notification.id ? 'Saving…' : 'Mark read'}</button>}</div></article>)}</div>}
      </Sheet>}

      {ratingRideId && !ratingOpen && <button type="button" onClick={() => setRatingOpen(true)} className="fixed bottom-24 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-teal-800 px-4 py-3 text-xs font-bold text-white shadow-lg md:bottom-6">Rate your completed ride</button>}
      {ratingOpen && ratingRideId && <Sheet title="Rate your trip" onClose={() => setRatingOpen(false)}>
        <p className="mt-1 text-sm leading-6 text-slate-500">Your feedback helps keep NexaGo safe and reliable. Ratings are shared with the trip service.</p>
        <form onSubmit={(event) => void handleSubmitRating(event)} className="mt-5 grid gap-4">
          <fieldset><legend className="text-xs font-semibold text-slate-700">How was your driver?</legend><div className="mt-2 flex gap-2" role="group" aria-label="Driver rating from one to five stars">{[1, 2, 3, 4, 5].map((score) => <button key={score} type="button" onClick={() => { setRatingScore(score); setRatingError(null) }} aria-label={`${score} ${score === 1 ? 'star' : 'stars'}`} aria-pressed={ratingScore === score} className="grid size-11 place-items-center rounded-xl border border-slate-200 transition hover:border-amber-300 hover:bg-amber-50 aria-pressed:border-amber-300 aria-pressed:bg-amber-50"><Star size={20} className={ratingScore >= score ? 'fill-amber-400 text-amber-500' : 'text-slate-300'} /></button>)}</div></fieldset>
          <label className={labelClass}>Comment (optional)<textarea maxLength={1000} value={ratingComment} onChange={(event) => setRatingComment(event.target.value)} rows={3} placeholder="Share what went well" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" /></label>
          {ratingError && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{ratingError}</p>}
          <button type="submit" disabled={ratingLoading || ratingScore === 0} className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">{ratingLoading ? 'Submitting rating…' : 'Submit rating'}</button>
        </form>
      </Sheet>}

      {driverOffer !== null && <Sheet title="Driver counter-offer" onClose={() => setDriverOffer(null)}>
        <div className="flex items-center gap-3 rounded-2xl bg-teal-50 p-4"><span className="grid size-12 place-items-center rounded-full bg-teal-700 text-sm font-bold text-white">{driverOffer.driverName.slice(0, 1).toUpperCase()}</span><span><strong className="block text-sm text-slate-900">{driverOffer.driverName}</strong><span className="mt-1 block text-xs text-slate-500">{driverOffer.driverRating ? `${driverOffer.driverRating.toFixed(1)} rating · ` : ''}NexaGo driver</span></span><span className="ml-auto rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-teal-800">Live offer</span></div>
        <p className="mt-5 text-sm text-slate-600">Driver counter-offered:</p><p className="mt-1 text-3xl font-bold text-slate-900">{formatNaira(driverOffer.amount)}</p><p className="mt-2 text-[11px] leading-5 text-slate-500">This offer was received from the live ride socket. Accept, counter, and decline actions are sent to the rider offer API.</p>
        {rideError && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{rideError}</p>}
        <div className="mt-5 grid gap-2.5"><button type="button" onClick={acceptOffer} disabled={offerActionLoading || !driverOffer.id} className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white hover:bg-teal-900 disabled:opacity-50">{offerActionLoading ? 'Sending…' : 'Accept fare'}</button><div className="flex gap-1.5"><label className="sr-only" htmlFor="counter-offer">Counter-offer amount</label><button type="button" aria-label="Decrease counter by 50 naira" onClick={() => setCounterAmount(String(Math.max(50, Number(counterAmount || driverOffer.amount) - 50)))} className="grid h-12 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600"><Minus size={15} /></button><input id="counter-offer" type="number" min="50" step="50" value={counterAmount} onChange={(event) => setCounterAmount(event.target.value)} placeholder="Your counter ₦" className={`${fieldClass} min-w-0 flex-1 px-2 text-center`} /><button type="button" aria-label="Increase counter by 50 naira" onClick={() => setCounterAmount(String(Number(counterAmount || driverOffer.amount) + 50))} className="grid h-12 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600"><Plus size={15} /></button><button type="button" onClick={sendCounterOffer} disabled={offerActionLoading || !driverOffer.id || !counterAmount || Number(counterAmount) % 50 !== 0} className="h-12 shrink-0 rounded-xl border border-teal-700 px-3 text-xs font-bold text-teal-800 disabled:opacity-40">{offerActionLoading ? '…' : 'Counter'}</button></div><button type="button" onClick={skipDriver} disabled={offerActionLoading || !driverOffer.id} className="h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Decline offer</button></div>
      </Sheet>}

      {rideStatus === 'accepted' && <Sheet title="Driver assigned" onClose={() => setRideStatus('idle')}><div className="py-5 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check size={24} /></span><h3 className="mt-4 text-lg font-bold">Your ride is confirmed</h3><p className="mt-2 text-sm text-slate-500">Your ride request ID is {rideId}. Live driver location updates will appear on the map.</p><button type="button" onClick={() => setRideStatus('idle')} className="mt-5 h-11 w-full rounded-xl bg-slate-900 text-sm font-bold text-white">Close</button></div></Sheet>}
      {rideStatus === 'searching' && rideId && <div role="status" aria-live="polite" className="fixed left-1/2 top-[76px] z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg"><span className="size-2 animate-pulse rounded-full bg-emerald-400" />Finding nearby drivers · {rideId.slice(0, 8)}</div>}

      {authOpen && <Sheet title="Sign in to NexaGo" onClose={() => setAuthOpen(false)}>
        <div className="mt-3 flex rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => { setAuthMode('phone'); setAuthError('') }} className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${authMode === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Phone OTP</button>
          <button type="button" onClick={() => { setAuthMode('email'); setAuthError('') }} className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${authMode === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Email & Password</button>
        </div>

        {authMode === 'phone' ? (
          <>
            <p className="mt-3 text-sm leading-6 text-slate-500">{authStep === 'phone' ? 'We’ll send a one-time code to your Nigerian phone number.' : `Enter the verification code sent to ${authPhone}.`}</p>
            <form className="mt-4 grid gap-4" onSubmit={(event) => void (authStep === 'phone' ? handleSendOtp(event) : handleVerifyOtp(event))}>
              {authStep === 'phone' ? <label className={labelClass}>Phone number<input required type="tel" autoFocus autoComplete="tel" value={authPhone} onChange={(event) => setAuthPhone(event.target.value)} placeholder="0801 234 5678" className={fieldClass} /></label> : <label className={labelClass}>Verification code<input required autoFocus inputMode="numeric" autoComplete="one-time-code" minLength={4} maxLength={8} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Enter code" className={fieldClass} /></label>}
              {authError && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{authError}</p>}
              <button disabled={authLoading} type="submit" className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white disabled:opacity-60">{authLoading ? 'Please wait…' : authStep === 'phone' ? 'Send verification code' : 'Verify & sign in'}</button>
              {authStep === 'otp' && <button type="button" onClick={() => { setAuthStep('phone'); setAuthError('') }} className="text-xs font-semibold text-teal-800">Use a different phone number</button>}
            </form>
          </>
        ) : (
          <>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>{emailMode === 'login' ? 'Sign in with your email' : 'Create a new account'}</span>
              <button type="button" onClick={() => setEmailMode(emailMode === 'login' ? 'register' : 'login')} className="text-teal-700 underline">
                {emailMode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
              </button>
            </div>
            <form className="mt-4 grid gap-4" onSubmit={(event) => void handleEmailAuth(event)}>
              <label className={labelClass}>Email address<input required type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="name@example.com" className={fieldClass} /></label>
              <label className={labelClass}>Password<input required type="password" autoComplete={emailMode === 'login' ? 'current-password' : 'new-password'} minLength={6} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 6 characters" className={fieldClass} /></label>
              {authError && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{authError}</p>}
              <button disabled={authLoading} type="submit" className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white disabled:opacity-60">
                {authLoading ? 'Please wait…' : emailMode === 'login' ? 'Sign in with Email' : 'Register Account'}
              </button>
            </form>
          </>
        )}
      </Sheet>}

      {toast && <div role="status" className="fixed bottom-24 left-1/2 z-[1500] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-center text-xs font-medium text-white shadow-xl md:bottom-6">{toast}</div>}
    </main>
  )
}

function WalletActionCard({ icon: Icon, title, detail, onClick }: { icon: typeof Smartphone; title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-[112px] flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"><span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-800"><Icon size={19} /></span><span><strong className="block text-sm text-slate-800">{title}</strong><span className="mt-1 block text-xs text-slate-500">{detail}</span></span></button>
}

function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl sm:rounded-3xl sm:p-6">
      <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={19} /></button></div>
      {children}
    </section>
  </div>
}
