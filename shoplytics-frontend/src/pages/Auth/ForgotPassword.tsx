import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { Alert, Field, Spinner } from '@/components/common/ui';
import { authService } from '@/services/auth.service';
import { errorMessage } from '@/utils/format';
import { AuthLayout } from './AuthLayout';
import { forgotSchema } from './schemas';

type Form = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(forgotSchema) });
  const onSubmit = async (v: Form) => { setError(null); try { await authService.forgotPassword(v.email); setSent(true); } catch (e) { setError(errorMessage(e)); } };
  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a reset link" footer={<Link className="font-medium text-primary underline" to="/login">Back to log in</Link>}>
      {sent ? (
        <div className="space-y-4">
          <Alert kind="success">If an account exists for that email, a reset link has been sent. It expires in one hour.</Alert>
          <Link className="btn-secondary w-full" to="/reset-password">I have a reset token</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <Field label="Email" error={errors.email?.message}><input className="input" type="email" autoComplete="email" {...register('email')} /></Field>
          <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner />}Send reset link</button>
        </form>
      )}
    </AuthLayout>
  );
}
