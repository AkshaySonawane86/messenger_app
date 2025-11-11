

// src/store/useAuthStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setAuth: (token, user) => {
        console.log("✅ Auth set & persisted");
        set({ token, user });
      },
      clearAuth: () => set({ token: null, user: null }),
      updateUser: (updatedUser) =>
        set((state) => ({
          user: { ...state.user, ...updatedUser },
        })),
    }),
    {
      name: "auth-storage", // persisted in localStorage
    }
  )
);

export default useAuthStore;
