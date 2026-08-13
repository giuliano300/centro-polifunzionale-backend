import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim());

  app.enableCors({
    origin: allowedOrigins?.length ? allowedOrigins : true,
  });

  const config = new DocumentBuilder()
    .setTitle("NAgorà API")
    .setDescription("API per la gestione di NAgorà")
    .setVersion('1.0')
    .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header'
    },
      'access_token'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

   app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  await app.listen(port);
}
bootstrap();
