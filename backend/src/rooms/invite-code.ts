import { createHash, randomBytes } from "node:crypto";

export function hashInviteCode(code: string): string {
    const hash = createHash('sha256').update(code).digest('hex');
    return hash;
}

export function generateInviteCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(8);

    const code = Array.from(bytes, (byte) => alphabet[byte%alphabet.length]).join('');
    return code;
}
