/**
 * Supabase Authentication Helpers
 * 
 * Phase 3: Security Integration
 * 
 * AUTH STRATEGY:
 * We use Supabase Anonymous Auth for a frictionless casual game experience.
 * Users get a persistent auth session without any signup/login flow.
 * 
 * FUTURE: Can be upgraded to email/OAuth without breaking existing code.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const AUTH_SESSION_KEY = 'mexican-dice-auth-session';

/**
 * Get the currently authenticated user
 * Returns null if no session exists
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }
    
    return user;
  } catch (err) {
    console.error('Unexpected error getting user:', err);
    return null;
  }
}

/**
 * Sign in anonymously or restore existing session
 * Creates a persistent anonymous user if none exists
 * 
 * This provides:
 * - Stable user.id for RLS and game association
 * - No friction (no email/password required)
 * - Can be upgraded to real auth later
 * 
 * @returns The authenticated user
 */
export async function signInOrCreateUser(): Promise<User> {
  try {
    // Try to get existing session first
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      console.log('✅ Existing auth session found:', session.user.id);
      return session.user;
    }

    // No existing session - create anonymous user
    console.log('🔐 Creating anonymous auth session...');
    
    const { data, error } = await supabase.auth.signInAnonymously();
    
    if (error) {
      throw new Error(`Anonymous sign-in failed: ${error.message}`);
    }
    
    if (!data.user) {
      throw new Error('No user returned from anonymous sign-in');
    }
    
    console.log('✅ Anonymous auth session created:', data.user.id);
    
    // Store session for persistence across app restarts
    if (data.session) {
      await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(data.session));
    }
    
    return data.user;
  } catch (err) {
    console.error('❌ Auth error:', err);
    throw err;
  }
}

/**
 * Initialize auth on app launch
 * Ensures user has a valid session before accessing protected features
 * 
 * Call this once on app startup or before entering online multiplayer
 */
export async function initializeAuth(): Promise<User> {
  console.log('🚀 Initializing auth...');
  
  try {
    // Try to restore session from storage
    const storedSession = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    
    if (storedSession) {
      const session = JSON.parse(storedSession);
      
      // Set session in Supabase client
      const { data, error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      
      if (!error && data.user) {
        console.log('✅ Session restored from storage:', data.user.id);
        return data.user;
      }
    }
    
    // No valid stored session - create new one
    return await signInOrCreateUser();
  } catch (err) {
    console.error('Error initializing auth:', err);
    // Fallback: create new session
    return await signInOrCreateUser();
  }
}

/**
 * Sign out (mainly for testing/dev purposes)
 * Clears both Supabase session and local storage
 */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
    console.log('✅ Signed out successfully');
  } catch (err) {
    console.error('Error signing out:', err);
  }
}

/**
 * Listen for auth state changes
 * Useful for updating UI when session expires or changes
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback(session?.user ?? null);
    }
  );
  
  return subscription;
}

/**
 * Get the current user ID (convenience helper)
 * Throws if not authenticated
 */
export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('User must be authenticated');
  }
  
  return user.id;
}

/**
 * User profile type matching public.users table
 */
export type UserProfile = {
  id: string;
  username: string;
  created_at?: string;
};

/**
 * Ensure the current authenticated user has a profile in public.users
 * 
 * This function:
 * 1. Ensures user is authenticated (creates anonymous session if needed)
 * 2. Checks if user has a row in public.users
 * 3. If no row exists, generates a friendly username and creates one
 * 4. Returns the user profile with id and username
 * 
 * @returns UserProfile with id and username
 * @throws Error if authentication or profile creation fails
 */
export async function ensureUserProfile(): Promise<UserProfile> {
  try {
    // Step 1: Ensure we have an authenticated user
    console.log('👤 Ensuring user profile...');
    const user = await initializeAuth();
    
    if (!user) {
      throw new Error('Failed to authenticate user');
    }
    
    console.log('✅ User authenticated:', user.id);
    
    // Step 2: Try to fetch existing profile from public.users
    const { data: existingProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    // Check if profile exists and has a valid username
    if (existingProfile && existingProfile.username) {
      // Check if it's an old Player-XXXX format username
      const isOldFormat = /^Player-\d{4}$/.test(existingProfile.username);
      
      if (isOldFormat) {
        console.log('🔄 Old username format detected, upgrading:', existingProfile.username);
        // Generate new Color-Animal username and update
        const colors = [
          'Red','Blue','Green','Gold','Silver','Purple','Orange','Pink','Teal','Crimson',
          'Azure','Jade','Amber','Violet','Turquoise','Charcoal','Rose','Cerulean','Indigo',
          'Cobalt','Lemon','Mint','Coral','Bronze','Ruby','Sapphire','Emerald','Magenta','Peach',
          'Olive','Navy','Lavender','Sandstone','Apricot','Smoke','Copper','Honey','Rust',
          'Frost','Ink','Sunset','Lagoon'
        ];
        
        const animals = [
          'Panda','Tiger','Eagle','Wolf','Fox','Bear','Hawk','Lion','Jaguar','Falcon','Cobra',
          'Dragon','Phoenix','Panther','Raven','Shark','Lynx','Otter','Moose','Gator','Badger',
          'Coyote','Sloth','Turtle','Raccoon','Bison','Viper','Squid','Wolverine','Hyena','Ram',
          'Mustang','Kraken','Griffin','Stingray','Seal','Ocelot','Caribou','Meerkat','Pelican',
          'Orca','Condor','Hippo','Chameleon','Mongoose','Hedgehog','Alpaca','Llama','Buffalo',
          'Ferret','Beetle','Toad','Crow','Goose','Termite','Lobster','Shrimp','Pufferfish',
          'Narwhal','Koala','Gazelle','Porcupine','Platypus','Warthog','Manta','Hammerhead'
        ];
        
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
        const newUsername = `${randomColor}-${randomAnimal}`;
        
        console.log('✨ Upgrading to:', newUsername);
        
        // Update the username in database
        const { error: updateError } = await supabase
          .from('users')
          .update({ username: newUsername })
          .eq('id', user.id);
        
        if (updateError) {
          console.error('⚠️ Failed to upgrade username:', updateError);
          // Return old username if update fails
          return {
            id: existingProfile.id,
            username: existingProfile.username,
            created_at: existingProfile.created_at,
          };
        }
        
        console.log('✅ Username upgraded successfully');
        return {
          id: existingProfile.id,
          username: newUsername,
          created_at: existingProfile.created_at,
        };
      }
      
      // Already has Color-Animal format or custom name
      console.log('✅ User profile found:', existingProfile.username);
      return {
        id: existingProfile.id,
        username: existingProfile.username,
        created_at: existingProfile.created_at,
      };
    }
    
    // Step 3: No profile exists - generate a friendly username
    console.log('📝 No profile found, creating new profile...');
    
    // Generate Color-Animal username (e.g., "Red-Panda", "Blue-Hawk")
    const colors = [
      'Red','Blue','Green','Gold','Silver','Purple','Orange','Pink','Teal','Crimson',
      'Azure','Jade','Amber','Violet','Turquoise','Charcoal','Rose','Cerulean','Indigo',
      'Cobalt','Lemon','Mint','Coral','Bronze','Ruby','Sapphire','Emerald','Magenta','Peach',
      'Olive','Navy','Lavender','Sandstone','Apricot','Smoke','Copper','Honey','Rust',
      'Frost','Ink','Sunset','Lagoon'
    ];
    
    const animals = [
      'Panda','Tiger','Eagle','Wolf','Fox','Bear','Hawk','Lion','Jaguar','Falcon','Cobra',
      'Dragon','Phoenix','Panther','Raven','Shark','Lynx','Otter','Moose','Gator','Badger',
      'Coyote','Sloth','Turtle','Raccoon','Bison','Viper','Squid','Wolverine','Hyena','Ram',
      'Mustang','Kraken','Griffin','Stingray','Seal','Ocelot','Caribou','Meerkat','Pelican',
      'Orca','Condor','Hippo','Chameleon','Mongoose','Hedgehog','Alpaca','Llama','Buffalo',
      'Ferret','Beetle','Toad','Crow','Goose','Termite','Lobster','Shrimp','Pufferfish',
      'Narwhal','Koala','Gazelle','Porcupine','Platypus','Warthog','Manta','Hammerhead'
    ];
    
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
    const generatedUsername = `${randomColor}-${randomAnimal}`;
    
    console.log('🎲 Generated username:', generatedUsername);
    
    // Step 4: Insert new profile into public.users
    const { data: newProfile, error: insertError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        username: generatedUsername,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Error creating user profile:', insertError);
      throw new Error(`Failed to create user profile: ${insertError.message}`);
    }
    
    if (!newProfile) {
      throw new Error('No data returned from profile insert');
    }
    
    console.log('✅ User profile created:', newProfile.username);
    
    return {
      id: newProfile.id,
      username: newProfile.username,
      created_at: newProfile.created_at,
    };
  } catch (err) {
    console.error('❌ Failed to ensure user profile:', err);
    
    // Provide helpful error messages
    if (err instanceof Error) {
      if (err.message.includes('RLS')) {
        throw new Error('Database access denied. Please check RLS policies.');
      }
      if (err.message.includes('authenticate')) {
        throw new Error('Authentication failed. Please check your connection.');
      }
      throw err;
    }
    
    throw new Error('Failed to load or create user profile');
  }
}
