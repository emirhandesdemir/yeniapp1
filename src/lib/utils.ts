import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const generateDmChatId = (uid1: string, uid2: string): string => {
  const ids = [uid1, uid2].sort();
  return ids.join('_');
};
