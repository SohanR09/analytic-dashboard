import { ArrowLeft, Ban, CheckCircle2, PackageCheck, RotateCcw, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Card, ConfirmDialog, DataTable, ErrorState, FullPageSpinner, Modal, OrderBadge, PageHeader, PaymentBadge, Spinner, useToast } from '@/components/common/ui';
import { useBusiness } from '@/hooks/useBusiness';
import { useFetch } from '@/hooks/useFetch';
import { orderService } from '@/services/resources.service';
import type { OrderStatus } from '@/types';
import { dateTime, errorMessage, money, titleCase } from '@/utils/format';
import { P } from '@/utils/permissions';

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: typeof Truck }>> = {
  PENDING: { to: 'PROCESSING', label: 'Start processing', icon: PackageCheck },
  PROCESSING: { to: 'SHIPPED', label: 'Mark as shipped', icon: Truck },
  SHIPPED: { to: 'DELIVERED', label: 'Mark as delivered', icon: CheckCircle2 },
};

export default function OrderDetail() {
  const { orderId = '' } = useParams();
  const { id, currency, can } = useBusiness();
  const toast = useToast();
  const { data: o, loading, error, reload } = useFetch(() => orderService.get(id, orderId), [id, orderId]);
  const [busy, setBusy] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [refund, setRefund] = useState(false);
  const [amount, setAmount] = useState('');
  const [refundErr, setRefundErr] = useState<string | null>(null);

  if (error && !o) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  if (!o) return loading ? <FullPageSpinner /> : null;

  const act = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await orderService.update(id, o.id, body); toast('success', ok); await reload(); return true; } catch (e) { toast('error', errorMessage(e)); return false; } finally { setBusy(false); }
  };
  const next = NEXT[o.orderStatus];
  const terminal = o.orderStatus === 'CANCELLED' || o.orderStatus === 'REFUNDED';
  const maxRefund = Math.max(0, o.subtotal - o.discountAmount);
  const canRefund = can(P.ORDER_REFUND) && (o.orderStatus === 'SHIPPED' || o.orderStatus === 'DELIVERED') && o.refundAmount < maxRefund;
  const canUpdate = can(P.ORDER_UPDATE);

  const submitRefund = async () => {
    const v = Number(amount);
    if (!(v > o.refundAmount)) return setRefundErr(`Enter an amount above the ${money(o.refundAmount, currency)} already refunded`);
    if (v > maxRefund) return setRefundErr(`Refund cannot exceed ${money(maxRefund, currency)}`);
    setRefundErr(null);
    if (await act({ refundAmount: v }, 'Refund recorded')) setRefund(false);
  };

  return (
    <>
      <Link to={`/businesses/${id}/orders`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Orders</Link>
      <PageHeader title={o.orderNumber} subtitle={`Placed ${dateTime(o.orderDate)}`} actions={<><OrderBadge s={o.orderStatus} /><PaymentBadge s={o.paymentStatus} /></>} />

      {canUpdate && !terminal && (
        <div className="card mb-5 flex flex-wrap items-center gap-2 p-4">
          <span className="mr-2 text-sm font-medium">Actions</span>
          {next && <button className="btn-primary" disabled={busy} onClick={() => act({ orderStatus: next.to }, `Order ${titleCase(next.to)}`)}>{busy ? <Spinner /> : <next.icon className="h-4 w-4" />}{next.label}</button>}
          {o.paymentStatus === 'PENDING' && <button className="btn-secondary" disabled={busy} onClick={() => act({ paymentStatus: 'PAID' }, 'Marked as paid')}>Mark as paid</button>}
          {o.orderStatus !== 'DELIVERED' && <button className="btn-secondary !text-danger" disabled={busy} onClick={() => setCancel(true)}><Ban className="h-4 w-4" />Cancel order</button>}
          {canRefund && <button className="btn-secondary" disabled={busy} onClick={() => { setAmount(''); setRefundErr(null); setRefund(true); }}><RotateCcw className="h-4 w-4" />{o.refundAmount > 0 ? 'Add to refund' : 'Issue refund'}</button>}
        </div>
      )}
      {canUpdate && !can(P.ORDER_REFUND) && !terminal && <p className="mb-4 text-xs text-muted">Refunds require an Owner or Admin.</p>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Items</h2>
            <DataTable rows={o.items} rowKey={(i) => i.productId + i.sku}
              columns={[
                { header: 'Product', cell: (i) => <span><span className="font-medium">{i.name}</span><span className="block font-mono text-xs text-muted">{i.sku}</span></span> },
                { header: 'Qty', cell: (i) => i.quantity, className: 'text-right' },
                { header: 'Unit price', cell: (i) => money(i.unitPrice, currency), className: 'text-right' },
                { header: 'Total', cell: (i) => money(i.totalPrice, currency), className: 'text-right' },
              ]} />
          </div>
          {o.timeline && o.timeline.length > 0 && (
            <Card title="Timeline"><ol className="space-y-3 border-l-2 border-line pl-4">
              {[...o.timeline].reverse().map((t, i) => (
                <li key={i} className="relative text-sm"><span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" /><b>{titleCase(t.status)}</b><span className="ml-2 text-muted">{dateTime(t.at)}</span>{t.note && <p className="text-muted">{t.note}</p>}</li>
              ))}
            </ol></Card>
          )}
        </div>
        <div className="space-y-5">
          <Card title="Summary"><dl className="space-y-2 text-sm">
            {([['Subtotal', o.subtotal], ['Discount', -o.discountAmount], ['Tax', o.taxAmount], ['Shipping', o.shippingAmount]] as [string, number][]).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted">{k}</dt><dd>{money(v, currency)}</dd></div>)}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{money(o.totalAmount, currency)}</dd></div>
            {o.refundAmount > 0 && <div className="flex justify-between text-danger"><dt>Refunded</dt><dd>−{money(o.refundAmount, currency)}</dd></div>}
          </dl></Card>
          <Card title="Customer">
            {o.customer ? <Link className="font-medium text-primary hover:underline" to={`/businesses/${id}/customers/${o.customer.id}`}>{o.customer.name}</Link> : <span className="text-muted">Guest checkout</span>}
            {o.customer?.email && <p className="text-sm text-muted">{o.customer.email}</p>}
            <p className="mt-3 text-sm text-muted">Payment: {o.paymentMethod ? titleCase(o.paymentMethod) : '—'}</p>
            {o.notes && <p className="mt-2 text-sm">{o.notes}</p>}
          </Card>
        </div>
      </div>

      <ConfirmDialog open={cancel} busy={busy} title="Cancel order" confirmLabel="Cancel order" message="The reserved stock returns to inventory and this order stops counting towards revenue. This cannot be undone." onClose={() => setCancel(false)} onConfirm={async () => { if (await act({ orderStatus: 'CANCELLED' }, 'Order cancelled')) setCancel(false); }} />
      <Modal open={refund} onClose={() => setRefund(false)} title="Issue refund">
        <div className="space-y-3">
          {refundErr && <Alert>{refundErr}</Alert>}
          <p className="text-sm text-muted">Enter the <b>total</b> amount refunded so far (max {money(maxRefund, currency)}). Refunds cannot be reduced later.</p>
          <input className="input" type="number" step="0.01" min={0} value={amount} placeholder={String(maxRefund)} onChange={(e) => setAmount(e.target.value)} aria-label="Refund amount" />
          <div className="flex justify-between"><button className="btn-ghost" onClick={() => setAmount(String(maxRefund))}>Refund in full</button><div className="flex gap-2"><button className="btn-secondary" onClick={() => setRefund(false)}>Cancel</button><button className="btn-primary" disabled={busy} onClick={submitRefund}>{busy && <Spinner />}Confirm refund</button></div></div>
        </div>
      </Modal>
    </>
  );
}
