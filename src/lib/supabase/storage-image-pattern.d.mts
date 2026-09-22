export declare const STORAGE_PUBLIC_PATHNAME: '/storage/v1/object/public/**';

export interface StorageImagePattern {
  readonly protocol: 'http' | 'https';
  readonly hostname: string;
  /** '' means the scheme's default port only. */
  readonly port: string;
  readonly pathname: typeof STORAGE_PUBLIC_PATHNAME;
}

export declare function supabaseStorageImagePattern(
  supabaseUrl: string | undefined
): StorageImagePattern | null;
