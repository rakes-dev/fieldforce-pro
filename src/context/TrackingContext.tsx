import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, updateDoc, arrayUnion, query, where, limit, orderBy, getDocs } from 'firebase/firestore';

interface TrackingContextType {
  isTracking: boolean;
  isCheckedIn: boolean;
  homeLocation: { lat: number; lng: number } | null;
  currentPosition: { lat: number; lng: number } | null;
  registerHome: (lat: number, lng: number) => Promise<void>;
  checkOut: (id?: string) => Promise<void>;
  refreshLocation: () => void;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [homeLocation, setHomeLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [manualTerminated, setManualTerminated] = useState(false);
  
  const watchId = useRef<number | null>(null);

  // Fetch home location and active attendance on load
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Get home location
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().homeLat) {
        setHomeLocation({ lat: userDoc.data().homeLat, lng: userDoc.data().homeLng });
      }

      // Check for active attendance (no checkOutTime)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const attendanceQ = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid),
        where('checkInTime', '>=', today),
        orderBy('checkInTime', 'desc'),
        limit(1)
      );
      
      try {
        const snap = await getDocs(attendanceQ);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          if (!data.checkOutTime) {
            setAttendanceId(snap.docs[0].id);
            setIsCheckedIn(true);
            setIsTracking(true);
          } else {
            // Already checked out today
            setManualTerminated(true);
            console.log("TrackingContext: Detected ended session from earlier today");
          }
        }
      } catch (error: any) {
        console.error("Failed to fetch active attendance:", error);
        if (error.message?.includes("index")) {
          console.warn("Firestore index required for attendance checking");
        }
      }
    };
    fetchData();
  }, [user]);

  // Main tracking logic
  useEffect(() => {
    if (!user) return;

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    const success = async (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      console.log(`Location update: ${lat}, ${lng} (accuracy: ${accuracy}m)`);
      setCurrentPosition({ lat, lng });

      if (homeLocation) {
        const dist = getDistance(lat, lng, homeLocation.lat, homeLocation.lng);
        
        // Reset manual termination if user returns home
        if (dist <= 50 && manualTerminated) {
          setManualTerminated(false);
          console.log("TrackingContext: Geofence re-entry detected, resetting manual termination");
        }

        if (!isCheckedIn && !attendanceId && !manualTerminated) {
          if (dist > 50) {
            // Auto Check-In
            try {
              console.log("TrackingContext: Auto check-in triggered");
              const docRef = await addDoc(collection(db, 'attendance'), {
                employeeId: user.uid,
                checkInTime: serverTimestamp(),
                checkInLat: lat,
                checkInLng: lng,
                routeData: [{ lat, lng, timestamp: Date.now() }]
              });
              setAttendanceId(docRef.id);
              setIsCheckedIn(true);
              setIsTracking(true);
            } catch (error) {
              console.error("Auto check-in failed:", error);
            }
          }
        } else if (attendanceId && isCheckedIn) {
          // Log movement if checked in
          try {
            await updateDoc(doc(db, 'attendance', attendanceId), {
              routeData: arrayUnion({ lat, lng, timestamp: Date.now() })
            });
          } catch (error) {
            console.error("Movement logging failed:", error);
          }
        }
      }
    };

    const error = (err: GeolocationPositionError) => {
      console.warn(`ERROR(${err.code}): ${err.message}`);
    };

    watchId.current = navigator.geolocation.watchPosition(success, error, options);

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [user, homeLocation, isCheckedIn, attendanceId, manualTerminated]);

  const registerHome = async (lat: number, lng: number) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        homeLat: lat,
        homeLng: lng,
        updatedAt: serverTimestamp()
      });
      setHomeLocation({ lat, lng });
    } catch (error) {
      console.error("Failed to register home:", error);
      throw error;
    }
  };

  const checkOut = async (id?: string) => {
    // Robustness check: Ensure id is a string and not an event object
    const actualId = typeof id === 'string' ? id : undefined;
    console.log("TrackingContext: checkOut called with ID:", actualId || attendanceId);
    
    try {
      const targetId = actualId || attendanceId;
      if (!targetId) {
        console.warn("TrackingContext: No target ID for checkout, attempting fallback lookup...");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const q = query(
          collection(db, 'attendance'),
          where('employeeId', '==', user?.uid),
          where('checkInTime', '>=', today),
          limit(5)
        );
        
        const snap = await getDocs(q);
        const activeDoc = snap.docs.find(d => !d.data().checkOutTime);
        
        if (activeDoc) {
          console.log("TrackingContext: Found active attendance via fallback:", activeDoc.id);
          await updateDoc(doc(db, 'attendance', activeDoc.id), {
            checkOutTime: serverTimestamp()
          });
        } else {
          console.error("TrackingContext: Fallback failed - no active doc found.");
          throw new Error("No active session found to end.");
        }
      } else {
        console.log("TrackingContext: Updating doc:", targetId);
        await updateDoc(doc(db, 'attendance', targetId), {
          checkOutTime: serverTimestamp()
        });
        console.log("TrackingContext: updateDoc successful");
      }
      
      setIsCheckedIn(false);
      setIsTracking(false);
      setAttendanceId(null);
      setManualTerminated(true);
      console.log("TrackingContext: State reset after checkout (manual termination set)");
    } catch (error: any) {
      console.error("TrackingContext: checkOut failed:", error);
      throw error;
    }
  };

  const refreshLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.warn(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <TrackingContext.Provider value={{ isTracking, isCheckedIn, homeLocation, currentPosition, registerHome, checkOut, refreshLocation }}>
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => {
  const context = useContext(TrackingContext);
  if (!context) throw new Error('useTracking must be used within TrackingProvider');
  return context;
};

// Haversine distance formula
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; 
}
