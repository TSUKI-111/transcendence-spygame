import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { CreateRoomDto } from './create-room.dto.js';
import { plainToInstance } from 'class-transformer';

describe('CreateRoomDto', () => {
    it('should accept a valid room DTO', async () => {

        const dto = new CreateRoomDto();
        dto.name = 'Room Alpha';
        dto.max_players = 4;
        dto.is_private = false;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
    })
    it('should reject a name that is too short', async () => {
        const dto = new CreateRoomDto;
        dto.name = 'AB';

        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'name')).toBe(true);
    })
    it('should reject a name that is too long', async () => {
        const dto = new CreateRoomDto;
        dto.name = 'A'.repeat(32);

        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'name')).toBe(true);
    })
    it('should reject max_players below 3', async () => {
        const dto = new CreateRoomDto();
        dto.name = 'Room Alpha';
        dto.max_players = 2;
        dto.is_private = false;

        const errors = await validate(dto);

        expect(
            errors.some((error) => error.property === 'max_players'),
        ).toBe(true);
    })
    it('should accept max_players equal to 3', async () => {
        const dto = new CreateRoomDto();
        dto.name = 'Room Alpha';
        dto.max_players = 3;
        dto.is_private = false;

        const errors = await validate(dto);

        expect(
            errors.some((error) => error.property === 'max_players'),
        ).toBe(false);
    })
    it('should accept max_players equal to 8', async () => {
        const dto = new CreateRoomDto();
        dto.name = 'Room Alpha';
        dto.max_players = 8;
        dto.is_private = false;

        const errors = await validate(dto);

        expect(
            errors.some((error) => error.property === 'max_players'),
        ).toBe(false);
    })
    it('should reject max_players above 8', async () => {
        const dto = new CreateRoomDto();
        dto.name = 'Room Alpha';
        dto.max_players = 9;
        dto.is_private = false;

        const errors = await validate(dto);

        expect(
            errors.some((error) => error.property === 'max_players'),
        ).toBe(true);
    })
    it('should accept is_private as true', async () => {
        const dto = new CreateRoomDto();
        dto.name = 'Room Alpha';
        dto.max_players = 4;
        dto.is_private = true;

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
    })
    it('should accept is_private as false', async () => {
        const dto = new CreateRoomDto();
        dto.name = 'Room Alpha';
        dto.max_players = 4;
        dto.is_private = false;

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
    })
    it('should reject is_private as a string', async () => {
        const dto = new CreateRoomDto();
        dto.name = 'Room Alpha';
        dto.max_players = 4;
        dto.is_private = 'true' as unknown as boolean;

        const errors = await validate(dto);

        expect(
            errors.some((error) => error.property === 'is_private'),
        ).toBe(true);
    })
    it('should accept a DTO with only name provided', async () => {
        const dto = new CreateRoomDto();
        dto.name = 'Room Alpha';

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
    })
    it('should use default values for optional fields', () => {
        const dto = new CreateRoomDto();

        expect(dto.max_players).toBe(8);
        expect(dto.is_private).toBe(false);
    })
    it('should reject a name containing only whitespace', async () => {
        const dto = new CreateRoomDto();
        dto.name = '   ';

        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'name')).toBe(true);
    });
    it('should reject a name shorter than 3 characters after trim', async () => {
        const dto = plainToInstance(CreateRoomDto, {
            name: '  AB  ',
        });

        const errors = await validate(dto);

        expect(errors.some(error => error.property === 'name')).toBe(true);
    });
    it('should trim a valid room name', async () => {
        const dto = plainToInstance(CreateRoomDto, {
            name: '  Room Alpha  ',
        });

        expect(dto.name).toBe('Room Alpha');
        expect(await validate(dto)).toHaveLength(0);
    });
});