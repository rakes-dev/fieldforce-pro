import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, LogIn, Mail, Lock, User, AtSign, ArrowRight, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export default function Login() {
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        if (!formData.name) throw new Error("Name is required");
        await registerWithEmail(formData.email, formData.password, formData.name);
      } else {
        const identifier = formData.email.trim();
        const isMobile = !identifier.includes('@') && /^[+0-9\s-]+$/.test(identifier);
        
        let resolvedEmail = identifier;
        
        if (isMobile) {
          const q = query(
            collection(db, 'users'), 
            where('mobile', '==', identifier), 
            limit(1)
          );
          const snap = await getDocs(q);
          if (snap.empty) {
            throw new Error("No workforce profile found matching this mobile number.");
          }
          const userData = snap.docs[0].data();
          if (!userData.email) {
            throw new Error("This profile does not have a registered email mapping.");
          }
          resolvedEmail = userData.email;
        }

        await loginWithEmail(resolvedEmail, formData.password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-10 rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100"
      >
        <div className="flex flex-col items-center text-center">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-100"
          >
            <MapPin className="text-white w-8 h-8" />
          </motion.div>
          
          <h1 className="text-3xl font-bold tracking-tighter text-slate-900 mb-1">ForceTrack Pro</h1>
          <p className="text-slate-400 text-sm mb-8 font-medium">
            {isRegistering ? "Create your workforce account" : "Access your sales infrastructure"}
          </p>

          {error && (
            <div className="w-full p-4 mb-6 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <AnimatePresence mode="wait">
              {isRegistering && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-colors" />
                    <input 
                      type="text"
                      placeholder="Full Name"
                      required={isRegistering}
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative group">
              {(!formData.email.includes('@') && /^[+0-9\s-]+$/.test(formData.email) && formData.email.trim().length > 0) ? (
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-colors animate-in fade-in" />
              ) : (
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-colors animate-in fade-in" />
              )}
              <input 
                type="text"
                placeholder={isRegistering ? "Work Email" : "Work Email or Mobile Number"}
                required
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-colors" />
              <input 
                type="password"
                placeholder="Secure Password"
                required
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
            >
              {loading ? "Processing..." : (isRegistering ? "Create Account" : "Sign In")}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="w-full flex items-center gap-4 my-8">
            <div className="flex-1 h-[1px] bg-slate-100"></div>
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Or continue with</span>
            <div className="flex-1 h-[1px] bg-slate-100"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <LogIn className="w-5 h-5 text-accent" />
            Identity Provider (SSO)
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
            className="mt-8 text-sm font-bold text-accent hover:underline decoration-2 underline-offset-4"
          >
            {isRegistering ? "Already have an account? Sign in" : "New to ForceTrack? Create account"}
          </button>
          
          <p className="mt-10 text-[10px] text-slate-300 uppercase tracking-[0.2em] font-bold">
            Enterprise Grade Security
          </p>
        </div>
      </motion.div>
    </div>
  );
}
