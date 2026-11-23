import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { Alert, Field, Spinner } from '@/components/common/ui';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearError, register as registerThunk } from '@/store/slices/authSlice';
import { AuthLayout } from './AuthLayout';
import { registerSchema } from './schemas';

type Form = z.infer<typeof registerSchema>;

export default function Register() {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.auth.error);
  const nav = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(registerSchema) });
  const onSubmit = async (v: Form) => {
    dispatch(clearError());
    const r = await dispatch(registerThunk({ name: v.name, email: v.email, password: v.password, confirmPassword: v.confirmPassword }));
    if (registerThunk.fulfilled.match(r)) nav('/businesses', { replace: true });
  };
  return (
    <AuthLayout title="Create your account" subtitle="Start tracking your businesses in minutes" footer={<>Already registered? <Link className="font-medium text-primary underline" to="/login">Log in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Full name" error={errors.name?.message}><input className="input" autoComplete="name" {...register('name')} /></Field>
        <Field label="Email" error={errors.email?.message}><input className="input" type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message} hint="8+ characters with a letter and a number"><input className="input" type="password" autoComplete="new-password" {...register('password')} /></Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message}><input className="input" type="password" autoComplete="new-password" {...register('confirmPassword')} /></Field>
        <div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]" {...register('terms')} /><span>I agree to the Terms and Conditions and Privacy Policy</span></label>
          {errors.terms && <p className="mt-1 text-xs text-danger" role="alert">{errors.terms.message}</p>}
        </div>
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner />}Create account</button>
      </form>
    </AuthLayout>
  );
}
