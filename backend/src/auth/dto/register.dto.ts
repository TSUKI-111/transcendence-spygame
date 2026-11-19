import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username : lettres, chiffres et underscore uniquement',
  })
  username!: string;

  @IsString()
  @Length(1, 50)
  @Matches(/\S/, {
    message: 'displayName ne doit pas contenir uniquement des espaces',
  })
  displayName!: string;

  @IsString()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(15, 128)
  password!: string;
}
