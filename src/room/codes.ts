const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Room codes: 4 characters, no look-alikes (0/O, 1/I). Input is upper-cased before checking. */
export const CODE = /^[A-Z0-9]{4}$/;

export function newRoomCode(random: () => number = Math.random): string {
  return Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join("");
}
