import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, Field, Modal, Spinner } from '@/components/common/ui';
import { useBusiness } from '@/hooks/useBusiness';
import { customerService } from '@/services/resources.service';
import type { Customer } from '@/types';
import { errorMessage } from '@/utils/format';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')).optional(),
  phone: z.string().trim().max(40).optional(), city: z.string().trim().max(100).optional(), country: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});
type Form = z.infer<typeof schema>;

export function CustomerModal({ open, customer, onClose, onSaved }: { open: boolean; customer?: Customer; onClose: () => void; onSaved: (c: Customer) => void }) {
  const { id } = useBusiness();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
  useEffect(() => { if (open) { setError(null); reset({ name: customer?.name ?? '', email: customer?.email ?? '', phone: customer?.phone ?? '', city: customer?.city ?? '', country: customer?.country ?? '', notes: customer?.notes ?? '' }); } }, [open, customer, reset]);
  const submit = handleSubmit(async (v) => {
    setError(null);
    try { onSaved(customer ? await customerService.update(id, customer.id, v) : await customerService.create(id, v)); } catch (e) { setError(errorMessage(e)); }
  });
  return (
    <Modal open={open} onClose={onClose} title={customer ? 'Edit customer' : 'Add customer'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Name" error={errors.name?.message}><input className="input" {...register('name')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" error={errors.email?.message}><input className="input" type="email" {...register('email')} /></Field>
          <Field label="Phone" error={errors.phone?.message}><input className="input" {...register('phone')} /></Field>
          <Field label="City"><input className="input" {...register('city')} /></Field>
          <Field label="Country"><input className="input" {...register('country')} /></Field>
        </div>
        <Field label="Notes"><textarea className="input" rows={2} {...register('notes')} /></Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={isSubmitting}>{isSubmitting && <Spinner />}{customer ? 'Save changes' : 'Add customer'}</button></div>
      </form>
    </Modal>
  );
}
