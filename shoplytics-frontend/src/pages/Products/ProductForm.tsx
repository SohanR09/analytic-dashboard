import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, Field, Modal, Spinner } from '@/components/common/ui';
import { useBusiness } from '@/hooks/useBusiness';
import { useFetch } from '@/hooks/useFetch';
import { businessService } from '@/services/business.service';
import { productService } from '@/services/resources.service';
import type { Product } from '@/types';
import { errorMessage } from '@/utils/format';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  sku: z.string().trim().min(1, 'SKU is required').max(64),
  categoryId: z.string().optional(),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number({ invalid_type_error: 'Enter a price' }).min(0, 'Must be 0 or more'),
  costPrice: z.coerce.number({ invalid_type_error: 'Enter a cost' }).min(0, 'Must be 0 or more'),
  stockQuantity: z.coerce.number().int('Whole units only').min(0).optional(),
  minimumStockLevel: z.coerce.number().int('Whole units only').min(0).optional(),
  image: z.string().trim().url('Enter a full image URL').or(z.literal('')).optional(),
});
type Form = z.infer<typeof schema>;

export function ProductModal({ open, product, onClose, onSaved }: { open: boolean; product?: Product; onClose: () => void; onSaved: (p: Product) => void }) {
  const { id } = useBusiness();
  const cats = useFetch(() => businessService.categories.list(id), [id], open);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (!open) return;
    setError(null);
    reset(product
      ? { name: product.name, sku: product.sku, categoryId: product.categoryId ?? '', description: product.description ?? '', price: product.price, costPrice: product.costPrice, minimumStockLevel: product.minimumStockLevel, image: product.image ?? '' }
      : { name: '', sku: '', categoryId: '', description: '', price: 0, costPrice: 0, stockQuantity: 0, image: '' });
  }, [open, product, reset]);
  const submit = handleSubmit(async (v) => {
    setError(null);
    const body: Record<string, unknown> = { name: v.name, sku: v.sku, description: v.description || undefined, categoryId: v.categoryId || null, price: v.price, costPrice: v.costPrice, image: v.image || undefined, minimumStockLevel: v.minimumStockLevel };
    if (!product) body.stockQuantity = v.stockQuantity ?? 0;
    try { onSaved(product ? await productService.update(id, product.id, body) : await productService.create(id, body)); } catch (e) { setError(errorMessage(e)); }
  });
  return (
    <Modal open={open} onClose={onClose} title={product ? 'Edit product' : 'Add product'} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name?.message}><input className="input" {...register('name')} /></Field>
          <Field label="SKU" error={errors.sku?.message}><input className="input uppercase" {...register('sku')} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Selling price" error={errors.price?.message}><input className="input" type="number" step="0.01" min="0" {...register('price')} /></Field>
          <Field label="Cost price" error={errors.costPrice?.message}><input className="input" type="number" step="0.01" min="0" {...register('costPrice')} /></Field>
          <Field label="Category"><select className="input" {...register('categoryId')}><option value="">Uncategorized</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {!product && <Field label="Opening stock" error={errors.stockQuantity?.message} hint="Later changes go through Inventory so they are logged"><input className="input" type="number" min="0" {...register('stockQuantity')} /></Field>}
          <Field label="Minimum stock level" error={errors.minimumStockLevel?.message} hint="Alerts when stock reaches this"><input className="input" type="number" min="0" {...register('minimumStockLevel')} /></Field>
        </div>
        <Field label="Image URL" error={errors.image?.message}><input className="input" placeholder="https://" {...register('image')} /></Field>
        <Field label="Description" error={errors.description?.message}><textarea className="input" rows={2} {...register('description')} /></Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner />}{product ? 'Save changes' : 'Create product'}</button></div>
      </form>
    </Modal>
  );
}
