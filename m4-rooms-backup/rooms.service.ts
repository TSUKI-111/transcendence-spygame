import { Injectable } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { PrismaService } from './../prisma/prisma.service.js';
import { generateInviteCode, hashInviteCode } from './invite-code.js';
@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRoom(dto: CreateRoomDto, userId: number) {
    let code: string | undefined;
    let hash: string | undefined;
    if(dto.is_private === true){
      code = generateInviteCode();
      hash = hashInviteCode(code);
    }
  }
}
