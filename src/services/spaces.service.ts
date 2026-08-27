import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Space, SpaceDocument } from '../schemas/space.schema';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { UpdateSpaceDto } from '../dto/update-space.dto';

@Injectable()
export class SpacesService {
  constructor(
    @InjectModel(Space.name) private spaceModel: Model<SpaceDocument>,
  ) {}

  // TROVA TUTTI GLI SPAZI
  async findAll(): Promise<Space[]> {
    return this.spaceModel.find().sort({ _id: -1 }).exec();
  }

  // TROVA UNO SPAZIO PER ID
 async findOne(id: string): Promise<Space> {
    try {
        if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid ID format');
        }

        const space = await this.spaceModel.findById(id).exec();
        if (!space) {
        throw new NotFoundException(`Space #${id} not found`);
        }
        return space;
    } catch (error) {
        console.error('Error in findOne:', error);
        throw error; // rilancia per farlo gestire da Nest
    }
  }
  // CREA NUOVO SPAZIO
  async create(createSpaceDto: CreateSpaceDto): Promise<Space> {
    const createdSpace = new this.spaceModel(this.normalizeCalendarColors(createSpaceDto));
    return createdSpace.save();
  }

  // AGGIORNA SPAZIO ESISTENTE
  async update(id: string, updateSpaceDto: UpdateSpaceDto): Promise<Space> {
    const normalizedDto = this.normalizeCalendarColors(updateSpaceDto);
    const updatedSpace = await this.spaceModel
      .findByIdAndUpdate(id, { $set: normalizedDto }, { new: true, runValidators: true })
      .exec();

    if (!updatedSpace) {
      throw new NotFoundException(`Space #${id} not found`);
    }
    return updatedSpace;
  }

  // ELIMINA SPAZIO
  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.spaceModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Space #${id} not found`);
    }
    return { deleted: true };
  }

  private normalizeCalendarColors<T extends CreateSpaceDto | UpdateSpaceDto>(dto: T): T {
    const normalized = { ...dto } as T & { calendarColor?: string; sectorColors?: string[]; sectorCount?: number; sectorEnabled?: boolean };
    normalized.calendarColor = this.normalizeColor(normalized.calendarColor, '#f3f4f6');

    if (normalized.sectorEnabled) {
      const count = Math.max(Number(normalized.sectorCount || normalized.sectorColors?.length || 0), 0);
      normalized.sectorColors = Array.from({ length: count }, (_, index) => (
        this.normalizeColor(normalized.sectorColors?.[index], this.defaultSectorColor(index))
      ));
    } else if ('sectorColors' in normalized) {
      normalized.sectorColors = [];
    }

    return normalized as T;
  }

  private normalizeColor(value: unknown, fallback: string): string {
    const color = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
  }

  private defaultSectorColor(index: number): string {
    const colors = ['#f3f4f6', '#e5e7eb', '#eef2ff', '#ecfeff', '#f0fdf4', '#fff7ed'];
    return colors[index % colors.length];
  }
}
