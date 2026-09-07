import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @MinLength(1)
  refresh_token!: string;
}
