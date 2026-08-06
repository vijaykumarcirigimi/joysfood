import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * Zero-config local photos: drop files into `public/dishes/` named after the
 * dish (`paneer-tikka.jpg`) and they appear automatically. `public/hero.jpg`
 * replaces the hero artwork the same way.
 *
 * The directory is read once at module load — that is build time for our
 * statically rendered pages. A `image_url` set in Supabase always wins over
 * this, and that is the path to use in production (Phase 2 uploads to Supabase
 * Storage), because `public/` is not guaranteed to be on the filesystem during
 * serverless revalidation. Missing directory simply means no local photos.
 */

const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

function readDir(relative: string): string[] {
  try {
    return readdirSync(path.join(process.cwd(), "public", relative));
  } catch {
    return [];
  }
}

const dishFiles = readDir("dishes");
const rootFiles = readDir("");

export function slugifyDish(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findIn(files: string[], base: string): string | null {
  const match = files.find((file) =>
    PHOTO_EXTENSIONS.some(
      (ext) => file.toLowerCase() === `${base}${ext}`,
    ),
  );
  return match ?? null;
}

export function resolveDishPhoto(name: string): string | null {
  const file = findIn(dishFiles, slugifyDish(name));
  return file ? `/dishes/${file}` : null;
}

export function resolveHeroPhoto(): string | null {
  const file = findIn(rootFiles, "hero");
  return file ? `/${file}` : null;
}
