/**
 * In-memory location store
 * Stores latest location for each field officer
 * Key: user_id, Value: location data with timestamp
 */

interface LocationData {
  user_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: Date;
  last_online?: Date; // Track when user was last online
}

// In-memory store - persists for the lifetime of the server process
const locationStore = new Map<number, LocationData>();

/**
 * Update location for a user
 */
export function updateLocation(data: {
  user_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp?: string | Date;
}): void {
  const now = new Date();
  const existing = locationStore.get(data.user_id);
  
  locationStore.set(data.user_id, {
    user_id: data.user_id,
    latitude: data.latitude,
    longitude: data.longitude,
    accuracy: data.accuracy || null,
    altitude: data.altitude || null,
    speed: data.speed || null,
    heading: data.heading || null,
    timestamp: data.timestamp ? new Date(data.timestamp) : now,
    last_online: now, // Update last online time when location is received
  });
}

/**
 * Get latest location for a user
 */
export function getLocation(userId: number): LocationData | null {
  return locationStore.get(userId) || null;
}

/**
 * Get all locations
 */
export function getAllLocations(): LocationData[] {
  return Array.from(locationStore.values());
}

/**
 * Check if user is online (location update within last 5 minutes)
 */
export function isOnline(userId: number): boolean {
  const location = locationStore.get(userId);
  if (!location) return false;
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return location.timestamp >= fiveMinutesAgo;
}

/**
 * Get location history for a user (last N hours)
 * Since we're not storing history, this returns only the latest location
 */
export function getLocationHistory(userId: number, hours: number = 24): LocationData[] {
  const location = locationStore.get(userId);
  if (!location) return [];
  
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  if (location.timestamp >= cutoffTime) {
    return [location];
  }
  return [];
}

/**
 * Remove location for a user (when they log out)
 */
export function removeLocation(userId: number): void {
  locationStore.delete(userId);
}

