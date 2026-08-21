import { Controller, Get, Head, HttpCode } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
// Este controlador expone rutas básicas para comprobar que la API responde correctamente y para dar un primer punto de entrada al sistema.


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
  // Este endpoint sirve como puerta de entrada al backend.
  // Siempre que lo reviso, me ayuda a recordar qué rutas quedan expuestas.
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