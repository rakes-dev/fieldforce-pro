import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  User, 
  Phone, 
  Mail, 
  Shield, 
  Save, 
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  Edit2,
  X,
  Navigation,
  RefreshCw
} from 'lucide-react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { cn } from '../../lib/utils';
import { useTracking } from '../../context/TrackingContext';
import { collection, query, where, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { MapView } from '../../components/MapView';

export default function Profile() {
  const { user, logout, role } = useAuth();
  const { checkOut } = useTracking();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [attendance, setAttendance] = useState<any>(null);
  const [isEndingSession, setIsEndingSession] = useState(false);

  // Modal States
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isGeoModalOpen, setIsGeoModalOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [currentPos, setCurrentPos] = useState<{lat: number, lng: number} | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [passSaving, setPassSaving] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile(data);
          setFormData({
            name: data.name || user.displayName || '',
            mobile: data.mobile || '',
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();

    let unsubscribeAttendance: () => void;
    if (role === 'employee') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const attendanceQ = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid),
        where('checkInTime', '>=', today),
        orderBy('checkInTime', 'desc'),
        limit(1)
      );

      unsubscribeAttendance = onSnapshot(attendanceQ, (snap) => {
        if (!snap.empty) {
          setAttendance({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          setAttendance(null);
        }
      }, (error) => {
        console.error("Attendance snapshot error:", error);
      });
    }

    return () => {
      if (unsubscribeAttendance) unsubscribeAttendance();
    };
  }, [user, role]);

  const handleEndSession = async () => {
    if (!attendance?.id) return;
    setIsEndingSession(true);
    try {
      await checkOut(attendance.id);
    } catch (error: any) {
      alert("Failed to end session: " + (error.message || "Unknown error"));
    } finally {
      setIsEndingSession(false);
    }
  };

  useEffect(() => {
    if (isGeoModalOpen) {
      if (profile?.homeLat) {
        setCurrentPos({ lat: profile.homeLat, lng: profile.homeLng });
      } else {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setIsLocating(false);
          },
          (err) => {
            console.error("Geolocation error:", err);
            setIsLocating(false);
          },
          { enableHighAccuracy: true }
        );
      }
    }
  }, [isGeoModalOpen, profile]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);
    setSuccess(false);
    
    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        name: formData.name,
        mobile: formData.mobile,
        updatedAt: serverTimestamp()
      });
      setProfile({ ...profile, name: formData.name, mobile: formData.mobile });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsDetailsModalOpen(false);
      }, 1500);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSetHome = async () => {
    if (!user) return;
    setIsLocating(true);
    
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const docRef = doc(db, 'users', user.uid);
          await updateDoc(docRef, {
            homeLat: pos.coords.latitude,
            homeLng: pos.coords.longitude,
            updatedAt: serverTimestamp()
          });
          setProfile({ ...profile, homeLat: pos.coords.latitude, homeLng: pos.coords.longitude });
          setIsGeoModalOpen(false);
          alert("Home location registered successfully!");
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        alert("Failed to get location: " + err.message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPassError(null);
    setPassSuccess(false);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPassError("New passwords do not match");
      return;
    }

    setPassSaving(true);
    try {
      // Re-authenticate if necessary (standard best practice)
      if (user.email) {
        const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, passwordData.newPassword);
        setPassSuccess(true);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          setPassSuccess(false);
          setIsSecurityModalOpen(false);
        }, 1500);
      }
    } catch (error: any) {
      setPassError(error.message || "Failed to update password. Ensure current password is correct.");
    } finally {
      setPassSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Profile Settings</h2>
        <p className="text-slate-500 font-medium">Manage your personal information and system role.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column: User Info & Actions */}
        <div className="space-y-6">
          <div className="card p-8 flex flex-col items-center text-center shadow-sm">
            <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-md flex items-center justify-center text-3xl font-bold text-slate-400 mb-4 overflow-hidden">
               {user?.photoURL ? <img src={user.photoURL} alt="" /> : profile?.name?.[0] || user?.displayName?.[0] || 'U'}
            </div>
            <h3 className="text-xl font-bold text-slate-900">{profile?.name || user?.displayName}</h3>
            <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {user?.email}
            </p>
            
            <div className={cn(
              "mt-6 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2",
              role === 'admin' ? "bg-accent/10 text-accent" : "bg-emerald-50 text-emerald-600"
            )}>
              <Shield className="w-3 h-3" />
              {role} Account
            </div>
          </div>

          {/* Attendance Status - Moved from Dashboard */}
          {role === 'employee' && (
            <div className={cn(
              "card p-6 shadow-sm border transition-all",
              attendance ? (attendance.checkOutTime ? "bg-slate-50 border-slate-200" : "bg-emerald-50 border-emerald-100") : "bg-white border-slate-200"
            )}>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shadow-sm",
                  attendance ? (attendance.checkOutTime ? "bg-slate-300 text-slate-500" : "bg-emerald-500 text-white") : "bg-amber-100 text-amber-600"
                )}>
                  {attendance && !attendance.checkOutTime ? <Navigation className="w-5 h-5 animate-pulse" /> : <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 tracking-tight">Daily Session</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance Status</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-500">Status</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    attendance ? (attendance.checkOutTime ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700") : "bg-amber-100 text-amber-700"
                  )}>
                    {attendance ? (attendance.checkOutTime ? 'Completed' : 'Active Now') : 'Not Started'}
                  </span>
                </div>

                {attendance && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-bold uppercase">Check-in</span>
                      <span className="text-slate-700 font-medium">
                        {new Date(attendance.checkInTime?.toDate ? attendance.checkInTime.toDate() : attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {attendance.checkOutTime && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-bold uppercase">Check-out</span>
                        <span className="text-slate-700 font-medium">
                          {new Date(attendance.checkOutTime?.toDate ? attendance.checkOutTime.toDate() : attendance.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {!attendance && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 font-medium leading-relaxed">
                    System will automatically log your attendance when you leave your registered Geofence.
                  </p>
                )}

                {attendance && !attendance.checkOutTime && (
                  <button 
                    onClick={handleEndSession}
                    disabled={isEndingSession}
                    className="w-full mt-2 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isEndingSession ? <RefreshCw className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                    End Daily Session
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="card p-6 divide-y divide-slate-100">
             <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account Status</span>
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                   <CheckCircle2 className="w-3 h-3" />
                   Active
                </span>
             </div>
             <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Member Since</span>
                <span className="text-xs font-bold text-slate-700">
                   {profile?.createdAt 
                     ? (profile.createdAt.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt)).toLocaleDateString() 
                     : 'N/A'}
                </span>
             </div>
          </div>

          <button
            onClick={() => logout()}
            className="w-full card p-4 flex items-center justify-center gap-2 text-red-600 font-bold hover:bg-red-50 transition-colors border-red-100"
          >
            <LogOut className="w-4 h-4" />
            Sign Out from Session
          </button>
        </div>

        {/* Right Column: Settings Sections */}
        <div className="md:col-span-2 space-y-6">
          <div className="card p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
              <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-accent" />
                Personal Details
              </h4>
              <button 
                onClick={() => setIsDetailsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg transition-colors border border-slate-200"
              >
                <Edit2 className="w-3 h-3" />
                Edit Info
              </button>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Display Name</p>
                <p className="font-bold text-slate-900 text-lg">{profile?.name || user?.displayName || 'Not Set'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Number</p>
                <p className="font-bold text-slate-900 text-lg">{profile?.mobile || 'Not Set'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                <p className="font-bold text-slate-600 text-sm">{user?.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Region / Territory</p>
                <p className="font-bold text-slate-600 text-sm">{profile?.territory || 'Global Execution'}</p>
              </div>
            </div>
          </div>

          <div className="card p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
              <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent" />
                Security & Credentials
              </h4>
              <button 
                onClick={() => setIsSecurityModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <Lock className="w-3 h-3" />
                Change Password
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Multi-Factor Authentication</p>
                  <p className="text-xs text-slate-500 font-medium">Extra layer of security for your fieldwork records.</p>
                </div>
                <div className="ml-auto">
                   <div className="w-8 h-4 bg-slate-200 rounded-full relative">
                      <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full" />
                   </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Last password change: {user?.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleDateString() : 'Unknown'}</p>
            </div>
          </div>

          {role === 'employee' && (
             <div className="card p-8 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <MapPin className="w-32 h-32 rotate-12" />
                </div>
                <div className="flex items-center justify-between mb-2 relative z-10">
                  <h4 className="text-lg font-bold">Tracking Information</h4>
                  <button 
                    onClick={() => setIsGeoModalOpen(true)}
                    className="px-3 py-1.5 bg-white text-black border border-white/20 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                  >
                    <MapPin className="w-3 h-3" />
                    Set Home
                  </button>
                </div>
                <p className="text-sm text-slate-400 mb-6 relative z-10 max-w-md">
                   Your profile is linked to the ForceTrack geofencing system. {profile?.homeLat ? `Home base currently set at ${profile.homeLat.toFixed(4)}, ${profile.homeLng.toFixed(4)}.` : 'No home geofence registered yet.'}
                </p>
                <div className="flex flex-wrap gap-4 relative z-10">
                   <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-xs font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      HI-ACC GPS ACTIVE
                   </div>
                   <div className={cn(
                     "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono",
                     profile?.homeLat ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                   )}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      {profile?.homeLat ? "GEOFENCE ARMED" : "GEOFENCE INACTIVE"}
                   </div>
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Personal Details Modal */}
      {isDetailsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-xl text-slate-900 tracking-tight">Edit Identity</h3>
              <button 
                onClick={() => setIsDetailsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Display Name</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-bold transition-all"
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile Connection</label>
                  <input 
                    type="tel" 
                    value={formData.mobile}
                    onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-bold transition-all"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
                >
                  Discard
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-2 py-3 bg-accent text-white rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Save className={cn("w-4 h-4", saving && "animate-spin")} />
                  {saving ? 'Saving...' : 'Confirm Update'}
                </button>
              </div>
              {success && (
                <p className="text-center text-xs font-bold text-emerald-600 animate-pulse">Identity sync successful</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Security Modal */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-xl text-slate-900 tracking-tight">Access Control</h3>
              <button 
                onClick={() => setIsSecurityModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-8 space-y-6">
              {passError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-[10px] font-black uppercase rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {passError}
                </div>
              )}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Access Key</label>
                  <input 
                    type="password" 
                    required
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-bold transition-all"
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Credentials</label>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-bold transition-all mb-2"
                    placeholder="Min 6 characters"
                  />
                  <input 
                    type="password" 
                    required
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-bold transition-all"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsSecurityModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={passSaving}
                  className="flex-2 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Lock className={cn("w-4 h-4", passSaving && "animate-spin")} />
                  {passSaving ? 'Rotating Keys...' : 'Update Password'}
                </button>
              </div>
              {passSuccess && (
                <p className="text-center text-xs font-bold text-emerald-600 animate-pulse">Security credentials synchronized</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Geofence Registration Modal */}
      {isGeoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-xl text-slate-900 tracking-tight">Geofence Registry</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Satellite-Verified Home Base</p>
              </div>
              <button 
                onClick={() => setIsGeoModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex flex-col">
              <div className="h-[300px] relative bg-slate-100">
                {currentPos ? (
                  <MapView 
                    center={currentPos}
                    markerPosition={currentPos}
                    markerLabel={profile?.homeLat ? "Registered Home Base" : "Detected Location"}
                    circleRadius={50}
                    zoom={17}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest">Pinpointing Location...</p>
                  </div>
                )}
                
                {profile?.homeLat && (
                  <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    Registry Locked
                  </div>
                )}
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900">
                    {profile?.homeLat ? "Home Base Registered" : "Establish Home Base"}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {profile?.homeLat 
                      ? "Your secure geofence is active. This location is used to automate your daily attendance logs based on departure and return cycles."
                      : "Stand at your primary residence check-point. This registry allows the system to automatically trigger your check-in when you begin your morning route."}
                  </p>
                </div>
                
                <div className="flex flex-col gap-3">
                  {!profile?.homeLat ? (
                    <button 
                      onClick={handleSetHome}
                      disabled={isLocating || !currentPos}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2 px-6"
                    >
                      {isLocating ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Acquiring Satellite Signal...
                        </>
                      ) : (
                        <>
                          <Navigation className="w-5 h-5" />
                          Calibrate & Lock Home Location
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coordinates</span>
                        <code className="text-xs font-bold text-slate-700">{profile.homeLat.toFixed(6)}, {profile.homeLng.toFixed(6)}</code>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-600">
                        <Shield className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Verified</span>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => setIsGeoModalOpen(false)}
                    className="w-full py-3 text-slate-400 text-xs font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                  >
                    Close Registry
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
