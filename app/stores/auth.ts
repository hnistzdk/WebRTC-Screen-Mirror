import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
	id: string;
	setId: (id: string) => void;
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			id: "",
			setId: (id) => set({ id }),
		}),
		{
			name: "auth",
		},
	),
);
