import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';

interface AuthContextType {
  user: FirebaseUser | null;
  role: 'admin' | 'employee' | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<'admin' | 'employee' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        // Resolve role
        try {
          const myEmail = "rakesh.sardar.12@gmail.com";
          const isBootstrapAdmin = firebaseUser.email?.toLowerCase() === myEmail;
          
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            let currentRole = userDoc.data().role;
            
            // Self-correction for bootstrap admin
            if (isBootstrapAdmin && currentRole !== 'admin') {
              try {
                await setDoc(userDocRef, { ...userDoc.data(), role: 'admin' }, { merge: true });
                currentRole = 'admin';
                
                // Also ensure admin doc exists
                const adminDocRef = doc(db, 'admins', firebaseUser.uid);
                const adminDoc = await getDoc(adminDocRef);
                if (!adminDoc.exists()) {
                  await setDoc(adminDocRef, { role: 'admin' });
                }
              } catch (e) {
                console.error("Failed to self-correct admin role:", e);
              }
            }
            
            setRole(currentRole);
          } else {
            // New user bootstrap logic
            const newRole = isBootstrapAdmin ? 'admin' : 'employee';
            
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                name: firebaseUser.displayName || 'Unnamed User',
                email: firebaseUser.email,
                role: newRole,
                status: 'active',
                createdAt: serverTimestamp()
              });
              
              if (isBootstrapAdmin) {
                 await setDoc(doc(db, 'admins', firebaseUser.uid), { role: 'admin' });
              }
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }

            setRole(newRole);
          }
        } catch (error) {
          // If it's not the internal handleFirestoreError throw, wrap it
          if (!(error instanceof Error && error.message.includes('operationType'))) {
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          } else {
            throw error;
          }
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      role, 
      loading, 
      loginWithGoogle, 
      loginWithEmail, 
      registerWithEmail, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
