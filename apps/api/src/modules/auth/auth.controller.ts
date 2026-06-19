import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { email: string; username: string; displayName: string; password: string },
  ) {
    const result = await this.authService.register(
      body.email,
      body.username,
      body.displayName,
      body.password,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    const result = await this.authService.login(body.email, body.password);

    return {
      success: true,
      data: result,
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() body: { email: string; code: string }) {
    const result = await this.authService.verifyEmail(body.email, body.code);
    return { success: true, data: result };
  }

  @Post('verify/resend')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() body: { email: string }) {
    const result = await this.authService.resendVerification(body.email);
    return { success: true, data: result };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }) {
    const tokens = await this.authService.refreshTokens(body.refreshToken);

    return {
      success: true,
      data: tokens,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: { refreshToken: string }) {
    await this.authService.logout(body.refreshToken);

    return {
      success: true,
      data: { message: 'Logged out successfully' },
    };
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: any) {
    return {
      success: true,
      data: { user },
    };
  }
}
