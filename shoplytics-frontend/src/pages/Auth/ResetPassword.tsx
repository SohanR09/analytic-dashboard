import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { Alert, Field, Spinner } from '@/components/common/ui';
import { authService } from '@/services/auth.service';
import { errorMessage } from '@/utils/format';
import { AuthLayout } from './AuthLayout';
import { resetSchema } from './schemas';

type Form = z.infer<typeof resetSchema>;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(resetSchema), defaultValues: { token: params.get('token') ?? '' } });
  const onSubmit = async (v: Form) => { setError(null); try { await authService.resetPassword(v.token, v.password); setDone(true); } catch (e) { setError(errorMessage(e)); } };
  return (
    <AuthLayout title="Choose a new password" footer={<Link className="font-medium text-primary underline" to="/login">Back to log in</Link>}>
      {done ? <Alert kind="success">Password updated. You can now <Link className="underline" to="/login">log in</Link> (all other sessions were signed out).</Alert> : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <Field label="Reset token" error={errors.token?.message}><input className="input font-mono text-xs" {...register('token')} /></Field>
          <Field label="New password" error={errors.password?.message}><input className="input" type="password" autoComplete="new-password" {...register('password')} /></Field>
          <Field label="Confirm password" error={errors.confirmPassword?.message}><input className="input" type="password" autoComplete="new-password" {...register('confirmPassword')} /></Field>
          <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner />}Update password</button>
        </form>
      )}
    </AuthLayout>
  );
}
