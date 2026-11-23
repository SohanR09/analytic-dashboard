import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { Alert, Field, Spinner } from '@/components/common/ui';
import { useAppDispatch, useAppSelector } from '@/store';
import { clearError, login } from '@/store/slices/authSlice';
import { AuthLayout } from './AuthLayout';
import { loginSchema } from './schemas';

type Form = z.infer<typeof loginSchema>;

export default function Login() {
  const dispatch = useAppDispatch();
  const error = useAppSelector((s) => s.auth.error);
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/businesses';
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '', rememberMe: false } });
  const onSubmit = async (v: Form) => { dispatch(clearError()); const r = await dispatch(login(v)); if (login.fulfilled.match(r)) nav(from, { replace: true }); };
  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your Shoplytics account" footer={<>New here? <Link className="font-medium text-primary underline" to="/register">Create an account</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Email" error={errors.email?.message}><input className="input" type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><input className="input" type="password" autoComplete="current-password" {...register('password')} /></Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded border-line accent-[rgb(var(--primary))]" {...register('rememberMe')} />Remember me</label>
          <Link className="text-primary underline" to="/forgot-password">Forgot password?</Link>
        </div>
        <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner />}Log in</button>
      </form>
    </AuthLayout>
  );
}
