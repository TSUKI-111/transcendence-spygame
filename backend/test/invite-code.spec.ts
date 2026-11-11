import { describe, it, expect } from "vitest";
import { hashInviteCode, generateInviteCode } from "../src/rooms/invite-code.js";


describe('invite code', () => {
    it('should generate an 8-character code', () => {
        const code = generateInviteCode();
        expect(code).toHaveLength(8);
    })
    it('should use only allowed characters', () => {
        const code = generateInviteCode();
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    })
    it('should return the same hash for the same code', () => {
        const code = generateInviteCode();
        const hash1 = hashInviteCode(code);
        const hash2 = hashInviteCode(code);

        expect(hash1).toBe(hash2);
    })
    it('should return a valid SHA-256 hexadecimal hash', () => {
        const hash = hashInviteCode('MZUMCGPE');
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })
})