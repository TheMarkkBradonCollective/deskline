import { randomBytes } from "./domain";

// PBKDF2-SHA256. 100k iterations is the maximum the Workers runtime allows.
const ITER = 100_000;
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(s.match(/../g)!.map((h) => parseInt(h, 16)));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iter = ITER): Promise<string> {
  const salt = randomBytes(16);
  return `pbkdf2$${iter}$${hex(salt)}$${hex(await derive(password, salt, iter))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterS, saltHex, hashHex] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterS || !saltHex || !hashHex) return false;
  const got = await derive(password, unhex(saltHex), Number(iterS));
  const want = unhex(hashHex);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}
