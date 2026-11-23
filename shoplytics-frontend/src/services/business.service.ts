import type { Business, Category, Member, Role } from '@/types';
import { del, get, post, put } from './api';

export interface BusinessInput {
  name: string; category: string; description?: string; currency?: string; timezone?: string; website?: string; logo?: string;
  settings?: { lowStockThreshold?: number };
}
export const businessService = {
  list: (search?: string) => get<Business[]>('/businesses', { search }),
  get: (id: string) => get<Business>(`/businesses/${id}`),
  create: (d: BusinessInput) => post<Business>('/businesses', d),
  update: (id: string, d: Partial<BusinessInput>) => put<Business>(`/businesses/${id}`, d),
  remove: (id: string) => del(`/businesses/${id}`),
  setDefault: (id: string) => put(`/businesses/${id}/default`),
  members: {
    list: (id: string) => get<Member[]>(`/businesses/${id}/members`),
    add: (id: string, email: string, role: Exclude<Role, 'OWNER'>) => post<Member>(`/businesses/${id}/members`, { email, role }),
    setRole: (id: string, userId: string, role: Exclude<Role, 'OWNER'>) => put<Member>(`/businesses/${id}/members/${userId}`, { role }),
    remove: (id: string, userId: string) => del(`/businesses/${id}/members/${userId}`),
  },
  categories: {
    list: (id: string) => get<Category[]>(`/businesses/${id}/categories`),
    create: (id: string, d: { name: string; description?: string }) => post<Category>(`/businesses/${id}/categories`, d),
    update: (id: string, cid: string, d: { name?: string; description?: string }) => put<Category>(`/businesses/${id}/categories/${cid}`, d),
    remove: (id: string, cid: string) => del(`/businesses/${id}/categories/${cid}`),
  },
};
