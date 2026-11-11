import { ApiProperty } from "@nestjs/swagger";

export class RoomPlayerResponseDto{
    @ApiProperty({example: 1})
    id: number;

    @ApiProperty({example: 'Yassine'})
    displayName: string;
}