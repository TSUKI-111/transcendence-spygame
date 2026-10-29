import { ApiProperty } from "@nestjs/swagger";

export class RoomHostResponseDto{
    @ApiProperty({example: 1})
    id: number;

    @ApiProperty({example: 'Marouan'})
    displayName: string;
}