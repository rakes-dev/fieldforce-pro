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
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  signOut as authSignOut,
  getAuth
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirebaseConfig } from '../../lib/firebase';
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [locationModalData, setLocationModalData] = useState<any>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Form state
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    password: '',
    mobile: '',
    role: 'employee',
    territory: '',
    status: 'active'
  });

  const [editForm, setEditForm] = useState({
    name: '',
    mobile: '',
    territory: '',
    role: '',
    status: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Real-time listener for all users (admins and employees)
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Initialize a temporary app to create the user without logging out the admin
    const tempApp = initializeApp(getFirebaseConfig(), `temp-${Date.now()}`);
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
        mobile: newEmployee.mobile || '',
        role: newEmployee.role,
        territory: newEmployee.territory,
        status: newEmployee.status,
        createdAt: serverTimestamp(),
      });

      // 3. If admin, add to admins collection for security rules
      if (newEmployee.role === 'admin') {
        await setDoc(doc(db, 'admins', uid), { role: 'admin' });
      }
      
      // 4. Cleanup temp auth
      await authSignOut(tempAuth);
      
      setIsAddModalOpen(false);
      setNewEmployee({
        name: '',
        email: '',
        password: '',
        mobile: '',
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

  const handleEditClick = (emp: any) => {
    setEditingEmployee(emp);
    setEditForm({
      name: emp.name || '',
      mobile: emp.mobile || '',
      territory: emp.territory || '',
      role: emp.role || 'employee',
      status: emp.status || 'active'
    });
    setIsEditModalOpen(true);
    setActiveMenuId(null);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'users', editingEmployee.id), {
        name: editForm.name,
        mobile: editForm.mobile || '',
        territory: editForm.territory,
        role: editForm.role,
        status: editForm.status
      });

      // Handle admin collection sync
      const adminDocRef = doc(db, 'admins', editingEmployee.id);
      if (editForm.role === 'admin') {
        await setDoc(adminDocRef, { role: 'admin' });
      } else {
        // If they were previously an admin and are now downgraded
        try {
          await deleteDoc(adminDocRef);
        } catch (e) {
          // Might not exist or permission denied if they weren't an admin
        }
      }
      
      setEmployees(employees.map(emp => 
        emp.id === editingEmployee.id ? { ...emp, ...editForm } : emp
      ));
      
      setIsEditModalOpen(false);
      setEditingEmployee(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${editingEmployee.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = employees.filter(e => 
    e.role === 'employee' &&
    ((e.name || '').toLowerCase().includes(search.toLowerCase()) || 
     (e.email || '').toLowerCase().includes(search.toLowerCase()))
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
                        <p className="text-xs text-zinc-500">
                          {emp.email} {emp.mobile && <span className="text-slate-400 font-medium">• {emp.mobile}</span>}
                        </p>
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
                                onClick={() => handleEditClick(emp)}
                                className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <UserCircle className="w-3.5 h-3.5" />
                                Edit Details
                              </button>
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

      {/* Edit Employee Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <h3 className="font-black text-xl text-zinc-900">Modify Force Details</h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateEmployee} className="flex-1 overflow-y-auto p-6 space-y-6 pb-40">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Full Name</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium text-sm transition-all"
                    placeholder="Enter employee name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2 opacity-50">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Email Address (Read Only)</label>
                  <input 
                    type="email" 
                    disabled
                    className="w-full px-4 py-2.5 bg-zinc-100 border border-zinc-100 rounded-xl outline-none font-medium text-sm"
                    value={editingEmployee?.email}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Mobile Number</label>
                  <input 
                    type="tel" 
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium text-sm transition-all"
                    placeholder="e.g. 9876543210"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({...editForm, mobile: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                   <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employee Status</label>
                    <div className="flex bg-zinc-50 p-1 rounded-xl border border-zinc-100">
                      {['active', 'suspended'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setEditForm({...editForm, status})}
                          className={cn(
                            "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                            editForm.status === status 
                              ? "bg-white shadow-sm text-zinc-900" 
                              : "text-zinc-400 hover:text-zinc-500"
                          )}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Territory</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium text-sm transition-all appearance-none"
                      value={editForm.territory}
                      onChange={(e) => setEditForm({...editForm, territory: e.target.value})}
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
                      value={editForm.role}
                      onChange={(e) => setEditForm({...editForm, role: e.target.value})}
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
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-50 rounded-xl transition-colors border border-zinc-100 text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-zinc-900 text-white font-bold rounded-xl shadow-lg shadow-zinc-900/25 hover:bg-zinc-800 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <CheckCircle className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
              <h3 className="font-black text-xl text-zinc-900">Add New Force</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <form onSubmit={handleAddEmployee} className="flex-1 overflow-y-auto p-6 space-y-6 pb-40">
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
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Mobile Number</label>
                  <input 
                    type="tel" 
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium text-sm transition-all"
                    placeholder="e.g. 9876543210"
                    value={newEmployee.mobile}
                    onChange={(e) => setNewEmployee({...newEmployee, mobile: e.target.value})}
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
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
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
            
            <div className="flex-1 overflow-y-auto pb-40">
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
