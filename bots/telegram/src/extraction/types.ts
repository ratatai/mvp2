/**
 * What a vision model is asked to return for a set of tyre photos.
 *
 * The model reports raw readings ("205/55 R16", "91V", "DOT EX2B 4521") with a
 * confidence and the place on the photo it read them from. Turning readings
 * into listing fields is done afterwards by deterministic code
 * (normalize.ts), so a model mistake can never smuggle an invalid value past
 * the site's schema.
 */

export type Confidence = 'high' | 'low';

export interface Reading<T> {
  readonly value: T | null;
  readonly confidence: Confidence;
  /** Short note on where/how it was read, e.g. "printed on sidewall". */
  readonly evidence?: string;
}

export interface PhotoReadings {
  /** False when the photos do not show tyres at all. */
  readonly is_tyre_photo: boolean;
  /** True when the photos clearly show different tyre models/sizes mixed. */
  readonly mixed_tyres?: boolean;
  /** How many separate tyres are visible across all photos (may be fewer than sold). */
  readonly tyres_visible?: number | null;
  readonly brand: Reading<string>;
  readonly model: Reading<string>;
  /** Size exactly as printed, e.g. "205/55 R16". */
  readonly size: Reading<string>;
  /** Load + speed index as printed, e.g. "91V". */
  readonly service_description: Reading<string>;
  readonly season: Reading<'summer' | 'winter' | 'all_season'>;
  /** Full DOT marking as printed, e.g. "DOT EX2B 4521". */
  readonly dot: Reading<string>;
  readonly xl: Reading<boolean>;
  readonly run_flat: Reading<boolean>;
  readonly studded: Reading<boolean>;
  /** Only when a tread gauge reading is visible on a photo. */
  readonly tread_depth: Reading<number>;
  readonly condition: Reading<'new' | 'used'>;
  /** Visible damage: cuts, bulges, patches, cracks. */
  readonly defects: Reading<string>;
}

export interface VisionImage {
  readonly mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly base64: string;
}

export interface VisionProvider {
  readonly name: string;
  readPhotos(images: readonly VisionImage[]): Promise<PhotoReadings>;
}
