import crypto from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`scrypt$${salt}$${derivedKey.toString("hex")}`);
    });
  });
}

export function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const [, salt, key] = String(storedHash).split("$");
    if (!salt || !key) return resolve(false);
    crypto.scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) return reject(error);
      const expected = Buffer.from(key, "hex");
      resolve(expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey));
    });
  });
}
