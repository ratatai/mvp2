/**
 * Database row types for the RATATAI marketplace schema.
 *
 * Hand-written to match supabase/migrations/001_initial_schema.sql exactly.
 * They can be regenerated at any time with:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 *
 * These are transport shapes. The application never passes them around
 * directly — src/domain/listing.mapper.ts converts them into domain objects.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          phone: string | null;
          phone_is_public: boolean;
          preferred_language: string;
          city: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          phone?: string | null;
          phone_is_public?: boolean;
          preferred_language?: string;
          city?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          display_name?: string | null;
          phone?: string | null;
          phone_is_public?: boolean;
          preferred_language?: string;
          city?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          title: string;
          description: string;
          condition: string;
          price: number;
          currency: string;
          quantity: number;
          country: string;
          city: string;
          area: string | null;
          specs: Json;
          status: string;
          moderation_status: string;
          slug: string;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          title: string;
          description: string;
          condition: string;
          price: number;
          currency?: string;
          quantity: number;
          country?: string;
          city: string;
          area?: string | null;
          specs: Json;
          status?: string;
          slug: string;
        };
        Update: {
          category?: string;
          title?: string;
          description?: string;
          condition?: string;
          price?: number;
          quantity?: number;
          city?: string;
          area?: string | null;
          specs?: Json;
          status?: string;
        };
        Relationships: [];
      };
      listing_images: {
        Row: {
          id: string;
          listing_id: string;
          storage_path: string;
          public_url: string;
          position: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          storage_path: string;
          public_url: string;
          position?: number;
          is_primary?: boolean;
        };
        Update: {
          position?: number;
          is_primary?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'listing_images_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listings';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      listing_sellers: {
        Row: {
          listing_id: string | null;
          display_name: string | null;
          city: string | null;
          phone: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<never, never>;
    Enums: Record<never, never>;
  };
}

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ListingRow = Database['public']['Tables']['listings']['Row'];
export type ListingInsert = Database['public']['Tables']['listings']['Insert'];
export type ListingUpdate = Database['public']['Tables']['listings']['Update'];
export type ListingImageRow =
  Database['public']['Tables']['listing_images']['Row'];
export type ListingImageInsert =
  Database['public']['Tables']['listing_images']['Insert'];
export type ListingSellerRow =
  Database['public']['Views']['listing_sellers']['Row'];
