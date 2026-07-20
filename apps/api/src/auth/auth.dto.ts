import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  organizerName?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class CreateUserDto extends RegisterDto {
  @IsIn(["ADMIN", "ORGANIZER"])
  role!: "ADMIN" | "ORGANIZER";
}

export class ForgotPasswordDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(32, { message: "Token nije valjan." })
  token!: string;

  @IsString()
  @MinLength(10, { message: "Lozinka mora imati najmanje 10 znakova." })
  @MaxLength(128, { message: "Lozinka je predugačka." })
  newPassword!: string;
}
