import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, UserRole } from 'src/roles/roles.decorator';
import { RolesGuard } from 'src/roles/roles.guard';
import { DiscountCodeService } from 'src/services/discount-code.service';
import { CreateDiscountCodeDto, UpdateDiscountCodeDto } from 'src/dto/discount-code.dto';

@Controller('discount-codes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.Admin)
export class DiscountCodesController {
  constructor(private readonly discountCodeService: DiscountCodeService) {}

  @Get()
  findAll() {
    return this.discountCodeService.findAll();
  }

  @Post()
  create(@Body() dto: CreateDiscountCodeDto) {
    return this.discountCodeService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDiscountCodeDto) {
    return this.discountCodeService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.discountCodeService.remove(id);
  }
}
