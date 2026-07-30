import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CourseTagsController } from './course-tags.controller';
import { CourseTagEntity, CourseTagSchema } from 'src/schemas/course-tag.schema';
import { CourseTagService } from 'src/services/course-tag.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: CourseTagEntity.name, schema: CourseTagSchema }])],
  controllers: [CourseTagsController],
  providers: [CourseTagService],
  exports: [CourseTagService],
})
export class CourseTagsModule {}
