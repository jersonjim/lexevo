import { createContext, useContext, useState, ReactNode } from 'react';

type ProfileContextType = {
  avatarUrl: string | null;
  headerInitial: string;
  syncProfile: (url: string | null, initial: string) => void;
};

const ProfileContext = createContext<ProfileContextType>({
  avatarUrl: null,
  headerInitial: '?',
  syncProfile: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [headerInitial, setHeaderInitial] = useState('?');

  function syncProfile(url: string | null, initial: string) {
    setAvatarUrl(url);
    setHeaderInitial(initial);
  }

  return (
    <ProfileContext.Provider value={{ avatarUrl, headerInitial, syncProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfileContext = () => useContext(ProfileContext);
