import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SpacesService } from '../../services/spaces.service';
import { UpdateSpaceDto } from '../../dto/update-space.dto';
import { Space } from '../../schemas/space.schema';
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles } from 'src/roles/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { CreateSpaceDto } from 'src/dto/create-space.dto';



@Controller('spaces')
export class SpacesController {
  constructor(private spacesService: SpacesService) {}

  // GET /spaces
  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin','gestore','cliente')
  async findAll(): Promise<Space[]> {
    return this.spacesService.findAll();
  }

  // GET /spaces/:id
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Space> {
    return await this.spacesService.findOne(id);
  }

  // POST /spaces
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async create(@Body() createSpaceDto: CreateSpaceDto): Promise<Space> {
    return this.spacesService.create(createSpaceDto);
  }

  // PUT /spaces/:id
  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body() updateSpaceDto: UpdateSpaceDto,
  ): Promise<Space> {
    return this.spacesService.update(id, updateSpaceDto);
  }

  // DELETE /spaces/:id
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string): Promise<{ deleted: boolean }> {
    return this.spacesService.remove(id);
  }
}
