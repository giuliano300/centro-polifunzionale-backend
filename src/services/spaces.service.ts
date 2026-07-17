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
    const createdSpace = new this.spaceModel(createSpaceDto);
    return createdSpace.save();
  }

  // AGGIORNA SPAZIO ESISTENTE
  async update(id: string, updateSpaceDto: UpdateSpaceDto): Promise<Space> {
    const updatedSpace = await this.spaceModel
      .findByIdAndUpdate(id, updateSpaceDto, { new: true })
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
}
