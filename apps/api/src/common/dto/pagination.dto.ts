import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsUUID() businessId?: string;
}

export function getPagination(query: PaginationQueryDto): { page: number; limit: number } {
  return { page: query.page, limit: query.pageSize ?? query.limit };
}

export type PaginatedResult<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}
