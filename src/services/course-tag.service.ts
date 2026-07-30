import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateCourseTagDto, UpdateCourseTagDto } from 'src/dto/course-tag.dto';
import { CourseTagEntity, CourseTagDocument } from 'src/schemas/course-tag.schema';

@Injectable()
export class CourseTagService {
  constructor(
    @InjectModel(CourseTagEntity.name) private tagModel: Model<CourseTagDocument>,
  ) {}

  findAll(includeInactive = false): Promise<CourseTagEntity[]> {
    const query = includeInactive ? {} : { isActive: true };
    return this.tagModel.find(query).sort({ sortOrder: 1, label: 1 }).exec();
  }

  async create(dto: CreateCourseTagDto): Promise<CourseTagEntity> {
    const normalized = this.normalizeCreate(dto);
    const existing = await this.tagModel.findOne({ value: normalized.value }).exec();
    if (existing) {
      throw new BadRequestException('Tag gia presente');
    }
    return this.tagModel.create(normalized);
  }

  async update(id: string, dto: UpdateCourseTagDto): Promise<CourseTagEntity> {
    const updated = await this.tagModel.findByIdAndUpdate(id, this.normalizeUpdate(dto), { new: true, runValidators: true }).exec();
    if (!updated) {
      throw new NotFoundException('Tag non trovato');
    }
    return updated;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const deleted = await this.tagModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Tag non trovato');
    }
    return { deleted: true };
  }

  private normalizeCreate(dto: CreateCourseTagDto): CreateCourseTagDto {
    return {
      value: String(dto.value || '').trim().toLowerCase(),
      label: String(dto.label || '').trim(),
      isActive: dto.isActive !== false,
      sortOrder: Math.max(Number(dto.sortOrder || 0), 0),
    };
  }

  private normalizeUpdate(dto: UpdateCourseTagDto): UpdateCourseTagDto {
    return {
      ...(dto.label !== undefined ? { label: String(dto.label || '').trim() } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: Math.max(Number(dto.sortOrder || 0), 0) } : {}),
    };
  }
}
