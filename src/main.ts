import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { RequestIdMiddleware } from './common/request-id.middleware';

function applyGlobalSwaggerBearerAuth(document: OpenAPIObject) {
  const securityRequirement = {
    'access-token': [],
  };

  document.security = [securityRequirement];

  Object.values(document.paths).forEach((pathItem) => {
    if (!pathItem) return;

    Object.values(pathItem).forEach((operation: any) => {
      if (operation && typeof operation === 'object') {
        operation.security = [securityRequirement];
      }
    });
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));

  app.enableCors({ origin: '*' });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));

  const config = new DocumentBuilder()
    .setTitle('AnimeDev Backend')
    .setDescription('API for AnimeDev mobile app')
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Pega solo el access_token devuelto por /auth/login o /auth/device. No escribas Bearer.',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  applyGlobalSwaggerBearerAuth(document);

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'AnimeDev Backend Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port, '0.0.0.0');
}

bootstrap();