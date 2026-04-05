export const brandAssets = {
  logo: {
    main: "https://wwyxohjnyqnegzbxtuxs.supabase.co/storage/v1/object/public/vent-guys-images/Logo_noBG.png",
    white: "https://wwyxohjnyqnegzbxtuxs.supabase.co/storage/v1/object/public/vent-guys-images/Logo_noBG.png",
    mark: "/path/to/mark-logo.png", // Example: a smaller, iconic version of the logo
  },
  mascot: {
    full: "https://wwyxohjnyqnegzbxtuxs.supabase.co/storage/v1/object/public/vent-guys-images/Mascot_noBG.png",
    waving: "https://wwyxohjnyqnegzbxtuxs.supabase.co/storage/v1/object/public/vent-guys-images/Mascot_noBG.png", // Used in hero
    icon: "/path/to/mascot-icon.png",
  },
  backgrounds: {
    hero: "https://images.unsplash.com/photo-1544458319-e9323c91d84f?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    noise: "/path/to/noise-background.png",
  },
  icons: {
    checkCircle: "/path/to/check-circle.svg",
    star: "/path/to/star.svg",
  },
  illustrations: {
    serviceAreas: "https://images.unsplash.com/photo-1582213782179-e0d53f02e943?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    airDuct: "https://images.unsplash.com/photo-1628172828456-e970a256926f?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    dryerVent: "https://images.unsplash.com/photo-1587841108298-6349d4ceb418?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  },
  placeholders: {
    hero: "https://images.unsplash.com/photo-1506748687220-b119d0cd9669?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", // Generic image for cases where primary hero fails
  },
  certifications: {
    locallyOwned: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=100&h=100", // Placeholder badge
    nadca: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=100&h=100", // Placeholder badge
    epa: "https://images.unsplash.com/photo-1532619675605-1ede6c2ed2b0?auto=format&fit=crop&q=80&w=100&h=100", // Placeholder badge
  }
};

export const brandColors = {
  primary: '#0F172A', // Slate 900
  secondary: '#F97316', // Orange 500
  accent: '#2563EB', // Blue 600
  text: {
    dark: '#1E293B', // Slate 800
    light: '#F8FAFC', // Slate 50
    muted: '#64748B', // Slate 500
  },
  feedback: {
    success: '#22C55E', // Green 500
    warning: '#FBBF24', // Amber 400
    error: '#EF4444', // Red 500
    info: '#3B82F6', // Blue 500
  },
};

export const brandTagline = "We Clear What Others Miss.";

export const getCertificationsList = () => {
  return [
    { name: 'NADCA Member', src: brandAssets.certifications.nadca },
    { name: 'EPA Certified', src: brandAssets.certifications.epa },
  ];
};