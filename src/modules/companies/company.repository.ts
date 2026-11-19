import { Injectable } from '@nestjs/common';
import { Company, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByOwnerId(ownerId: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { ownerId } });
  }

  findById(id: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { id } });
  }

  create(ownerId: string, dto: CreateCompanyDto): Promise<Company> {
    return this.prisma.company.create({
      data: {
        ownerId,
        name: dto.name.trim(),
        city: dto.city.trim(),
        address: dto.address.trim(),
        description: dto.description?.trim() ?? null,
      },
    });
  }

  update(companyId: string, dto: UpdateCompanyDto): Promise<Company> {
    const data: Prisma.CompanyUpdateInput = {
      name: dto.name?.trim(),
      city: dto.city?.trim(),
      address: dto.address?.trim(),
      description: dto.description === undefined ? undefined : dto.description?.trim() || null,
    };

    return this.prisma.company.update({ where: { id: companyId }, data });
  }
}
