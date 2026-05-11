import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc as firestoreAddDoc, 
  serverTimestamp, 
  deleteDoc, 
  where,
  setDoc
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  signOut as authSignOut,
  getAuth
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import firebaseConfig from '../../../firebase-applet-config.json';
import { UserCircle, MapPin, CheckCircle, XCircle, Search, MoreVertical, Plus, X, Phone, Mail, Map as MapIcon, Trash2, Navigation, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MapView } from '../../components/MapView';

export default function AdminEmployees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [locationModalData, setLocationModalData] = useState<any>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Form state
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
    territory: '',
    status: 'active'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'employee'));
        const snap = await getDocs(q);
        setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Initialize a temporary app to create the user without logging out the admin
    const tempApp = initializeApp(firebaseConfig, `temp-${Date.now()}`);
    const tempAuth = getAuth(tempApp);
    
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(tempAuth, newEmployee.email, newEmployee.password);
      await updateProfile(userCredential.user, { displayName: newEmployee.name });
      const uid = userCredential.user.uid;

      // 2. Create Firestore Profile
      await setDoc(doc(db, 'users', uid), {
        name: newEmployee.name,
        email: newEmployee.email,
        role: newEmployee.role,
        territory: newEmployee.territory,
        status: newEmployee.status,
        createdAt: serverTimestamp(),
      });
      
      // 3. Cleanup temp auth
      await authSignOut(tempAuth);
      
      // Refresh list
      const q = query(collection(db, 'users'), where('role', '==', 'employee'));
      const snap = await getDocs(q);
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      setIsAddModalOpen(false);
      setNewEmployee({
        name: '',
        email: '',
        password: '',
        role: 'employee',
        territory: '',
        status: 'active'
      });
      setShowPassword(false);
    } catch (error: any) {
      alert(error.message || "Failed to create employee account");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to remove this employee?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      setEmployees(employees.filter(e => e.id !== id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'users', id), { status: newStatus });
      setEmployees(employees.map(e => e.id === id ? { ...e, status: newStatus } : e));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  const filtered = employees.filter(e => 
    (e.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (e.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workforce Management</h2>
          <p className="text-zinc-500">Add, manage and track your field employees.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      <div className="card h-full">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search employees..." 
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-none rounded-lg text-sm outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="text-sm bg-zinc-50 border-none rounded-lg font-medium px-3 py-2 outline-none">
            <option>All Territories</option>
            <option>North Zone</option>
            <option>South Zone</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50/50 text-[10px] text-zinc-400 font-bold uppercase tracking-widest border-b border-zinc-100">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Territory</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 font-bold text-sm">
                        {emp.name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-zinc-900">{emp.name}</p>
                        <p className="text-xs text-zinc-500">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{emp.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-zinc-600">{emp.territory || 'Unassigned'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      emp.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", emp.status === 'active' ? "bg-emerald-500" : "bg-red-500")} />
                      {emp.status}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleStatus(emp.id, emp.status)}
                        className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400"
                        title={emp.status === 'active' ? 'Suspend' : 'Activate'}
                      >
                        {emp.status === 'active' ? <XCircle className="w-4 h-4 text-red-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
                      </button>
                      <button 
                        onClick={() => setLocationModalData(emp)}
                        className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400"
                        title="View Home Location"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>
                      <div className="relative">
                        <button 
                          onClick={() => setActiveMenuId(activeMenuId === emp.id ? null : emp.id)}
                          className={cn(
                            "p-2 hover:bg-zinc-100 rounded-lg transition-colors",
                            activeMenuId === emp.id ? "bg-zinc-100 text-zinc-900" : "text-zinc-400"
                          )}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {activeMenuId === emp.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setActiveMenuId(null)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-100 rounded-xl shadow-xl z-20 overflow-hidden py-1">
                              <button 
                                onClick={() => navigate(`/admin/tracking?userId=${emp.id}`)}
                                className="w-full px-4 py-2 text-left text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                                View Movement Logs
                              </button>
                              <button 
                                onClick={() => {
                                  toggleStatus(emp.id, emp.status);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-xs font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                              >
                                {emp.status === 'active' ? (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 text-red-500" /> 
                                    Suspend Account
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                    Activate Account
                                  </>
                                )}
                              </button>
                              <button 
                                onClick={() => {
                                  deleteEmployee(emp.id);
                                  setActiveMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove Employee
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-black text-xl text-zinc-900">Add New Force</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <form onSubmit={handleAddEmployee} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Full Name</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium text-sm transition-all"
                    placeholder="Enter employee name"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email" 
                    required
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium text-sm transition-all"
                    placeholder="name@company.com"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Initial Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required
                      minLength={6}
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium text-sm transition-all shadow-sm"
                      placeholder="Minimum 6 characters"
                      value={newEmployee.password}
                      onChange={(e) => setNewEmployee({...newEmployee, password: e.target.value})}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Territory</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium text-sm transition-all appearance-none"
                      value={newEmployee.territory}
                      onChange={(e) => setNewEmployee({...newEmployee, territory: e.target.value})}
                    >
                      <option value="">Unassigned</option>
                      <option value="North Zone">North Zone</option>
                      <option value="South Zone">South Zone</option>
                      <option value="East Zone">East Zone</option>
                      <option value="West Zone">West Zone</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Role</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium text-sm transition-all appearance-none"
                      value={newEmployee.role}
                      onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}
                    >
                      <option value="employee">Field Agent</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-50 rounded-xl transition-colors border border-zinc-100 text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/25 hover:bg-accent/90 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Plus className="w-4 h-4" />}
                  Register Force
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {locationModalData && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-xl text-zinc-900">Residence Registry</h3>
                <p className="text-xs text-zinc-500 font-medium">Home geofence for {locationModalData.name}</p>
              </div>
              <button 
                onClick={() => setLocationModalData(null)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="h-[400px]">
              {locationModalData.homeLat ? (
                <MapView 
                  center={{ lat: locationModalData.homeLat, lng: locationModalData.homeLng }}
                  markerPosition={{ lat: locationModalData.homeLat, lng: locationModalData.homeLng }}
                  markerLabel="Encrypted Home Geofence"
                  circleRadius={50}
                  zoom={17}
                />
              ) : (
                <div className="w-full h-full bg-zinc-50 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                    <MapIcon className="w-8 h-8 text-zinc-300" />
                  </div>
                  <h4 className="font-bold text-zinc-900">No Location Registered</h4>
                  <p className="text-sm text-zinc-500 mt-2 max-w-xs">
                    This employee hasn't synced their home coordinates with the satellite registry yet.
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-zinc-50 flex items-center justify-between">
               <div className="flex items-center gap-4">
                 <div className="flex flex-col">
                   <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Longitude</span>
                   <code className="text-xs font-bold text-zinc-700">{locationModalData.homeLng || 'N/A'}</code>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Latitude</span>
                   <code className="text-xs font-bold text-zinc-700">{locationModalData.homeLat || 'N/A'}</code>
                 </div>
               </div>
               <button 
                 onClick={() => setLocationModalData(null)}
                 className="px-6 py-2 bg-zinc-900 text-white font-bold rounded-lg text-xs"
               >
                 Close Registry
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
