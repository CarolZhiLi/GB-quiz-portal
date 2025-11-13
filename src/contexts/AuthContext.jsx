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

function createRoleState(claims = {}) {
  return {
    admin: claims.admin === true,
    operational: claims.operational === true
  };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [roles, setRoles] = useState(() => createRoleState());
  const [loading, setLoading] = useState(true);

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
      setRoles(createRoleState());
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setRoles(createRoleState());
        setLoading(false);
        return;
      }
      try {
        await user.getIdToken(true); // force refresh to pick up new custom claims
        const res = await user.getIdTokenResult();
        setRoles(createRoleState(res.claims));
      } catch (_) {
        setRoles(createRoleState());
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const isAdmin = roles.admin;
  const isOperational = roles.operational;
  const canAccessPortal = isAdmin || isOperational;

  const hasRole = (role) => roles[role] === true;
  const hasAnyRole = (candidates = []) => candidates.some((role) => hasRole(role));

  const value = {
    currentUser,
    roles,
    isAdmin,
    isOperational,
    hasRole,
    hasAnyRole,
    canAccessPortal,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

