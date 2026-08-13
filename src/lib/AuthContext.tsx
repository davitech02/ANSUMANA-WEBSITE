import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Proponent, UserRole } from '../types';
import { getStorageData, saveStorageData } from './storage';

interface AuthContextType {
  user: User | null;
  proponent: Proponent | null;
  role: UserRole;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => { success: boolean; error?: string };
  register: (fullName: string, email: string, companyName?: string) => { success: boolean; error?: string };
  logout: () => void;
  switchRole: (newRole: UserRole, targetEmail?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState(() => getStorageData());
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const data = getStorageData();
    // Default to admin user or first logged in user stored
    const savedUserId = localStorage.getItem('aec_active_user_id');
    if (savedUserId) {
      const found = data.users.find((u) => u.id === savedUserId);
      if (found) return found;
    }
    return data.users[0] || null; // Dr. Ansumana Kamara (Admin)
  });

  useEffect(() => {
    const handleUpdate = () => {
      const updatedData = getStorageData();
      setData(updatedData);
      if (currentUser) {
        const refreshed = updatedData.users.find((u) => u.id === currentUser.id);
        if (refreshed) setCurrentUser(refreshed);
      }
    };

    window.addEventListener('aec_storage_updated', handleUpdate);
    return () => window.removeEventListener('aec_storage_updated', handleUpdate);
  }, [currentUser]);

  const activeProponent: Proponent | null = React.useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.proponent_id) {
      return data.proponents.find((p) => p.id === currentUser.proponent_id) || null;
    }
    // Alternatively match by email
    return data.proponents.find((p) => p.email.toLowerCase() === currentUser.email.toLowerCase()) || null;
  }, [currentUser, data.proponents]);

  const login = (email: string) => {
    const currentData = getStorageData();
    const cleanEmail = email.trim().toLowerCase();
    let foundUser = currentData.users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!foundUser) {
      // Check if matches a proponent email and create client user on the fly if needed
      const foundProp = currentData.proponents.find((p) => p.email.toLowerCase() === cleanEmail);
      if (foundProp) {
        foundUser = {
          id: 'user-' + Math.random().toString(36).substring(2, 9),
          email: foundProp.email,
          full_name: `${foundProp.contact_person} (${foundProp.company_name})`,
          role: 'client',
          proponent_id: foundProp.id,
          created_date: new Date().toISOString(),
        };
        currentData.users.push(foundUser);
        saveStorageData(currentData);
      } else {
        return { success: false, error: 'User account not found. Please check your email or register.' };
      }
    }

    setCurrentUser(foundUser);
    localStorage.setItem('aec_active_user_id', foundUser.id);
    return { success: true };
  };

  const register = (fullName: string, email: string, companyName?: string) => {
    const currentData = getStorageData();
    const cleanEmail = email.trim().toLowerCase();

    if (currentData.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    let propId: string | undefined = undefined;
    if (companyName) {
      const newProp: Proponent = {
        id: 'prop-' + Math.random().toString(36).substring(2, 9),
        company_name: companyName,
        contact_person: fullName,
        email: cleanEmail,
        phone: '+231 088 000 000',
        whatsapp_number: '+231 077 000 000',
        project_type: 'Other',
        county: 'Montserrado',
        district: 'Paynesville',
        project_location: 'Liberia',
        project_description: 'Registered via self-service client portal',
        status: 'Active',
        created_date: new Date().toISOString(),
      };
      currentData.proponents.push(newProp);
      propId = newProp.id;
    }

    const newUser: User = {
      id: 'user-' + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      full_name: fullName,
      role: 'client',
      proponent_id: propId,
      created_date: new Date().toISOString(),
    };

    currentData.users.push(newUser);
    saveStorageData(currentData);
    setCurrentUser(newUser);
    localStorage.setItem('aec_active_user_id', newUser.id);

    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('aec_active_user_id');
  };

  const switchRole = (newRole: UserRole, targetEmail?: string) => {
    const currentData = getStorageData();
    if (newRole === 'admin') {
      const admin = currentData.users.find((u) => u.role === 'admin') || currentData.users[0];
      setCurrentUser(admin);
      localStorage.setItem('aec_active_user_id', admin.id);
    } else {
      let clientUser = targetEmail
        ? currentData.users.find((u) => u.email.toLowerCase() === targetEmail.toLowerCase())
        : currentData.users.find((u) => u.role === 'client' || u.role === 'user');

      if (!clientUser) {
        clientUser = currentData.users[1] || currentData.users[0];
      }
      setCurrentUser(clientUser);
      localStorage.setItem('aec_active_user_id', clientUser.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        proponent: activeProponent,
        role: currentUser?.role || 'user',
        isAuthenticated: !!currentUser,
        login,
        register,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
