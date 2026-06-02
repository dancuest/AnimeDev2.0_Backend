import { Controller, Get, Head, HttpCode } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

const appInfo = {
  status: 'ok',
  service: 'animedev-backend',
  name: 'AnimeDev Backend API',
  version: '0.1.0',
  message: 'AnimeDev Backend API is running correctly.',
  documentation: '/docs',
  health: '/health',
  endpoints: {
    auth: '/auth',
    users: '/users',
    anime: '/anime',
    genres: '/genres',
    recommendations: '/recommendations/adaptive',
    interactions: '/interactions',
    trivia: '/trivia',
  },
};

@ApiTags('app')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'API landing endpoint' })
  @ApiOkResponse({
    description: 'Returns basic API status and available entry points.',
  })
  getRoot() {
    return appInfo;
  }

  @Head()
  @HttpCode(200)
  headRoot() {
    return undefined;
  }
}