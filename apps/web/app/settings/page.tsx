'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AuditLog, Business, Organization, OrganizationInvite, OrganizationMember } from '@billora/shared';
import { EmptyState } from '../../components/empty-state';
import { SkeletonList } from '../../components/loading-state';
import { Message } from '../../components/message';
import { Pagination } from '../../components/pagination';
import { ProtectedPage } from '../../components/protected-page';
import { useToast } from '../../components/toast-provider';
import { api, PaginationMeta } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirmAction, getErrorMessage } from '../../lib/errors';
import { validateEmail } from '../../lib/validators';

const emptyBusiness = { name: '', email: '', phone: '', address: '', city: '', country: '', taxNumber: '', logoUrl: '' };

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [newOrganizationName, setNewOrganizationName] = useState('');
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditMeta, setAuditMeta] = useState<PaginationMeta | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditAction, setAuditAction] = useState('');
  const [auditEntityType, setAuditEntityType] = useState('');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyBusiness);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [organizationBusy, setOrganizationBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedBusiness = useMemo(() => businesses.find((business) => business.id === selectedId), [businesses, selectedId]);
  const selectedOrganization = useMemo(() => organizations.find((organization) => organization.id === organizationId), [organizations, organizationId]);
  const currentMember = members.find((member) => member.userId === user?.id);
  const canManage = currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';

  function fillForm(business?: Business) {
    setForm({
      name: business?.name ?? '',
      email: business?.email ?? '',
      phone: business?.phone ?? '',
      address: business?.address ?? '',
      city: business?.city ?? '',
      country: business?.country ?? '',
      taxNumber: business?.taxNumber ?? '',
      logoUrl: business?.logoUrl ?? '',
    });
  }

  async function load(nextSelectedId = selectedId, nextOrganizationId = organizationId, nextAuditPage = auditPage) {
    const organizationData = await api.organizations();
    const currentOrganization = organizationData.find((organization) => organization.id === nextOrganizationId) ?? organizationData[0];
    const currentOrganizationId = currentOrganization?.id ?? '';
    const [businessData, memberData, inviteData, auditData] = await Promise.all([
      api.businesses({ organizationId: currentOrganizationId }),
      currentOrganizationId ? api.organizationMembers(currentOrganizationId) : Promise.resolve([]),
      currentOrganizationId ? api.organizationInvites(currentOrganizationId) : Promise.resolve([]),
      currentOrganizationId ? api.auditLogsPaginated({ organizationId: currentOrganizationId, page: nextAuditPage, limit: 8, action: auditAction, entityType: auditEntityType, dateFrom: auditDateFrom, dateTo: auditDateTo }) : Promise.resolve({ data: [], meta: null }),
    ]);
    const next = businessData.find((business) => business.id === nextSelectedId) ?? businessData[0];
    setOrganizations(organizationData);
    setOrganizationId(currentOrganizationId);
    setOrganizationName(currentOrganization?.name ?? '');
    setBusinesses(businessData);
    setMembers(memberData);
    setInvites(inviteData);
    setAuditLogs(auditData.data);
    setAuditMeta(auditData.meta);
    setSelectedId(next?.id ?? '');
    fillForm(next);
  }

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err, 'Unable to load business profiles'))).finally(() => setLoading(false));
  }, [organizationId, auditPage, auditAction, auditEntityType, auditDateFrom, auditDateTo]);

  function selectOrganization(id: string) {
    setError('');
    setAuditPage(1);
    setSelectedId('');
    setOrganizationId(id);
  }

  function selectBusiness(id: string) {
    setError('');
    setSelectedId(id);
    fillForm(businesses.find((business) => business.id === id));
  }

  function newBusiness() {
    setError('');
    setSelectedId('');
    fillForm();
  }

  function payload() {
    return Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ''));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (form.name.trim().length < 2) {
      setError('Business name must be at least 2 characters.');
      return;
    }
    if (!validateEmail(form.email)) {
      setError('Enter a valid business email address.');
      return;
    }
    setSubmitting(true);
    try {
      if (selectedBusiness) {
        const updated = await api.updateBusiness(selectedBusiness.id, payload());
        toast.success('Business profile updated.');
        await load(updated.id, organizationId, auditPage);
      } else {
        const created = await api.createBusiness({ ...payload(), organizationId } as typeof emptyBusiness & { name: string; organizationId: string });
        toast.success('Business profile created.');
        await load(created.id, organizationId, auditPage);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save business profile'));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeBusiness() {
    if (!selectedBusiness) return;
    if (!confirmAction(`Delete ${selectedBusiness.name}? This also removes related customers and invoices.`)) return;
    setDeleting(true);
    setError('');
    try {
      await api.deleteBusiness(selectedBusiness.id);
      toast.success('Business profile deleted.');
      await load('', organizationId, auditPage);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete business profile'));
    } finally {
      setDeleting(false);
    }
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newOrganizationName.trim().length < 2) {
      setError('Organization name must be at least 2 characters.');
      return;
    }
    setOrganizationBusy(true);
    setError('');
    try {
      const organization = await api.createOrganization({ name: newOrganizationName.trim() });
      setNewOrganizationName('');
      toast.success('Organization created.');
      await load('', organization.id, 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create organization'));
    } finally {
      setOrganizationBusy(false);
    }
  }

  async function updateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrganization) return;
    if (organizationName.trim().length < 2) {
      setError('Organization name must be at least 2 characters.');
      return;
    }
    setOrganizationBusy(true);
    setError('');
    try {
      const organization = await api.updateOrganization(selectedOrganization.id, { name: organizationName.trim() });
      toast.success('Organization updated.');
      await load(selectedId, organization.id, auditPage);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update organization'));
    } finally {
      setOrganizationBusy(false);
    }
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    if (!validateEmail(inviteEmail)) {
      setError('Enter a valid invite email address.');
      return;
    }
    setOrganizationBusy(true);
    setError('');
    try {
      await api.createOrganizationInvite(organizationId, { email: inviteEmail, role: inviteRole });
      setInviteEmail('');
      setInviteRole('MEMBER');
      toast.success('Invite created.');
      await load(selectedId, organizationId, auditPage);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create invite'));
    } finally {
      setOrganizationBusy(false);
    }
  }

  async function cancelInvite(invite: OrganizationInvite) {
    if (!confirmAction(`Cancel invite for ${invite.email}?`)) return;
    setOrganizationBusy(true);
    setError('');
    try {
      await api.cancelOrganizationInvite(invite.organizationId, invite.id);
      toast.success('Invite cancelled.');
      await load(selectedId, organizationId, auditPage);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to cancel invite'));
    } finally {
      setOrganizationBusy(false);
    }
  }

  async function resendInvite(invite: OrganizationInvite) {
    setOrganizationBusy(true);
    setError('');
    try {
      await api.resendOrganizationInvite(invite.organizationId, invite.id);
      toast.success('Invite token refreshed.');
      await load(selectedId, organizationId, auditPage);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to resend invite'));
    } finally {
      setOrganizationBusy(false);
    }
  }

  async function copyInviteLink(invite: OrganizationInvite) {
    const url = `${window.location.origin}/invites/accept?token=${invite.token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Invite link copied.');
  }

  async function uploadLogo(file?: File) {
    if (!selectedBusiness || !file) return;
    setUploadingLogo(true);
    setError('');
    try {
      const updated = await api.uploadBusinessLogo(selectedBusiness.id, file);
      toast.success('Logo uploaded.');
      await load(updated.id, organizationId, auditPage);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to upload logo'));
    } finally {
      setUploadingLogo(false);
    }
  }

  function exportAuditLogs() {
    if (!organizationId) return;
    window.open(api.auditExportUrl({ organizationId, action: auditAction, entityType: auditEntityType, dateFrom: auditDateFrom, dateTo: auditDateTo }), '_blank', 'noopener,noreferrer');
  }

  return (
    <ProtectedPage>
      <section className="stack">
        <div className="card">
          <div className="section-heading">
            <div>
              <h1>Workspace settings</h1>
              <p>Manage organizations, team visibility, business profiles, and activity history.</p>
            </div>
            <button className="secondary" type="button" onClick={newBusiness} disabled={!canManage}>New business</button>
          </div>
          <Message error={error} />
        </div>

        <div className="grid two">
          <div className="card">
            <h2>Organizations</h2>
            <div className="table">
              {loading && <SkeletonList rows={3} />}
              {organizations.map((organization) => (
                <button
                  className={`list-button ${organization.id === organizationId ? 'active' : ''}`}
                  key={organization.id}
                  type="button"
                  onClick={() => selectOrganization(organization.id)}
                >
                  <span><strong>{organization.name}</strong><small>{organization.slug}</small></span>
                  <small>{organization.id === organizationId ? 'Active' : 'Switch'}</small>
                </button>
              ))}
            </div>
            <form className="inline-form" onSubmit={createOrganization}>
              <input value={newOrganizationName} onChange={(event) => setNewOrganizationName(event.target.value)} placeholder="New organization name" />
              <button type="submit" disabled={organizationBusy}>Create</button>
            </form>
          </div>

          <div className="card">
            <h2>Active organization</h2>
            <form onSubmit={updateOrganization}>
              <label>Name<input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required /></label>
              <button type="submit" disabled={organizationBusy || !selectedOrganization || !canManage}>{organizationBusy ? 'Saving...' : 'Save organization'}</button>
            </form>
            <div className="mini-list">
              <h3>Members</h3>
              {members.map((member) => (
                <div className="mini-row" key={`${member.organizationId}-${member.userId}`}>
                  <span><strong>{member.user?.fullName || member.user?.email || 'Member'}</strong><small>{member.user?.email}</small></span>
                  <small>{member.role}</small>
                </div>
              ))}
              {!members.length && <p className="muted">No members found.</p>}
            </div>
            <div className="notice">
              <strong>Invite teammate</strong>
              <form className="inline-form" onSubmit={createInvite}>
                <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@example.com" />
                <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <button type="submit" disabled={organizationBusy || !canManage}>Invite</button>
              </form>
              <div className="mini-list">
                {invites.map((invite) => (
                  <div className="mini-row" key={invite.id}>
                    <span><strong>{invite.email}</strong><small>{invite.role} · {invite.status} · expires {new Date(invite.expiresAt).toLocaleDateString()}</small></span>
                    {invite.status === 'PENDING' && (
                      <span className="actions small">
                        <button className="secondary" type="button" onClick={() => void copyInviteLink(invite)} disabled={!canManage}>Copy link</button>
                        <button className="secondary" type="button" onClick={() => void resendInvite(invite)} disabled={organizationBusy || !canManage}>Resend</button>
                        <button className="danger secondary" type="button" onClick={() => void cancelInvite(invite)} disabled={organizationBusy || !canManage}>Cancel</button>
                      </span>
                    )}
                  </div>
                ))}
                {!invites.length && <p className="muted">No invites yet.</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid two">
          <div className="card">
            <h2>Profiles</h2>
            <div className="table">
              {loading && <p className="muted">Loading business profiles...</p>}
              {businesses.map((business) => (
                <button
                  className={`list-button ${business.id === selectedId ? 'active' : ''}`}
                  key={business.id}
                  type="button"
                  onClick={() => selectBusiness(business.id)}
                >
                  <span><strong>{business.name}</strong><small>{business.email || business.city || 'No contact details yet'}</small></span>
                  <small>{business.organization?.name || 'Organization'}</small>
                </button>
              ))}
              {!loading && !businesses.length && <EmptyState title="No businesses yet" description="Create the first business profile for your invoices." />}
            </div>
          </div>

          <div className="card">
            <h2>{selectedBusiness ? 'Edit business' : 'Create business'}</h2>
            <form className="grid two" onSubmit={onSubmit}>
              <label>Business name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required disabled={!canManage} /></label>
              <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={!canManage} /></label>
              <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} disabled={!canManage} /></label>
              <label>Tax number<input value={form.taxNumber} onChange={(event) => setForm({ ...form, taxNumber: event.target.value })} disabled={!canManage} /></label>
              <label>City<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} disabled={!canManage} /></label>
              <label>Country<input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} disabled={!canManage} /></label>
              <label className="full">Logo URL<input value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} disabled={!canManage} /></label>
              {selectedBusiness && (
                <label className="full">Upload logo
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => void uploadLogo(event.target.files?.[0])} disabled={uploadingLogo || !canManage} />
                </label>
              )}
              {form.logoUrl && <div className="full logo-preview"><img src={form.logoUrl.startsWith('/uploads') ? `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${form.logoUrl}` : form.logoUrl} alt="Business logo preview" /></div>}
              <label className="full">Address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} disabled={!canManage} /></label>
              <div className="full actions">
                <button type="submit" disabled={submitting || !canManage}>{submitting ? 'Saving...' : selectedBusiness ? 'Save changes' : 'Create business'}</button>
                {selectedBusiness && <button className="danger secondary" type="button" onClick={() => void removeBusiness()} disabled={deleting || !canManage}>{deleting ? 'Deleting...' : 'Delete business'}</button>}
              </div>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="section-heading">
            <div>
              <h2>Activity log</h2>
              <p>{auditMeta ? `${auditMeta.total} event${auditMeta.total === 1 ? '' : 's'} in this organization` : 'Recent organization activity'}</p>
            </div>
            <div className="filters">
              <label>Action
                <select value={auditAction} onChange={(event) => { setAuditAction(event.target.value); setAuditPage(1); }}>
                  <option value="">All actions</option>
                  <option value="ORGANIZATION_CREATED">Organization created</option>
                  <option value="ORGANIZATION_UPDATED">Organization updated</option>
                  <option value="BUSINESS_CREATED">Business created</option>
                  <option value="CUSTOMER_CREATED">Customer created</option>
                  <option value="INVOICE_CREATED">Invoice created</option>
                  <option value="INVOICE_SENT">Invoice sent</option>
                  <option value="PAYMENT_RECORDED">Payment recorded</option>
                </select>
              </label>
              <label>Entity
                <select value={auditEntityType} onChange={(event) => { setAuditEntityType(event.target.value); setAuditPage(1); }}>
                  <option value="">All entities</option>
                  <option value="ORGANIZATION">Organization</option>
                  <option value="BUSINESS">Business</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="INVOICE">Invoice</option>
                  <option value="PAYMENT">Payment</option>
                </select>
              </label>
              <label>From<input type="date" value={auditDateFrom} onChange={(event) => { setAuditDateFrom(event.target.value); setAuditPage(1); }} /></label>
              <label>To<input type="date" value={auditDateTo} onChange={(event) => { setAuditDateTo(event.target.value); setAuditPage(1); }} /></label>
              <button className="secondary" type="button" onClick={exportAuditLogs}>Export CSV</button>
            </div>
          </div>
          <div className="table">
            {auditLogs.map((log) => (
              <div className="table-row" key={log.id}>
                <span><strong>{log.action.replaceAll('_', ' ')}</strong><small>{log.user?.fullName || log.user?.email || 'System'} · {new Date(log.createdAt).toLocaleString()}</small></span>
                <span>{log.entityType}</span>
                <small>{log.entityId.slice(0, 8)}</small>
              </div>
            ))}
            {!auditLogs.length && <EmptyState title="No activity yet" description="Changes in this organization will appear here." />}
          </div>
          <Pagination meta={auditMeta} page={auditPage} onPageChange={setAuditPage} />
        </div>
      </section>
    </ProtectedPage>
  );
}
