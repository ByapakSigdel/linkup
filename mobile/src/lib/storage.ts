import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** zustand persist storage backed by AsyncStorage (RN equivalent of localStorage). */
export const zustandStorage = createJSONStorage(() => AsyncStorage);
