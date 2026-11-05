import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  // Not trimmed or lowercased: the email is compared exactly as typed (Q-28)
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;

  // The password rules are checked by the users seed, not here; the cap only keeps scrypt input small
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
