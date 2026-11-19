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


const code = generateInviteCode();
const hash = hashInviteCode(code);
const hash2 = hashInviteCode(code);

console.log('code : ', code);
console.log('hash1 : ', hash);
console.log('hash2 : ', hash2);