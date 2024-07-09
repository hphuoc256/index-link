import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export function Match(property: string, validationOptions?: ValidationOptions) {
  return (object: any, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: MatchConstraint,
    });
  };
}
@ValidatorConstraint({ name: 'Match' })
export class MatchConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as any)[relatedPropertyName];
    return value === relatedValue;
  }
}

export class AuthRegisterDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  @Length(6, 200)
  @IsString()
  //@IsUniqueEmail()
  email: string;

  @ApiProperty()
  @Length(6, 100)
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty()
  @Length(6, 100)
  @IsNotEmpty()
  @IsString()
  @Match('password', {
    message: 'confirmPassword must match password',
  })
  confirmPassword: string;

  @ApiProperty()
  @Length(1, 100)
  @IsNotEmpty()
  @IsString()
  name: string;
}
