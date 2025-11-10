import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from '../firebase/config';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  function login(email, password) {
    if (!auth) {
      return Promise.reject(new Error('Firebase auth is not configured'));
    }
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    if (!auth) {
      return Promise.resolve();
    }
    return signOut(auth);
  }

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setIsAdmin(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          await user.getIdToken(true); // force refresh to pick up new custom claims
          const res = await user.getIdTokenResult();
          setIsAdmin(res.claims?.admin === true);
        } catch (_) {
          setIsAdmin(false);
        } finally {
          setLoading(false);
        }
        return;
      }
      setIsAdmin(false);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    isAdmin,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

