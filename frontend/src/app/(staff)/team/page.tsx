'use client';

import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useCan, useMe } from '@/lib/meta';
import { useList } from '@/lib/useList';
import { checkPasswordRules } from '@/lib/money';
import { StaffMember } from '@/lib/types';
import { DataList } from '@/components/ui/DataList';
import { GroupedRow } from '@/components/ui/GroupedRow';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Field, SelectField } from '@/components/ui/Field';
import { PasswordChecklist } from '@/components/ui/PasswordChecklist';
import { Pill } from '@/components/ui/Pill';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';

export default function TeamPage() {
  const { showToast } = useToast();
  const me = useMe();
  const canWriteStaff = useCan('staff.write');

  const list = useList<StaffMember>('/staff', undefined, 50);

  const [addOpen, setAddOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<StaffMember | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.full_name = 'Name is required';
    if (!email.trim() || !email.includes('@')) errs.email = 'Enter a valid email';
    if (!checkPasswordRules(password).isValid) {
      errs.password = 'Password must meet all security rules below';
    }
    if (Object.keys(errs).length > 0) {
      setFields(errs);
      return;
    }

    setFields({});
    setSaving(true);
    try {
      await api.post('/staff', {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });
      showToast('Team member added', 'success');
      setAddOpen(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('staff');
      await list.reset();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFields(err.fields);
      } else {
        showToast(err instanceof Error ? err.message : 'Failed to add team member', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: StaffMember, nextActive: boolean) => {
    setTogglingStatus(true);
    try {
      await api.patch(`/staff/${member.id}`, { is_active: nextActive });
      showToast(
        nextActive ? 'Team member reactivated' : 'Team member deactivated',
        'success'
      );
      setDeactivateTarget(null);
      await list.reset();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setTogglingStatus(false);
    }
  };

  const activeCount = list.items.filter((m) => m.is_active).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--text-primary)]">
            Team
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Manage internal staff accounts and workspace access permissions
          </p>
        </div>
        {canWriteStaff && (
          <Pill variant="primary" onClick={() => setAddOpen(true)}>
            <UserPlus className="w-4 h-4" aria-hidden="true" />
            <span>Add team member</span>
          </Pill>
        )}
      </div>

      <section className="space-y-4">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] tabular-nums">
          Active members ({activeCount})
        </h2>

        <DataList<StaffMember>
          items={list.items}
          loading={list.loading}
          error={list.error}
          onRetry={list.reset}
          emptyTitle="No team members found."
          emptyActionLabel={canWriteStaff ? 'Add team member' : undefined}
          onEmptyAction={canWriteStaff ? () => setAddOpen(true) : undefined}
          renderItem={(member) => {
            const isCurrentUser =
              me && (String(me.id) === String(member.id) || me.email === member.email);
            const isOwner = member.role === 'admin';
            const initials = (member.full_name || 'S')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <GroupedRow key={member.id}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-10 h-10 rounded-full bg-white text-[var(--brand-dark)] font-bold text-[13px] inline-flex items-center justify-center shrink-0">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                          {member.full_name}
                        </span>
                        {isCurrentUser && (
                          <StatusBadge status="active" label="You" />
                        )}
                        {isOwner && (
                          <StatusBadge status="confirmed" label="Account owner" />
                        )}
                        {!member.is_active && (
                          <StatusBadge status="inactive" label="Deactivated" />
                        )}
                      </div>
                      <div className="text-[12px] text-[var(--text-muted)] truncate">
                        {member.email} · <span className="uppercase">{member.role}</span>
                      </div>
                    </div>
                  </div>

                  {canWriteStaff && !isCurrentUser && (
                    <div>
                      {member.is_active ? (
                        <Pill
                          variant="outline"
                          size="sm"
                          onClick={() => setDeactivateTarget(member)}
                        >
                          Deactivate
                        </Pill>
                      ) : (
                        <Pill
                          variant="soft"
                          size="sm"
                          onClick={() => handleToggleActive(member, true)}
                        >
                          Reactivate
                        </Pill>
                      )}
                    </div>
                  )}
                </div>
              </GroupedRow>
            );
          }}
        />
      </section>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add team member"
        subtitle="Create a staff or administrator account for your workspace"
        footer={
          <>
            <Pill variant="ghost" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Pill>
            <Pill
              type="submit"
              form="add-staff-form"
              variant="primary"
              loading={saving}
            >
              Add team member
            </Pill>
          </>
        }
      >
        <form id="add-staff-form" onSubmit={handleAddMember} className="space-y-4" noValidate>
          <Field
            label="Full name"
            placeholder="Rohan Verma"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fields.full_name}
            required
          />
          <Field
            label="Email address"
            type="email"
            placeholder="rohan@brightloop.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fields.email}
            required
          />
          <SelectField
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            error={fields.role}
            required
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin (Account owner)</option>
          </SelectField>
          <Field
            label="Temporary password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fields.password}
            required
          />
          <PasswordChecklist password={password} />
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate team member?"
        description={`Are you sure you want to deactivate ${deactivateTarget?.full_name || ''}? They will immediately lose access to the staff workspace.`}
        confirmLabel="Deactivate"
        tone="danger"
        loading={togglingStatus}
        onConfirm={() => {
          if (deactivateTarget) {
            void handleToggleActive(deactivateTarget, false);
          }
        }}
      />
    </div>
  );
}
